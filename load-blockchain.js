const fs = require("fs");
const { ethers } = require("ethers");
const chalk = require("chalk");
const config = require("./config.json");
const progress = fs.existsSync("./build/progress.json")
    ? require("./build/progress.json")
    : null; 

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

fs.mkdirSync("./build/metadata", { recursive: true });
fs.mkdirSync("./build/squares-rgb", { recursive: true });

// Variables ///////////////////////////////////////////////////////////////////
var startBlock = config.startBlock;
var squarePersonalizations = Array(NUM_SQUARES).fill(null);

if (progress) {
    console.log(chalk.blue("Resuming from:        ") + progress.processedBlock);
    startBlock = progress.processedBlock;
    squarePersonalizations = require("./build/squarePersonalizations.json");
}

// Main program, synchronous ///////////////////////////////////////////////////
(async function() {
    // Which blocks to process? ////////////////////////////////////////////////
    const currentBlock = await provider.getBlockNumber();
    console.log(chalk.blue("Current block:        ") + currentBlock);
    const numberOfBlocksToProcess = parseInt(process.argv[process.argv.length - 1])
        ? parseInt(process.argv[process.argv.length - 1])
        : 1;
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

            console.log("Minted: " + squareNumber.toString());    
        });
    });

    // Handle Squares which were personalized...
    const filterPersonalized = suSquaresContract.filters.Personalized();
    const personalizationEvents = await suSquaresContract.queryFilter(filterPersonalized, startBlock, endBlock)
    for(var i=0; i<personalizationEvents.length; i++) {
        const event = personalizationEvents[i];
        const squareNumber = event.args.squareNumber;
        const paddedSquareNumber = ("00000" + squareNumber).slice(-5);

        const personalization = await suSquaresContract.suSquares(squareNumber);
        squarePersonalizations[squareNumber - 1] = [personalization.version, personalization.title, personalization.href];

        // assert(personalization.rgbData.length === 2 + 300*2)
        const rgbData = Buffer.from(personalization.rgbData.substr(2), "hex");
        fs.writeFileSync("build/squares-rgb/" + paddedSquareNumber+".rgb", rgbData);

        const erc721Object = {
            "name": "Square #" + paddedSquareNumber,
            "description": personalization.title ? personalization.title : "",
            "image": "https://tenthousandsu.com/erc721/" + paddedSquareNumber + ".png"
        };
        fs.writeFileSync("./build/metadata/" + paddedSquareNumber + ".json", JSON.stringify(erc721Object));

        console.log("Personalized: " + squareNumber.toString());    
    }

    // Save checkpoint /////////////////////////////////////////////////////////
    fs.writeFileSync("build/squarePersonalizations.json", JSON.stringify(squarePersonalizations));
    fs.writeFileSync("build/progress.json", JSON.stringify({processedBlock: endBlock}));
    process.exit();
}());