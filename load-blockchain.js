/**
 * Su Squares Blockchain Loaded
 * (c) 2018 Su & William Entriken
 * 
 * Load updated state from blockchain into image and metadata files.
 * 
 * - build/progress.json (INPUT / OUTPUT)
 *   The latest processed block (if present)
 * - build/squarePersonalizations.json (INPUT / OUTPUT)
 *   An accounting of the 10,000 Square personalizations
 * - build/metadata/#####.json (OUTPUT)
 *   ERC-721 metadata file for each modified Square
 * - build/squares-rgb (OUTPUT)
 *   24-bit red-gree-blue image data to add to the whole square
 */

const fs = require("fs");
const { ethers } = require("ethers");
const chalk = require("chalk");
const config = require("./config.json");
const progress = fs.existsSync("./build/progress.json")
    ? require("./build/progress.json")
    : null; 

// Setup ///////////////////////////////////////////////////////////////////////
const provider = new ethers.providers.JsonRpcProvider(config.provider);
const suSquaresABI = [
    // Get square data
    "function suSquares(uint256 squareNumber) view returns (uint256 version, bytes rgbData, string title, string href)",
  
    // Events that affect visual representation of square
    "event Personalized(uint256 squareNumber)",
    "event Transfer(address indexed from, address indexed to, uint256 indexed squareNumber)"
];
const suSquaresContract = new ethers.Contract(config.account, suSquaresABI, provider);
const NUM_SQUARES = 10000;
const numberOfBlocksToProcess = parseInt(process.argv[process.argv.length - 1])
    ? parseInt(process.argv[process.argv.length - 1])
    : 1;
const notPersonalizedSquareRGB = fs.readFileSync("./assets/not-personalized-square.rgb");

fs.mkdirSync("./build/metadata", { recursive: true });
fs.mkdirSync("./build/squares-rgb", { recursive: true });

// Variables ///////////////////////////////////////////////////////////////////
var startBlock = config.startBlock;
var squarePersonalizations = Array(NUM_SQUARES).fill(null);

// Read checkpoint /////////////////////////////////////////////////////////////
if (progress) {
    console.log(chalk.blue("Resuming from:        ") + progress.processedBlock);
    startBlock = progress.processedBlock;
    squarePersonalizations = require("./build/squarePersonalizations.json");
}

// Main program, synchronous ///////////////////////////////////////////////////
(async () => {
    // Which blocks to process? ////////////////////////////////////////////////
    const currentBlock = await provider.getBlockNumber();
    console.log(chalk.blue("Current block:        ") + currentBlock);
    const endBlock = Math.min(startBlock + numberOfBlocksToProcess, currentBlock);
    console.log(chalk.blue("Loading to:           ") + endBlock);

    // Handle Squares which were transferred from the contract (minted)...
    const filterMinted = suSquaresContract.filters.Transfer(config.account, null, null);
    await suSquaresContract.queryFilter(filterMinted, startBlock, endBlock).then(events => {
        events.forEach(event => {
            const squareNumber = event.args.squareNumber;
            const paddedSquareNumber = ("00000" + squareNumber).slice(-5);

            squarePersonalizations[squareNumber - 1] = ["0", "", ""];
            const erc721Object = {
                "name": "Square #" + paddedSquareNumber,
                "description": "",
                "image": "https://tenthousandsu.com/erc721/" + paddedSquareNumber + ".png"
            };
            fs.writeFileSync("./build/metadata/" + paddedSquareNumber + ".json", JSON.stringify(erc721Object));
            fs.writeFileSync("./build/squares-rgb/" + paddedSquareNumber + ".rgb", notPersonalizedSquareRGB);
            console.log("Minted: " + squareNumber.toString());    
        });
    });

    // Handle Squares which were personalized (which never preceds mint)...
    const filterPersonalized = suSquaresContract.filters.Personalized();
    const personalizationEvents = await suSquaresContract.queryFilter(filterPersonalized, startBlock, endBlock)
    for(var i=0; i<personalizationEvents.length; i++) {
        const event = personalizationEvents[i];
        const squareNumber = event.args.squareNumber;
        const paddedSquareNumber = ("00000" + squareNumber).slice(-5);

        const personalization = await suSquaresContract.suSquares(squareNumber);
        squarePersonalizations[squareNumber - 1] = [personalization.version, personalization.title, personalization.href];
        const erc721Object = {
            "name": "Square #" + paddedSquareNumber,
            "description": personalization.title ? personalization.title : "",
            "image": "https://tenthousandsu.com/erc721/" + paddedSquareNumber + ".png"
        };
        fs.writeFileSync("./build/metadata/" + paddedSquareNumber + ".json", JSON.stringify(erc721Object));
        const rgbData = Buffer.from(personalization.rgbData.substr(2), "hex");
        // assert(personalization.rgbData.length === 2 + 300*2)
        fs.writeFileSync("./build/squares-rgb/" + paddedSquareNumber + ".rgb", rgbData);
        console.log("Personalized: " + squareNumber.toString());
    }

    // Save checkpoint /////////////////////////////////////////////////////////
    fs.writeFileSync("build/squarePersonalizations.json", JSON.stringify(squarePersonalizations));
    fs.writeFileSync("build/progress.json", JSON.stringify({processedBlock: endBlock}));
    process.exit();
})();