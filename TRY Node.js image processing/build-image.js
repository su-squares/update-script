sharp will not build on M1 mac

const { rgb } = require("chalk");
const fs = require("fs");
const imageProcessing = require("./image-processing");

imageProcessing.loadMillionPixelBase("./assets/empty-board.png");

for (var squareNumber = 1; squareNumber <= 10000; squareNumber++) {
    const paddedSquareNumber = ("00000" + squareNumber).slice(-5);

    // Skip if no metadata
    if (!fs.existsSync("./build/metadata/" + paddedSquareNumber + ".json")) {
        continue;
    }

    if (fs.existsSync("./build/squares-rgb/" + paddedSquareNumber + ".rgb")) {
        const rgbData = fs.readFileSync("./build/squares-rgb/" + paddedSquareNumber + ".rgb");
        imageProcessing.overlaySquarePersonalization(squareNumber, rgbData);
    } else {
        imageProcessing.markSquareAsNotPersonalized(squareNumber);
    }
}

imageProcessing.saveImage("./build/wholeSquare.png");