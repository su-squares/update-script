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

const fs = require("fs");
const { ethers, utils } = require("ethers");
const chalk = require("chalk");
const config = require("./config.json");
const { start } = require("repl");
const NUM_SQUARES = 10000;
const provider = new ethers.providers.JsonRpcProvider(config.provider);
const numberOfBlocksToProcess = parseInt(process.argv[process.argv.length - 1])
    ? parseInt(process.argv[process.argv.length - 1])
    : 1;
const nonpersonalizedPixelData = Buffer.from("E6".repeat(300), "hex"); // Gray
const blackPixelData = Buffer.from("00".repeat(300), "hex"); // Black

// State, load checkpoint //////////////////////////////////////////////////////
var state = {
    startBlock: 6645906, // The contract deployment
    squarePersonalizations: Array(NUM_SQUARES).fill(null), // null | [version, title, href]
    originalIsBlank: Array(NUM_SQUARES).fill(true),
    underlayPersonalizations: Array(NUM_SQUARES).fill({rgbData: blackPixelData.toString("hex"), title:"", href:""}),
};
if (fs.existsSync("./build/resume.json")) {
    state = require("./build/resume.json");
    console.log(chalk.blue("Resuming from:        ") + state.startBlock);
}
fs.mkdirSync("./build/metadata", { recursive: true });
fs.mkdirSync("./build/squares-rgb", { recursive: true });

// Contracts ///////////////////////////////////////////////////////////////////
// Su Squares
const suSquaresAddress = "0xE9e3F9cfc1A64DFca53614a0182CFAD56c10624F";
const suSquaresABI = [
    "function suSquares(uint256 squareNumber) view returns (uint256 version, bytes rgbData, string title, string href)",
    "event Personalized(uint256 squareNumber)",
    "event Transfer(address indexed from, address indexed to, uint256 indexed squareNumber)"
];
const suSquaresContract = new ethers.Contract(suSquaresAddress, suSquaresABI, provider);

// Underlay
const underlayAddress = "0x992bDEC05cD423B73085586f7DcbbDaB953E0DCd";
const underlayABI = [
    "event PersonalizedUnderlay(uint256 indexed squareNumber, bytes rgbData, string title, string href)"
];
const underlayContract = new ethers.Contract(underlayAddress, underlayABI, provider);

// Main program, synchronous ///////////////////////////////////////////////////
function writeMetadata(squareNumber, paddedSquareNumber){
    fs.writeFileSync(
        "./build/metadata/" + paddedSquareNumber + ".json",
        JSON.stringify({
            "name": "Square #" + paddedSquareNumber,
            "description": state.squarePersonalizations[squareNumber - 1][1],
            "image": "https://tenthousandsu.com/erc721/" + paddedSquareNumber + ".png"
        })
    );
}

(async () => {
    // Which blocks to process? ////////////////////////////////////////////////
    const currentBlock = await provider.getBlockNumber();
    const endBlock = Math.min(state.startBlock + numberOfBlocksToProcess, currentBlock);
    console.log(chalk.blue("Loading to:           ") + endBlock);
    console.log(chalk.blue("Current block:        ") + currentBlock);

    // Handle Squares which were transferred from the contract (sold)...
    const filterSold = suSquaresContract.filters.Transfer(config.account, null, null);
    await suSquaresContract.queryFilter(filterSold, state.startBlock, endBlock).then(events => {
        events.forEach(event => {
            const squareNumber = event.args.squareNumber;
            const paddedSquareNumber = ("00000" + squareNumber).slice(-5);
            state.squarePersonalizations[squareNumber - 1] = ["0", "", ""];
            writeMetadata(squareNumber, paddedSquareNumber);
            fs.writeFileSync("./build/squares-rgb/" + paddedSquareNumber + ".rgb", nonpersonalizedPixelData);
            console.log("Sold: " + squareNumber.toString());
        });
    });

    const events = await provider.send('eth_getLogs', [{
        address: [
            suSquaresContract.address,
            underlayContract.address,
        ],
        fromBlock: ethers.BigNumber.from(state.startBlock).toHexString(),
        toBlock: ethers.BigNumber.from(endBlock).toHexString(),
        topics: [
            [ // topic[0]
                suSquaresContract.filters.Personalized().topics[0],
                underlayContract.filters.PersonalizedUnderlay().topics[0],
            ]
        ]
    }]);

    for (let i=0; i<events.length; i++) {
        const event = events[i];
        if (
            utils.getAddress(event.address) === suSquaresContract.address &&
            event.topics[0] === suSquaresContract.filters.Personalized().topics[0]
        ) {
            const decodedEvent = suSquaresContract.interface.decodeEventLog(
                "Personalized", // Maybe there is a way more semantic way to specify this
                event.data,
                event.topics
            );
            const squareNumber = decodedEvent.squareNumber;
            const paddedSquareNumber = ("00000" + squareNumber).slice(-5);
            const personalization = await suSquaresContract.suSquares(squareNumber);
            state.originalIsBlank[squareNumber - 1] = (
                personalization.rgbData.substr(2).toUpperCase() === blackPixelData.toString("hex").toUpperCase() &&
                personalization.title === "" &&
                personalization.href === ""
            );
            if (state.originalIsBlank[squareNumber - 1]) {
                state.squarePersonalizations[squareNumber - 1] = [
                    personalization.version,
                    state.underlayPersonalizations[squareNumber - 1].title,
                    state.underlayPersonalizations[squareNumber - 1].href,
                ];
                fs.writeFileSync(
                    "./build/squares-rgb/" + paddedSquareNumber + ".rgb",
                    Buffer.from(state.underlayPersonalizations[squareNumber - 1].rgbData, "hex"),
                );
            } else {
                state.squarePersonalizations[squareNumber - 1] = [
                    personalization.version,
                    personalization.title,
                    personalization.href,
                ];
                fs.writeFileSync(
                    "./build/squares-rgb/" + paddedSquareNumber + ".rgb",
                    Buffer.from(personalization.rgbData.substr(2), "hex"),
                );
            }
            writeMetadata(squareNumber, paddedSquareNumber);
            console.log("Personalized: " + squareNumber.toString());
        } else if (
            utils.getAddress(event.address) === underlayContract.address &&
            event.topics[0] === underlayContract.filters.PersonalizedUnderlay().topics[0]
        ){
            console.log("Underlay -- PersonalizedUnderlay");
            const decodedEvent = underlayContract.interface.decodeEventLog(
                "PersonalizedUnderlay", // Maybe there is a way more semantic way to specify this
                event.data,
                event.topics
            );
            const squareNumber = decodedEvent.squareNumber;
            const paddedSquareNumber = ("00000" + squareNumber).slice(-5);
            state.underlayPersonalizations[squareNumber - 1] = {
                rgbData: decodedEvent.rgbData.substr(2),
                title: decodedEvent.title,
                href: decodedEvent.href,
            }
            if (state.originalIsBlank[squareNumber - 1]) {
                state.squarePersonalizations[squareNumber - 1] = [
                    state.squarePersonalizations[squareNumber - 1][0],
                    state.underlayPersonalizations[squareNumber - 1].title,
                    state.underlayPersonalizations[squareNumber - 1].href,
                ];
                fs.writeFileSync(
                    "./build/squares-rgb/" + paddedSquareNumber + ".rgb",
                    Buffer.from(state.underlayPersonalizations[squareNumber - 1].rgbData, "hex"),
                );
                writeMetadata(squareNumber, paddedSquareNumber);
            }
            console.log("Underlay: " + squareNumber.toString());
        } else {
            throw new Error("Unexpected event address or topic");
        }
    }

    // Save checkpoint /////////////////////////////////////////////////////////
    state.startBlock = endBlock;
    fs.writeFileSync("build/squarePersonalizations.json", JSON.stringify(state.squarePersonalizations));
    fs.writeFileSync("build/resume.json", JSON.stringify(state));
    process.exit();
})();