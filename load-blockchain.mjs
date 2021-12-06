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
 * - build/squares-rgb (OUTPUT)
 *   24-bit red-green-blue image data to add to the whole square
 */

import fs from "fs";
import { ethers } from "ethers";
import chalk from "chalk";
const config = JSON.parse(fs.readFileSync("./config.json"));
const NUM_SQUARES = 10000;
const provider = new ethers.providers.JsonRpcProvider(config.provider);
const numberOfBlocksToProcess = parseInt(process.argv[process.argv.length - 1])
    ? parseInt(process.argv[process.argv.length - 1])
    : 1;
const nonpersonalizedPixelData = Buffer.from("E6".repeat(300), "hex"); // Gray
const blackPixelData = Buffer.from("00".repeat(300), "hex"); // Black


// State, load checkpoint //////////////////////////////////////////////////////
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
fs.mkdirSync("./build/metadata", { recursive: true });
fs.mkdirSync("./build/squares-rgb", { recursive: true });


// Contracts ///////////////////////////////////////////////////////////////////
const suSquares = {
    address: "0xE9e3F9cfc1A64DFca53614a0182CFAD56c10624F",
    abi: [
        "function suSquares(uint256 squareNumber) view returns (uint256 version, bytes rgbData, string title, string href)",
        "event Personalized(uint256 squareNumber)",
        "event Transfer(address indexed from, address indexed to, uint256 indexed squareNumber)"
    ]
};
suSquares.contract = new ethers.Contract(suSquares.address, suSquares.abi, provider);

const underlay = {
    address: "0x992bDEC05cD423B73085586f7DcbbDaB953E0DCd",
    abi: [
        "event PersonalizedUnderlay(uint256 indexed squareNumber, bytes rgbData, string title, string href)"
    ]
};
underlay.contract = new ethers.Contract(underlay.address, underlay.abi, provider);


// Main program, synchronous ///////////////////////////////////////////////////
function personalize(squareNumber, version, title, href, blockNumber, pixelBuffer) {
    const paddedSquareNumber = ("00000" + squareNumber).slice(-5);
    state.squarePersonalizations[squareNumber - 1] = [
        version,
        title,
        href,
        blockNumber
    ];
    fs.writeFileSync(
        "./build/metadata/" + paddedSquareNumber + ".json",
        JSON.stringify({
            "name": "Square #" + paddedSquareNumber,
            "description": title,
            "image": "https://tenthousandsu.com/erc721/" + paddedSquareNumber + ".png"
        })
    );
    fs.writeFileSync("./build/squares-rgb/" + paddedSquareNumber + ".rgb", pixelBuffer);
}

const currentBlock = await provider.getBlockNumber();
const endBlock = Math.min(state.startBlock + numberOfBlocksToProcess, currentBlock);
console.log(chalk.blue("Loading to:           ") + endBlock);
console.log(chalk.blue("Current block:        ") + currentBlock);

const filterSold = suSquares.contract.filters.Transfer(suSquares.address, null, null);
const sold = await suSquares.contract.queryFilter(filterSold, state.startBlock, endBlock);

const filterPersonalized = suSquares.contract.filters.Personalized();
const personalized = await suSquares.contract.queryFilter(filterPersonalized, state.startBlock, endBlock);

const filterUnderlay = underlay.contract.filters.PersonalizedUnderlay();
const personalizedUnderlay = await underlay.contract.queryFilter(filterUnderlay, state.startBlock, endBlock);

for (const event of sold) {
    const squareNumber = event.args.squareNumber;
    console.log("Sold: " + squareNumber.toString());
    personalize(
        event.args.squareNumber,
        0,
        "",
        "",
        event.blockNumber,
        nonpersonalizedPixelData
    );
}

for (const event of personalizedUnderlay) {
    const squareNumber = event.args.squareNumber;
    console.log("Underlay: " + squareNumber.toString());
    state.underlayPersonalizations[squareNumber - 1] = {
        rgbData: event.args.rgbData.substr(2),
        title: event.args.title,
        href: event.args.href
    }
    if (state.originalIsBlank[squareNumber - 1]) {
        personalize(
            event.args.squareNumber,
            state.squarePersonalizations[squareNumber - 1][0],
            event.args.title,
            event.args.href,
            event.blockNumber,
            Buffer.from(event.args.rgbData.substr(2), "hex")
        );
    }
}

for await (const event of personalized) {
    const squareNumber = event.args.squareNumber;
    console.log("Personalized: " + squareNumber.toString());
    const personalization = await suSquares.contract.suSquares(squareNumber);
    state.originalIsBlank[squareNumber - 1] = (
        personalization.rgbData.substr(2).toUpperCase() === blackPixelData.toString("hex").toUpperCase() &&
        personalization.title === "" &&
        personalization.href === ""
    );
    if (state.originalIsBlank[squareNumber - 1]) {
        personalize(
            event.args.squareNumber,
            personalization.version.toNumber(),
            state.underlayPersonalizations[squareNumber - 1].title,
            state.underlayPersonalizations[squareNumber - 1].href,
            event.blockNumber,
            Buffer.from(state.underlayPersonalizations[squareNumber - 1].rgbData, "hex")
        );
    } else {
        personalize(
            event.args.squareNumber,
            personalization.version.toNumber(),
            personalization.title,
            personalization.href,
            event.blockNumber,
            Buffer.from(personalization.rgbData.substr(2), "hex")
        );
    }
};

// Save checkpoint /////////////////////////////////////////////////////////////
state.startBlock = endBlock;
fs.writeFileSync("build/squarePersonalizations.json", JSON.stringify(state.squarePersonalizations));
fs.writeFileSync("build/resume.json", JSON.stringify(state));