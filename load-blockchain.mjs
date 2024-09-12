/**
 * (c) Su & William Entriken, released under MIT license
 * 
 * SYNOPSIS
 * node load-blockchain.js [numberOfBlocksToProcess]
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
const config = JSON.parse(fs.readFileSync("./config.json"));
const provider = new ethers.JsonRpcProvider(config.provider);
const numberOfBlocksToProcess = parseInt(process.argv[process.argv.length - 1])
    ? parseInt(process.argv[process.argv.length - 1])
    : 1000000;
const nonpersonalizedPixelData = Buffer.from("E6".repeat(300), "hex"); // Gray
const blackPixelData = Buffer.from("00".repeat(300), "hex"); // Black
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
console.log(chalk.blue("Current settled block: ") + currentSettledBlock);
fs.mkdirSync(METADATA_DIR, { recursive: true });


// Load events /////////////////////////////////////////////////////////////////
const suSquaresConnected = suSquares.connect(provider);
const underlayConnected = underlay.connect(provider);

const filterSold = suSquaresConnected.filters.Transfer(suSquares.getAddress(), null, null);
const sold = await suSquaresConnected.queryFilter(filterSold, state.loadedTo+1, endBlock);

const filterPersonalized = suSquaresConnected.filters.Personalized();
const personalized = await suSquaresConnected.queryFilter(filterPersonalized, state.loadedTo+1, endBlock);

const filterUnderlay = underlayConnected.filters.PersonalizedUnderlay();
const personalizedUnderlay = await underlayConnected.queryFilter(filterUnderlay, state.loadedTo+1, endBlock);

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
        personalize(squareNumber, event.args.title, event.args.href, Buffer.from(event.args.rgbData.substr(2), "hex"));
    }
}

for await (const event of personalized) {
    const squareNumber = Number(event.args.squareNumber);
    console.log(`Personalized main contract: ${squareNumber} at block ${event.blockNumber}`);
    let {version, title, href, rgbData} = await suSquaresConnected.suSquares(squareNumber);

    const mainIsPersonalized = title !== "" 
        || href !== ""
        || rgbData !== ("0x" + blackPixelData.toString("hex")); // 0x000 is not case sensitive

    state.squareExtra[squareNumber - 1] = [
        state.squareExtra[squareNumber - 1][0], // mintedBlock
        event.blockNumber,                      // updatedBlock
        mainIsPersonalized,                     // mainIsPersonalized
        Number(version),                        // version
    ];

    if (mainIsPersonalized) {
        personalize(squareNumber, title, href, Buffer.from(rgbData.substr(2), "hex"));
    } else if (state.underlayPersonalizations[squareNumber - 1] !== null) {
        personalize(squareNumber, state.underlayPersonalizations[squareNumber - 1][0], state.underlayPersonalizations[squareNumber - 1][1], Buffer.from(state.underlayPersonalizations[squareNumber - 1][2], "hex"));
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