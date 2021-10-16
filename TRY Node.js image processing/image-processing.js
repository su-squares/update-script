'use strict';

const fs = require("fs");
const sharp = require('sharp');

const SQUARE_EDGE_PIXELS = 10;
const NUM_SQUARES_ON_EDGE = 100;

var basefilename = null;
var composites = [];

function loadMillionPixelBase(newFilename) {
  basefilename = newFilename;
};

function markSquareAsNotPersonalized(squareNumber) {
  const zeroBasedColumn = (squareNumber - 1) % NUM_SQUARES_ON_EDGE;
  const zeroBasedRow = Math.floor((squareNumber - 1) / NUM_SQUARES_ON_EDGE);

  composites.push({
    input: 'assets/one-gray-square.png',
    left: SQUARE_EDGE_PIXELS * zeroBasedColumn,
    top: SQUARE_EDGE_PIXELS * zeroBasedRow,
  });
}

function overlaySquarePersonalization(squareNumber, rgbData) {
  const zeroBasedColumn = (squareNumber - 1) % NUM_SQUARES_ON_EDGE;
  const zeroBasedRow = Math.floor((squareNumber - 1) / NUM_SQUARES_ON_EDGE);

  composites.push({
    input: rgbData,
    raw: {width: SQUARE_EDGE_PIXELS, height: SQUARE_EDGE_PIXELS, channels: 3},
    left: SQUARE_EDGE_PIXELS * zeroBasedColumn,
    top: SQUARE_EDGE_PIXELS * zeroBasedRow,
  });
}

function saveImage(outputFilename) {
  const inputBuffer = fs.readFileSync(basefilename);

  if (composites.length > 0) { // https://github.com/lovell/sharp/issues/2872
    return sharp(inputBuffer)
      .composite(composites)
      .toFile(outputFilename);
  }
  return sharp(inputBuffer)
    .toFile(outputFilename);
}

module.exports = {
  loadMillionPixelBase,
  markSquareAsNotPersonalized,
  overlaySquarePersonalization,
  saveImage,
};