'use strict';

const sharp = require('sharp');

var basefilename = null;
var composites = [];

function loadMillionPixelBase(newFilename) {
  basefilename = newFilename;
};

function markSquareAsNotPersonalized(squareNumber) {
  const zeroBasedColumn = (squareNumber - 1) % 100;
  const zeroBasedRow = Math.floor((squareNumber - 1) / 100);

  composites.push({
    input: 'assets/one-gray-square.png',
    left: 10 * zeroBasedColumn,
    top: 10 * zeroBasedRow,
  });
}

function overlaySquarePersonalization(squareNumber, rgbData) {
  const zeroBasedColumn = (squareNumber - 1) % 100;
  const zeroBasedRow = Math.floor((squareNumber - 1) / 100);

  composites.push({
    input: rgbData,
    raw: {width: 10, height: 10, channels: 3},
    left: 10 * zeroBasedColumn,
    top: 10 * zeroBasedRow,
  });
}

function saveImage(outputFilename) {
  return sharp(basefilename)
    .composite(composites)
    .toFile(outputFilename);
}

module.exports = {
  loadMillionPixelBase,
  markSquareAsNotPersonalized,
  overlaySquarePersonalization,
  saveImage,
};