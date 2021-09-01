const fs = require("fs");
const { ethers } = require("ethers");
const chalk = require("chalk");
const config = require("./config.json");
const imageProcessing = require("./image-processing");
const { start } = require("repl");
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

// Variables ///////////////////////////////////////////////////////////////////
if (!fs.existsSync("./build/metadata")){
    fs.mkdirSync("./build/metadata", { recursive: true });
}
var allData = Array(NUM_SQUARES).fill(null);
var background = "./assets/empty-board.png";
var startBlock = config.startBlock;

if (progress) {
    console.log(chalk.blue("Resuming from:        ") + progress.processedBlock);
    background = "./build/wholeSquare.png";
    startBlock = progress.processedBlock;
}

imageProcessing.loadMillionPixelBase(background);

// Main program, synchronous ///////////////////////////////////////////////////
(async function() {
    // Which Squares to process? ///////////////////////////////////////////////
    // Set up loading range
    const currentBlock = await provider.getBlockNumber();
    console.log(chalk.blue("Current block:        ") + currentBlock);

    // How many blocks to process?
    const numberOfBlocksToProcess = parseInt(process.argv[process.argv.length - 1])
        ? parseInt(process.argv[process.argv.length - 1])
        : 1;
    const endBlock = startBlock + numberOfBlocksToProcess;
    console.log(chalk.blue("Loading to:           ") + endBlock);

    // Which personalized...
    const filterPersonalized = suSquaresContract.filters.Personalized();
    const personalized = await suSquaresContract.queryFilter(filterPersonalized, startBlock, endBlock).then(events => {
        return events.map(event => event.args.squareNumber);
    });
    console.log(chalk.blue("Personalized Squares: ") + personalized);
    
    // Which were transferred from the contract (i.e. "minted")...
    const filterTransferFromContract = suSquaresContract.filters.Transfer(config.account, null, null);
    const transferFromContract = await suSquaresContract.queryFilter(filterTransferFromContract, startBlock, endBlock).then(events => {
        return events.map(event => event.args.squareNumber);
    });
    console.log(chalk.blue("Transferred Squares:  ") + transferFromContract);
    
    const touchedSquares = [...new Set([].concat(personalized, transferFromContract))];
    touchedSquares.sort();
    console.log(chalk.blue("Touched:              ") + touchedSquares);
    console.log(chalk.yellow("NUMBER OF SQUARES TOUCHED: ") + touchedSquares.length + "\n\n");

    if (touchedSquares.length > 500) {
        console.log(chalk.red("TOO MANY SQUARES TO PROCESS"));
        process.exit();
    }

    // Launch per-Square processing jobs (in parallel) /////////////////////////
    let squareProcessing = Promise.all(touchedSquares.map(squareNumber => {
        // console.log(chalk.blue("Processing Square:    ") + squareNumber.toString());

        return suSquaresContract.suSquares(squareNumber).then(result => {
            const paddedSquareNumber = ("00000" + squareNumber).slice(-5);
            console.log(chalk.green("Got blockchain state for Square: ") + squareNumber.toString());
            
            // Save for squarePersonalizations.json
            allData[squareNumber - 1] = [result.version, result.title, result.href];
    
            // Build ERC-721 metadata JSON file
            const erc721Object = {
                "name": "Square #" + paddedSquareNumber,
                "description": result.title ? result.title : "",
                "image": "https://tenthousandsu.com/erc721/" + paddedSquareNumber + ".png"
            };
            fs.writeFileSync("build/metadata/" + paddedSquareNumber + ".json", JSON.stringify(erc721Object));
    
            // If the square is personalized then save image data
            if (result.rgbData.length === (2 + 300*2)) {
                const rgbData = Buffer.from(result.rgbData.substr(2), "hex");
                imageProcessing.overlaySquarePersonalization(squareNumber, rgbData);
            } else {
                imageProcessing.markSquareAsNotPersonalized(squareNumber);
            }
        });
    }));

    // Wait for all to complete ////////////////////////////////////////////////
    squareProcessing.then(() => {
        imageProcessing.saveImage("build/wholeSquare.png");
        fs.writeFileSync("build/squarePersonalizations.json", JSON.stringify(allData));
        fs.writeFileSync("build/progress.json", JSON.stringify({processedBlock: endBlock}));

        // TODO: Print time timestamp and ISO 8601
        process.exit();
    });    
}());