/**
 * (c) Su & William Entriken, released under MIT license
 * 
 * SYNOPSIS
 * node load-blockchain.js [numberOfBlocksToProcess] [chunkSize]
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

const provider = new ethers.JsonRpcProvider(process.env.PROVIDER_URL);
const numberOfBlocksToProcess = parseInt(process.argv[2]) || 1000000;
const chunkSize = parseInt(process.argv[3]) || 2000;
const nonpersonalizedPixelData = hexToUint8Array("E6".repeat(300)); // Gray
const blackPixelData = hexToUint8Array("00".repeat(300)); // Black
const METADATA_DIR = "./build/metadata";
const SETTLE_BLOCKS = 10;

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

const currentSettledBlock = await provider.getBlockNumber() - SETTLE_BLOCKS;
const endBlock = Math.min(state.loadedTo + numberOfBlocksToProcess, currentSettledBlock);
console.log(chalk.blue("Loaded to:             ") + state.loadedTo);
console.log(chalk.blue("Loading to:            ") + endBlock);
console.log(chalk.blue("Chunk size:            ") + chunkSize);
console.log(chalk.blue("Current settled block: ") + currentSettledBlock);
fs.mkdirSync(METADATA_DIR, { recursive: true });


// Load events /////////////////////////////////////////////////////////////////
const suSquaresConnected = suSquares.connect(provider);
const underlayConnected = underlay.connect(provider);

// Helper function to retry RPC calls with exponential backoff
async function withRetry(fn, description) {
    const MAX_RETRIES = 5;
    const INITIAL_DELAY_MS = 500;
    let retryCount = 0;
    let lastError;

    while (retryCount < MAX_RETRIES) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            const isRateLimit = error.code === -32005 || error.message?.includes('Too Many Requests');

            if (isRateLimit && retryCount < MAX_RETRIES - 1) {
                const delayMs = INITIAL_DELAY_MS * Math.pow(2, retryCount);
                console.log(chalk.yellow(`  [${description}] Rate limited, retrying in ${delayMs}ms (attempt ${retryCount + 1}/${MAX_RETRIES})...`));
                await new Promise(resolve => setTimeout(resolve, delayMs));
                retryCount++;
            } else {
                throw error;
            }
        }
    }
    throw lastError;
}

// Helper function to query logs in chunks (RPC block range limit workaround)
async function queryFilterInChunks(contract, filter, fromBlock, toBlock, filterName, maxChunkSize = 2000) {
    const allEvents = [];
    const CHUNK_DELAY_MS = 1000; // Delay between chunk requests to avoid rate limiting

    console.log(chalk.blue(`\nFetching ${filterName} events...`));

    for (let currentBlock = fromBlock; currentBlock <= toBlock; currentBlock += maxChunkSize) {
        const chunkEnd = Math.min(currentBlock + maxChunkSize - 1, toBlock);

        // Add delay before each chunk request (except the first one)
        if (currentBlock !== fromBlock) {
            await new Promise(resolve => setTimeout(resolve, CHUNK_DELAY_MS));
        }

        console.log(chalk.gray(`  [${filterName}] blocks ${currentBlock} to ${chunkEnd}...`));
        const events = await withRetry(
            () => contract.queryFilter(filter, currentBlock, chunkEnd),
            filterName
        );
        allEvents.push(...events);
    }

    console.log(chalk.green(`  ✓ Found ${allEvents.length} ${filterName} events`));
    return allEvents;
}

const filterSold = suSquaresConnected.filters.Transfer(suSquares.getAddress(), null, null);
const sold = await queryFilterInChunks(suSquaresConnected, filterSold, state.loadedTo + 1, endBlock, 'Transfer', chunkSize);

const filterPersonalized = suSquaresConnected.filters.Personalized();
const personalized = await queryFilterInChunks(suSquaresConnected, filterPersonalized, state.loadedTo + 1, endBlock, 'Personalized', chunkSize);

const filterUnderlay = underlayConnected.filters.PersonalizedUnderlay();
const personalizedUnderlay = await queryFilterInChunks(underlayConnected, filterUnderlay, state.loadedTo + 1, endBlock, 'PersonalizedUnderlay', chunkSize);

if (personalized.length > 100) {
    console.log(chalk.red("Too many personalized events, server will choke. Try updating fewer. Exiting."));
    process.exit(1);
}

// Process events //////////////////////////////////////////////////////////////
function personalize(squareNumber, title, href, rgbData) {
    state.squarePersonalizations[squareNumber - 1] = [title, href];
    publishMetadataJson(squareNumber, title);
    paintSuSquare(squareNumber, rgbData);
    publishSquareImageWithRGBData(squareNumber, rgbData);
}

for (const event of sold) {
    const squareNumber = Number(event.args.squareNumber);
    console.log(`Sold: ${squareNumber} at block ${event.blockNumber}`);
    state.squareExtra[squareNumber - 1] = [
        event.blockNumber, // mintedBlock
        event.blockNumber, // updatedBlock
        false,             // mainIsPersonalized
        0,                 // version
    ];
    personalize(squareNumber, "", "", nonpersonalizedPixelData);
}

for (const event of personalizedUnderlay) {
    const squareNumber = Number(event.args.squareNumber);
    console.log(`Personalized underlay: ${squareNumber} at block ${event.blockNumber}`);
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

for await (const event of personalized) {
    const squareNumber = Number(event.args.squareNumber);
    console.log(`Personalized main contract: ${squareNumber} at block ${event.blockNumber}`);
    let { version, title, href, rgbData } = await withRetry(
        () => suSquaresConnected.suSquares(squareNumber),
        `suSquares(${squareNumber})`
    );

    const mainIsPersonalized = title !== ""
        || href !== ""
        || rgbData !== ("0x" + uint8ArrayToHex(blackPixelData)); // 0x000 is not case sensitive

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


// Save checkpoint /////////////////////////////////////////////////////////////
state.loadedTo = endBlock;
await saveWholeSuSquare();
fs.writeFileSync("./build/loadedTo.json", JSON.stringify(state.loadedTo));
fs.writeFileSync("./build/squarePersonalizations.json", JSON.stringify(state.squarePersonalizations));
fs.writeFileSync("./build/underlayPersonalizations.json", JSON.stringify(state.underlayPersonalizations));
fs.writeFileSync("./build/squareExtra.json", JSON.stringify(state.squareExtra));