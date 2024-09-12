/**
 * Su Squares Blockchain Loaded
 * (c) 2018 Su & William Entriken
 *
 * Load updated state from blockchain into image and metadata files.
 *
 * - build/loadedTo.json (INPUT / OUTPUT)
 *   The latest processed block (if present)
 * - build/squarePersonalizations.json (INPUT / OUTPUT)
 *   An accounting of the 10,000 Square personalizations
 * - build/squareExtra.json (INPUT / OUTPUT)
 *   Extra information about the 10,000 Squares
 * - build/underlayPersonalizations.json (INPUT / OUTPUT)
 *   An accounting of the 10,000 Square underlay personalizations, if set
 * - build/underlayIsVisible.json (INPUT / OUTPUT)
 *   Is each underlay square visible?
 * - build/metadata/#####.json (OUTPUT)
 *   ERC-721 metadata file for each modified Square
 * - build/metadata/#####.svg (OUTPUT)
 *   ERC-721 metadata image for each modified Square
 */

import fs from "fs";
import { ethers } from "ethers";
import chalk from "chalk";
import { paintSuSquare, saveWholeSuSquare, publishSquareImageWithRGBData } from "./libs/image-processing.mjs";
import { publishMetadataJson } from "./libs/metadata.mjs";
import { NUM_SQUARES } from "./libs/geometry.mjs";
import { suSquares, suSquaresDeploymentBlock, underlay } from "./libs/contracts.mjs";
const config = JSON.parse(fs.readFileSync("./config.json"));
const provider = new ethers.providers.JsonRpcProvider(config.provider);
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
    squarePersonalizations: Array(NUM_SQUARES).fill(null), // null | [version, title, href, updatedBlock]
    squareExtra: Array(NUM_SQUARES).fill(null), // null | [mintedBlock, updatedBlock, underlayIsVisibleBool]
    underlayPersonalizations: Array(NUM_SQUARES).fill(null), // null | [rgbData, title, href]
    underlayIsVisible: Array(NUM_SQUARES).fill(true), // true | false
};
if (fs.existsSync("./build/loadedTo.json")
    && fs.existsSync("./build/squarePersonalizations.json")
    && fs.existsSync("./build/squareExtra.json")
    && fs.existsSync("./build/underlayPersonalizations.json")
    && fs.existsSync("./build/underlayIsVisible.json")) { // Note: file is read from some published .html files on TenThousandsSu.com
    state.loadedTo = JSON.parse(fs.readFileSync("./build/loadedTo.json"));
    state.squarePersonalizations = JSON.parse(fs.readFileSync("./build/squarePersonalizations.json"));
    state.squareExtra = JSON.parse(fs.readFileSync("./build/squareExtra.json"));
    state.underlayPersonalizations = JSON.parse(fs.readFileSync("./build/underlayPersonalizations.json"));
    state.underlayIsVisible = JSON.parse(fs.readFileSync("./build/underlayIsVisible.json"));
}

const currentSettledBlock = await provider.getBlockNumber() - SETTLE_BLOCKS;
const endBlock = Math.min(state.loadedTo + numberOfBlocksToProcess, currentSettledBlock);
console.log(chalk.blue("Loading from:          ") + state.loadedTo);
console.log(chalk.blue("Loading to:            ") + endBlock);
console.log(chalk.blue("Current settled block: ") + currentSettledBlock);
fs.mkdirSync(METADATA_DIR, { recursive: true });


// Load events /////////////////////////////////////////////////////////////////
const suSquaresConnected = suSquares.connect(provider);
const underlayConnected = underlay.connect(provider);

const filterSold = suSquaresConnected.filters.Transfer(suSquares.address, null, null);
const sold = await suSquaresConnected.queryFilter(filterSold, state.loadedTo+1, endBlock);

const filterPersonalized = suSquaresConnected.filters.Personalized();
const personalized = await suSquaresConnected.queryFilter(filterPersonalized, state.loadedTo+1, endBlock);

const filterUnderlay = underlayConnected.filters.PersonalizedUnderlay();
const personalizedUnderlay = await underlayConnected.queryFilter(filterUnderlay, state.loadedTo+1, endBlock);


// Process events //////////////////////////////////////////////////////////////
for (const event of sold) {
    const squareNumber = event.args.squareNumber.toNumber();
    console.log("Sold: " + squareNumber.toString());
    state.squarePersonalizations[squareNumber - 1] = [
        0,                 // version
        "",                // title
        "",                // href
        event.blockNumber, // updatedBlock
    ];
    state.squareExtra[squareNumber - 1] = [
        event.blockNumber, // mintedBlock
        event.blockNumber, // updatedBlock
        true,              // underlayIsVisible
    ];
    publishMetadataJson(squareNumber, "");
    paintSuSquare(squareNumber, nonpersonalizedPixelData);
}

for (const event of personalizedUnderlay) {
    const squareNumber = event.args.squareNumber.toNumber();
    console.log("Underlay: " + squareNumber.toString());
    state.underlayPersonalizations[squareNumber - 1] = [
        event.args.rgbData.substr(2), // rgbData
        event.args.title,             // title
        event.args.href               // href
    ];
    state.squareExtra[squareNumber - 1] = [
        state.squareExtra[squareNumber - 1][0], // mintedBlock
        event.blockNumber,                      // updatedBlock
        state.squareExtra[squareNumber - 1][2], // underlayIsVisible
    ];
    if (state.underlayIsVisible[squareNumber - 1]) {
        state.squarePersonalizations[squareNumber - 1] = [
            state.squarePersonalizations[squareNumber - 1][0], // version
            event.args.title,                                  // title
            event.args.href,                                   // href
            event.blockNumber,                                 // updatedBlock
        ];
        publishMetadataJson(squareNumber, state.squarePersonalizations[squareNumber - 1][1]);
        paintSuSquare(squareNumber, Buffer.from(event.args.rgbData.substr(2), "hex"));
        publishSquareImageWithRGBData(squareNumber, Buffer.from(event.args.rgbData.substr(2), "hex"));
    }
}

for await (const event of personalized) {
    const squareNumber = event.args.squareNumber.toNumber();
    console.log("Personalized: " + squareNumber.toString());
    let {version, title, href, rgbData} = await suSquaresConnected.suSquares(squareNumber);
    
    state.underlayIsVisible[squareNumber - 1] = (
        rgbData.substr(2).toUpperCase() === blackPixelData.toString("hex").toUpperCase() &&
        title === "" &&
        href === ""
    );
    if (state.underlayIsVisible[squareNumber - 1]) {
        let underlayPersonalization = state.underlayPersonalizations[squareNumber - 1] ?? [blackPixelData.toString("hex"), "", ""];
        title = underlayPersonalization[1];
        href = underlayPersonalization[2];
        rgbData = "0x" + underlayPersonalization[0];
    }
    state.squarePersonalizations[squareNumber - 1] = [
        version.toNumber(),
        title,
        href,
        event.blockNumber,
    ];
    state.squareExtra[squareNumber - 1] = [
        state.squareExtra[squareNumber - 1][0],                              // mintedBlock
        Math.max(event.blockNumber, state.squareExtra[squareNumber - 1][1]), // updatedBlock
        state.underlayIsVisible[squareNumber - 1],                           // underlayIsVisible
    ];
    publishMetadataJson(squareNumber, state.squarePersonalizations[squareNumber - 1][1]);
    paintSuSquare(squareNumber, Buffer.from(rgbData.substr(2), "hex"));
    publishSquareImageWithRGBData(squareNumber, Buffer.from(rgbData.substr(2), "hex"));
};

// Save checkpoint /////////////////////////////////////////////////////////////
state.loadedTo = endBlock;
await saveWholeSuSquare();
fs.writeFileSync("./build/loadedTo.json", JSON.stringify(state.loadedTo));
fs.writeFileSync("./build/squarePersonalizations.json", JSON.stringify(state.squarePersonalizations));
fs.writeFileSync("./build/squareExtra.json", JSON.stringify(state.squareExtra));
fs.writeFileSync("./build/underlayPersonalizations.json", JSON.stringify(state.underlayPersonalizations));
fs.writeFileSync("./build/underlayIsVisible.json", JSON.stringify(state.underlayIsVisible));