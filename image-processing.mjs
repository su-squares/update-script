"use strict";

import fs from "fs";
import sharp from "sharp";
import exec from "child_process";
const EMPTY_BOARD = "assets/empty-board.png";
const BUILT_BOARD = "build/wholeSquare.png";
const METADATA_IMAGE_DIR = "build/metadata";
const SQUARE_EDGE_PIXELS = 10;
const NUM_SQUARES_ON_EDGE = 100;

var composites = [];

/**
 * @param {Number} squareNumber 
 * @param {Buffer} rgbData 
 * @param {Boolean} generateMetadataImage
 */
function paintSuSquare(squareNumber, rgbData, generateMetadataImage) {
    const paddedSquareNumber = ("00000" + squareNumber).slice(-5);
    const zeroBasedColumn = (squareNumber - 1) % NUM_SQUARES_ON_EDGE;
    const zeroBasedRow = Math.floor((squareNumber - 1) / NUM_SQUARES_ON_EDGE);

    composites.push({
        input: rgbData,
        raw: { width: SQUARE_EDGE_PIXELS, height: SQUARE_EDGE_PIXELS, channels: 3 },
        left: SQUARE_EDGE_PIXELS * zeroBasedColumn,
        top: SQUARE_EDGE_PIXELS * zeroBasedRow,
    });
    if (generateMetadataImage) {
        const svgPixels = [];
        for (let x=0; x<10; x++) {
            for (let y=0; y<10; y++) {
                const pixelNum = y*10 + x;
                const rgbPixel = rgbData.slice(pixelNum*3, pixelNum*3+3);
                const rgbPixelHex = rgbPixel.toString("hex");
                svgPixels.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="#${rgbPixelHex}" />`+"\n");
            }
        }
        const svg = 
`<svg width="800" height="1000" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
      <linearGradient id="Gradient2" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="#2d3c96"/>
        <stop offset="100%" stop-color="#d53392"/>
      </linearGradient>
  </defs>
  <rect x="10" y="10" width="780" height="980" fill="url(#Gradient2)" rx="50" ry="50" stroke="#ffd700" stroke-width="20"/>
  <text x="400" y="920" width="780" text-anchor="middle" style="font: bold 200px 'Helvetica Neue'; fill: #ffd700">${paddedSquareNumber}</text>

  <g transform="translate(80 80) scale(64)">
${svgPixels}
  </g>
</svg>`
        fs.writeFileSync(`${METADATA_IMAGE_DIR}/${paddedSquareNumber}.svg`, svg);
        exec.execSync(`cairosvg ${METADATA_IMAGE_DIR}/${paddedSquareNumber}.svg -o ${METADATA_IMAGE_DIR}/${paddedSquareNumber}.png`);
    }
}

function saveWholeSuSquare() {
    const inputFile = fs.existsSync(BUILT_BOARD)
        ? BUILT_BOARD
        : EMPTY_BOARD;
    // Load file bytes because we are reading & writing the same file
    // see https://github.com/lovell/sharp/issues/2873
    const inputBuffer = fs.readFileSync(inputFile);
    return sharp(inputBuffer)
        .composite(composites)
        .toFile(BUILT_BOARD);
}

export { paintSuSquare, saveWholeSuSquare };