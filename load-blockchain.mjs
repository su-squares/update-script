/**
 * (c) Su & William Entriken, released under MIT license
 * 
 * SYNOPSIS
 * node load-blockchain.js
 *
 * Read and update state from blockchain into JSON as specified in SCHEMA.md:
 *
 * - build/loadedTo.json (INPUT / OUTPUT)
 * - build/squarePersonalizations.json (INPUT / OUTPUT)
 * - build/underlayPersonalizations.json (INPUT / OUTPUT)
 * - build/squareExtra.json (INPUT / OUTPUT)
 * 
 * Write ERC-721 metadata files and images for each Square:
 * 
 * - build/metadata/#####.json (OUTPUT)
 * - build/metadata/#####.svg (OUTPUT)
 */

import fs from "fs";
import { ethers } from "ethers";
import chalk from "chalk";
import { paintSuSquare, saveWholeSuSquare, publishSquareImageWithRGBData } from "./libs/image-processing.mjs";
import { publishMetadataJson } from "./libs/metadata.mjs";
import { NUM_SQUARES } from "./libs/geometry.mjs";
import { suSquares, suSquaresDeploymentBlock, underlay } from "./libs/contracts.mjs";
import { logWindows, settledBlockNumber, withRetry } from "./libs/logs.mjs";
import "dotenv/config";

// Convert hex string to Uint8Array (optimized with lookup table)
const hexToDecimalLookupTable = {
    '0': 0, '1': 1, '2': 2, '3': 3, '4': 4,
    '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    'a': 10, 'b': 11, 'c': 12, 'd': 13, 'e': 14, 'f': 15,
    'A': 10, 'B': 11, 'C': 12, 'D': 13, 'E': 14, 'F': 15,
};

function hexToUint8Array(hexString) {
    if (hexString.length % 2 !== 0) {
        throw new Error('Invalid hex string length.');
    }

    const resultLength = hexString.length / 2;
    const bytes = new Uint8Array(resultLength);

    for (let index = 0; index < resultLength; index++) {
        const highNibble = hexToDecimalLookupTable[hexString[index * 2]];
        const lowNibble = hexToDecimalLookupTable[hexString[(index * 2) + 1]];

        if (highNibble === undefined || lowNibble === undefined) {
            throw new Error(`Invalid hex character encountered at position ${index * 2}`);
        }

        bytes[index] = (highNibble << 4) | lowNibble;
    }

    return bytes;
}

// Convert Uint8Array to hex string (optimized with lookup table)
const byteToHexLookupTable = Array.from({ length: 256 },
    (_, index) => index.toString(16).padStart(2, '0'));

function uint8ArrayToHex(array) {
    let hexString = '';
    for (let index = 0; index < array.length; index++) {
        hexString += byteToHexLookupTable[array[index]];
    }
    return hexString;
}

const provider = new ethers.JsonRpcProvider(process.env.PROVIDER_URL, 1, {
    staticNetwork: true,
    batchMaxCount: 1,
});
const nonpersonalizedPixelData = hexToUint8Array("E6".repeat(300)); // Gray
const blackPixelData = hexToUint8Array("00".repeat(300)); // Black
const METADATA_DIR = "./build/metadata";

// Load checkpoint state and arguments /////////////////////////////////////////
var state = {
    loadedTo: suSquaresDeploymentBlock,
    squarePersonalizations: Array(NUM_SQUARES).fill(null), // null | [title, href]
    underlayPersonalizations: Array(NUM_SQUARES).fill(null), // null | [title, href, rgbData]
    squareExtra: Array(NUM_SQUARES).fill(null), // null | [mintedBlock, updatedBlock, mainIsPersonalized, version]
};
if (fs.existsSync("./build/loadedTo.json")
    && fs.existsSync("./build/squarePersonalizations.json")
    && fs.existsSync("./build/underlayPersonalizations.json")
    && fs.existsSync("./build/squareExtra.json")) {
    state.loadedTo = JSON.parse(fs.readFileSync("./build/loadedTo.json"));
    state.squarePersonalizations = JSON.parse(fs.readFileSync("./build/squarePersonalizations.json"));
    state.underlayPersonalizations = JSON.parse(fs.readFileSync("./build/underlayPersonalizations.json"));
    state.squareExtra = JSON.parse(fs.readFileSync("./build/squareExtra.json"));
}

const currentSettledBlock = await settledBlockNumber(provider);
console.log(chalk.blue("Loaded to:             ") + state.loadedTo);
console.log(chalk.blue("Current settled block: ") + currentSettledBlock);
fs.mkdirSync(METADATA_DIR, { recursive: true });


// Load events /////////////////////////////////////////////////////////////////
const suSquaresConnected = suSquares.connect(provider);
const underlayConnected = underlay.connect(provider);

const filterSold = suSquaresConnected.filters.Transfer(suSquares.getAddress(), null, null);
const filterPersonalized = suSquaresConnected.filters.Personalized();
const filterUnderlay = underlayConnected.filters.PersonalizedUnderlay();

// Process events //////////////////////////////////////////////////////////////
function personalize(squareNumber, title, href, rgbData) {
    state.squarePersonalizations[squareNumber - 1] = [title, href];
    publishMetadataJson(squareNumber, title);
    paintSuSquare(squareNumber, rgbData);
    publishSquareImageWithRGBData(squareNumber, rgbData);
}

function saveState(blockNumber) {
    state.loadedTo = blockNumber;
    fs.writeFileSync("./build/loadedTo.json", JSON.stringify(state.loadedTo));
    fs.writeFileSync("./build/squarePersonalizations.json", JSON.stringify(state.squarePersonalizations));
    fs.writeFileSync("./build/underlayPersonalizations.json", JSON.stringify(state.underlayPersonalizations));
    fs.writeFileSync("./build/squareExtra.json", JSON.stringify(state.squareExtra));
}

const fromBlock = state.loadedTo + 1;
const windows = fromBlock > currentSettledBlock
    ? []
    : logWindows(fromBlock, currentSettledBlock);
console.log(chalk.blue(`\nFetching events in ${windows.length} windows...`));

// One log query at a time. Infura returns -32005 when the three filters run together.
const LOG_REQUEST_GAP_MS = 1000;
function pause() {
    return new Promise(resolve => setTimeout(resolve, LOG_REQUEST_GAP_MS));
}

for (let index = 0; index < windows.length; index++) {
    const [start, end] = windows[index];
    console.log(chalk.blue(`Window ${start}..${end} (${index + 1}/${windows.length})`));
    const sold = await withRetry(
        () => suSquaresConnected.queryFilter(filterSold, start, end),
        `sold ${start}..${end}`,
    );
    await pause();
    const personalized = await withRetry(
        () => suSquaresConnected.queryFilter(filterPersonalized, start, end),
        `personalized ${start}..${end}`,
    );
    await pause();
    const personalizedUnderlay = await withRetry(
        () => underlayConnected.queryFilter(filterUnderlay, start, end),
        `underlay ${start}..${end}`,
    );
    await pause();

    const eventsByBlock = new Map();
    for (const event of sold) {
        const block = event.blockNumber;
        if (!eventsByBlock.has(block)) {
            eventsByBlock.set(block, { sold: [], underlay: [], personalized: [] });
        }
        eventsByBlock.get(block).sold.push(event);
    }
    for (const event of personalizedUnderlay) {
        const block = event.blockNumber;
        if (!eventsByBlock.has(block)) {
            eventsByBlock.set(block, { sold: [], underlay: [], personalized: [] });
        }
        eventsByBlock.get(block).underlay.push(event);
    }
    for (const event of personalized) {
        const block = event.blockNumber;
        if (!eventsByBlock.has(block)) {
            eventsByBlock.set(block, { sold: [], underlay: [], personalized: [] });
        }
        eventsByBlock.get(block).personalized.push(event);
    }

    const sortedBlocks = [...eventsByBlock.keys()].sort((a, b) => a - b);
    if (sortedBlocks.length > 0) {
        console.log(chalk.blue(`  ${sortedBlocks.length} blocks with events`));
    }

    for (const blockNumber of sortedBlocks) {
        const block = eventsByBlock.get(blockNumber);
        console.log(chalk.gray(`\nBlock ${blockNumber}: ${block.sold.length} sold, ${block.underlay.length} underlay, ${block.personalized.length} personalized`));

        // Process sold events first
        for (const event of block.sold) {
            const squareNumber = Number(event.args.squareNumber);
            console.log(`  Sold: ${squareNumber}`);
            state.squareExtra[squareNumber - 1] = [
                event.blockNumber, // mintedBlock
                event.blockNumber, // updatedBlock
                false,             // mainIsPersonalized
                0,                 // version
            ];
            personalize(squareNumber, "", "", nonpersonalizedPixelData);
        }

        // Process underlay personalizations second
        for (const event of block.underlay) {
            const squareNumber = Number(event.args.squareNumber);
            console.log(`  Personalized underlay: ${squareNumber}`);
            state.underlayPersonalizations[squareNumber - 1] = [
                event.args.title,             // title
                event.args.href,              // href
                event.args.rgbData.substr(2), // rgbData
            ];
            if (state.squareExtra[squareNumber - 1][2 /* mainIsPersonalized */] === false) {
                state.squareExtra[squareNumber - 1][1 /* updatedBlock */] = event.blockNumber;
                personalize(squareNumber, event.args.title, event.args.href, hexToUint8Array(event.args.rgbData.substr(2)));
            }
        }

        // Process main contract personalizations last (requires RPC calls)
        for (const event of block.personalized) {
            const squareNumber = Number(event.args.squareNumber);
            console.log(`  Personalized main contract: ${squareNumber}`);
            let { version, title, href, rgbData } = await withRetry(
                () => suSquaresConnected.suSquares(squareNumber),
                `suSquares(${squareNumber})`
            );

            const mainIsPersonalized = title !== ""
                || href !== ""
                || rgbData !== ("0x" + uint8ArrayToHex(blackPixelData));

            state.squareExtra[squareNumber - 1] = [
                state.squareExtra[squareNumber - 1][0], // mintedBlock
                event.blockNumber,                      // updatedBlock
                mainIsPersonalized,                     // mainIsPersonalized
                Number(version),                        // version
            ];

            if (mainIsPersonalized) {
                personalize(squareNumber, title, href, hexToUint8Array(rgbData.substr(2)));
            } else if (state.underlayPersonalizations[squareNumber - 1] !== null) {
                personalize(squareNumber, state.underlayPersonalizations[squareNumber - 1][0], state.underlayPersonalizations[squareNumber - 1][1], hexToUint8Array(state.underlayPersonalizations[squareNumber - 1][2]));
            } else {
                personalize(squareNumber, "", "", nonpersonalizedPixelData);
            }
        }

        // Commit state after each block
        saveState(blockNumber);
        console.log(chalk.green(`  ✓ Committed block ${blockNumber}`));
    }

    // This window is fully scanned. A later run resumes after it.
    if (end > state.loadedTo) {
        saveState(end);
        console.log(chalk.green(`  ✓ Loaded to ${end}`));
    }
}

// Save composite image ////////////////////////////////////////////////////////
await saveWholeSuSquare();
console.log(chalk.green("\n✓ Saved composite image"));