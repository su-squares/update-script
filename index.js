const fs = require("fs");
const { ethers } = require("ethers");
const config = require("./config.json");
const imageProcessing = require("./image-processing");
const { start } = require("repl");
const progress = fs.existsSync("./build/progress.json")
    ? require("./build/progress.json")
    : { };

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

if (progress.progress) {
    console.log("Resuming from " + progress.progress)
    background = "./build/wholeSquare.png";
    startBlock = progress.progress;
}

imageProcessing.loadMillionPixelBase(background);

// Which squares were touched? /////////////////////////////////////////////////
provider.getBlockNumber().then(blockNumber => {
    endBlock = startBlock + 50000; //------------------------------------------------------------TESTING THIS LINE
    console.log("Loading from " + startBlock + " to " + endBlock);

    // Personalized...
    const filterPersonalized = suSquaresContract.filters.Personalized();
    const personalized = suSquaresContract.queryFilter(filterPersonalized, startBlock, endBlock).then(events => {
        return events.map(event => event.args.squareNumber);
    });

    // Transferred...
    const filterTransferFromContract = suSquaresContract.filters.Transfer(config.account, null, null);
    const transferFromContract = suSquaresContract.queryFilter(filterTransferFromContract, startBlock, endBlock).then(events => {
        return events.map(event => event.args.squareNumber);
    });

    let touchedSquares = Promise.all([personalized, transferFromContract]).then(arrayOfArrayOfSquares => {
        return new Set([].concat(...arrayOfArrayOfSquares));
    });

    // Collect details on touched squares //////////////////////////////////////
    let squareProcessing = touchedSquares.then(touchedSquares => {
        return Promise.all([...touchedSquares].map(squareNumber => {
            console.log("Processing square:", squareNumber.toString());

            return suSquaresContract.suSquares(squareNumber).then(result => {
                console.log('got square ' + squareNumber.toString());
                // Save to the master JSON file
                allData[squareNumber - 1] = [result.version, result.title, result.href];
        
                let paddedSquareNumber = ("00000" + squareNumber).slice(-5);
                // Build ERC-721 metadata JSON file
                var erc721Object = {
                "name" : "Square #" + paddedSquareNumber,
                "description" : result ? result[2] : "",
                "image" : "https://tenthousandsu.com/erc721/" + paddedSquareNumber + ".png"
                };
                fs.writeFileSync("build/metadata/" + paddedSquareNumber + ".json", JSON.stringify(erc721Object));
        
                // If the square is personalized then save image data
                if (result && result.rgbData && result.rgbData.length === (2 + 300*2)) {
                    const rgbData = Buffer.from(result.rgbData.substr(2), "hex");
                    imageProcessing.overlaySquarePersonalization(squareNumber, rgbData);
                } else {
                    imageProcessing.markSquareAsNotPersonalized(squareNumber);
                }
            });
        }));
    });

    // Exit when complete
    squareProcessing.then((x) => {
        imageProcessing.saveImage("build/wholeSquare.png");
        fs.writeFileSync("build/progress.json", JSON.stringify( { progress: endBlock + 1 }));
        fs.writeFileSync("build/squarePersonalizations.json", JSON.stringify(allData));
        process.exit();
    });        
});
