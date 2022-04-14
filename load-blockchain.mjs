/**
 * Su Squares Blockchain Loaded
 * (c) 2018 Su & William Entriken
 *
 * Load updated state from blockchain into image and metadata files.
 *
 * - build/resume.json (INPUT / OUTPUT)
 *   The latest processed block (if present)
 * - build/squarePersonalizations.json (OUTPUT)
 *   An accounting of the 10,000 Square personalizations
 * - build/metadata/#####.json (OUTPUT)
 *   ERC-721 metadata file for each modified Square
 * - build/metadata/#####.svg (OUTPUT)
 *   ERC-721 metadata image for each modified Square
 * - build/metadata/#####.png (OUTPUT)
 *   ERC-721 metadata image for each modified Square
 */

import fs from "fs";
import { ethers } from "ethers";
import chalk from "chalk";
import { paintSuSquare, saveWholeSuSquare } from "./libs/image-processing.mjs";
import { publishMetadataJson } from "./libs/metadata.mjs";
import { NUM_SQUARES } from "./libs/geometry.mjs";
import { suSquares, underlay } from "./libs/contracts.mjs";
const config = JSON.parse(fs.readFileSync("./config.json"));
const provider = new ethers.providers.JsonRpcProvider(config.provider);
const numberOfBlocksToProcess = parseInt(process.argv[process.argv.length - 1])
    ? parseInt(process.argv[process.argv.length - 1])
    : 1000000;
const nonpersonalizedPixelData = Buffer.from("E6".repeat(300), "hex"); // Gray
const blackPixelData = Buffer.from("00".repeat(300), "hex"); // Black
const METADATA_DIR = "./build/metadata";

// Load checkpoint state and arguments /////////////////////////////////////////
var state = {
    startBlock: 6645906, // The main contract deployment
    squarePersonalizations: Array(NUM_SQUARES).fill(null), // null | [version, title, href, updatedBlock]
    originalIsBlank: Array(NUM_SQUARES).fill(true),
    underlayPersonalizations: Array(NUM_SQUARES).fill({rgbData: blackPixelData.toString("hex"), title:"", href:""}),
};
if (fs.existsSync("./build/resume.json")) {
    state = JSON.parse(fs.readFileSync("./build/resume.json"));
    console.log(chalk.blue("Resuming from:        ") + state.startBlock);
}
const currentBlock = await provider.getBlockNumber();
const endBlock = Math.min(state.startBlock + numberOfBlocksToProcess, currentBlock);
console.log(chalk.blue("Loading to:           ") + endBlock);
console.log(chalk.blue("Current block:        ") + currentBlock);

fs.mkdirSync(METADATA_DIR, { recursive: true });


// Load events /////////////////////////////////////////////////////////////////
const suSquaresConnected = suSquares.connect(provider);
const underlayConnected = underlay.connect(provider);

const filterSold = suSquaresConnected.filters.Transfer(suSquares.address, null, null);
const sold = await suSquaresConnected.queryFilter(filterSold, state.startBlock, endBlock);

const filterPersonalized = suSquaresConnected.filters.Personalized();
const personalized = await suSquaresConnected.queryFilter(filterPersonalized, state.startBlock, endBlock);

const filterUnderlay = underlayConnected.filters.PersonalizedUnderlay();
const personalizedUnderlay = await underlayConnected.queryFilter(filterUnderlay, state.startBlock, endBlock);


// Process events //////////////////////////////////////////////////////////////
for (const event of sold) {
    const squareNumber = event.args.squareNumber.toNumber();
    console.log("Sold: " + squareNumber.toString());
    state.squarePersonalizations[squareNumber - 1] = [
        0,
        "",
        "",
        event.blockNumber,
    ];
    publishMetadataJson(squareNumber, "");
    paintSuSquare(squareNumber, nonpersonalizedPixelData, false);
}

for (const event of personalizedUnderlay) {
    const squareNumber = event.args.squareNumber.toNumber();
    console.log("Underlay: " + squareNumber.toString());
    state.underlayPersonalizations[squareNumber - 1] = {
        rgbData: event.args.rgbData.substr(2),
        title: event.args.title,
        href: event.args.href
    }
    if (state.originalIsBlank[squareNumber - 1]) {
        state.squarePersonalizations[squareNumber - 1] = [
            state.squarePersonalizations[squareNumber - 1][0],
            event.args.title,
            event.args.href,
            event.blockNumber,
        ];
        publishMetadataJson(squareNumber, state.squarePersonalizations[squareNumber - 1][1]);
        paintSuSquare(squareNumber, Buffer.from(event.args.rgbData.substr(2), "hex"), true);
    }
}

for await (const event of personalized) {
    const squareNumber = event.args.squareNumber.toNumber();
    console.log("Personalized: " + squareNumber.toString());
    const personalization = await suSquaresConnected.suSquares(squareNumber);
    state.squarePersonalizations[squareNumber - 1] = [
        personalization.version.toNumber(),
        personalization.title,
        personalization.href,
        event.blockNumber,
    ];
    state.originalIsBlank[squareNumber - 1] = (
        personalization.rgbData.substr(2).toUpperCase() === blackPixelData.toString("hex").toUpperCase() &&
        personalization.title === "" &&
        personalization.href === ""
    );
    if (state.originalIsBlank[squareNumber - 1]) {
        state.squarePersonalizations[squareNumber - 1] = [
            personalization.version.toNumber(),
            state.underlayPersonalizations[squareNumber - 1].title,
            state.underlayPersonalizations[squareNumber - 1].href,
            event.blockNumber,
        ];        
    }
    publishMetadataJson(squareNumber, state.squarePersonalizations[squareNumber - 1][1]);
    paintSuSquare(squareNumber, Buffer.from(personalization.rgbData.substr(2), "hex"), true);
};

// Save checkpoint /////////////////////////////////////////////////////////////
state.startBlock = endBlock;
fs.writeFileSync("build/squarePersonalizations.json", JSON.stringify(state.squarePersonalizations));
fs.writeFileSync("build/resume.json", JSON.stringify(state));
fs.writeFileSync("build/loadedTo.json", JSON.stringify(state.startBlock));
await saveWholeSuSquare();