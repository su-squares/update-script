/**
 * Su Squares Updates
 * (c) Su & William Entriken, released under MIT license
 *
 * Slice images from Squares into the complete image
 */

import fs from "fs";
import sharp from "sharp";
import { INDIVIDUAL_SQUARE_EDGE_PIXELS, row, column } from "./geometry.mjs";
const EMPTY_BOARD = "assets/empty-board.png";
const BUILT_BOARD = "build/wholeSquare.png";
const METADATA_DIR = "build/metadata";
const composites = [];
const fontBase64 = fs.readFileSync("assets/Inter-bold-subset.txt", "utf-8");

/**
 * Publish SVG image for an unpersonalized Square to the metadata folder
 * @param {Number} squareNumber 
 */
function publishEmptySquareImage(squareNumber) {
    const paddedSquareNumber = ("00000" + squareNumber).slice(-5);
    const svg = [
        `<svg width="800" height="1000" xmlns="http://www.w3.org/2000/svg">`,
        `<defs>`,
        `<style>`,
        `@font-face {font-family:'Inter';src:url('data:font/woff2;base64,${fontBase64}')}`,
        `</style>`,
        `<linearGradient id="g" x1="0" x2="1" y1="0" y2="1">`,
        `<stop offset="0%" stop-color="#2d3c96"/>`,
        `<stop offset="100%" stop-color="#d53392"/>`,
        `</linearGradient>`,
        `</defs>`,
        `<rect x="10" y="10" width="780" height="980" fill="url(#g)" rx="50" ry="50" stroke="gold" stroke-width="20"/>`,
        `<text x="400" y="570" text-anchor="middle" style="font-family:'Inter';font-size:200px;fill:gold;">${paddedSquareNumber}</text>`,
        `</svg>`,
    ].join("");
    fs.writeFileSync(`${METADATA_DIR}/${paddedSquareNumber}.svg`, svg);
}

/**
 * Publish SVG image for a personalized Square to the metadata folder
 * @param {Number} squareNumber 
 * @param {Buffer} rgbData
 */
function publishSquareImageWithRGBData(squareNumber, rgbData) {
    const paddedSquareNumber = ("00000" + squareNumber).slice(-5);
    const svgPixels = [];
    for (let x=0; x<INDIVIDUAL_SQUARE_EDGE_PIXELS; x++) {
        for (let y=0; y<INDIVIDUAL_SQUARE_EDGE_PIXELS; y++) {
            const pixelNum = y*INDIVIDUAL_SQUARE_EDGE_PIXELS + x;
            const rgbPixel = rgbData.slice(pixelNum*3, pixelNum*3+3);
            const rgbPixelHex = rgbPixel.toString("hex");
            svgPixels.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="#${rgbPixelHex}" />`);
        }
    }
    const svg = [
        `<svg width="800" height="1000" xmlns="http://www.w3.org/2000/svg">`,
        `<defs>`,
        `<style>`,
        `@font-face {font-family:'Inter';src:url('data:font/woff2;base64,${fontBase64}')}`,
        `</style>`,
        `<linearGradient id="g" x1="0" x2="1" y1="0" y2="1">`,
        `<stop offset="0%" stop-color="#2d3c96"/>`,
        `<stop offset="100%" stop-color="#d53392"/>`,
        `</linearGradient>`,
        `</defs>`,
        `<rect x="10" y="10" width="780" height="980" fill="url(#g)" rx="50" ry="50" stroke="gold" stroke-width="20"/>`,
        `<text x="400" y="920" text-anchor="middle" style="font-family:'Inter';font-size:200px;fill:gold">${paddedSquareNumber}</text>`,
        `<g transform="translate(80 80) scale(64)">`,
        ...svgPixels,
        `</g>`,
        `</svg>`,
    ].join("");
    fs.writeFileSync(`${METADATA_DIR}/${paddedSquareNumber}.svg`, svg);
}

/**
 * @param {Number} squareNumber 
 * @param {Buffer} rgbData
 */
function paintSuSquare(squareNumber, rgbData) {
    const zeroBasedColumn = column(squareNumber) - 1;
    const zeroBasedRow = row(squareNumber) - 1;

    composites.push({
        input: rgbData,
        raw: { width: INDIVIDUAL_SQUARE_EDGE_PIXELS, height: INDIVIDUAL_SQUARE_EDGE_PIXELS, channels: 3 },
        left: INDIVIDUAL_SQUARE_EDGE_PIXELS * zeroBasedColumn,
        top: INDIVIDUAL_SQUARE_EDGE_PIXELS * zeroBasedRow,
    });
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

export { paintSuSquare, saveWholeSuSquare, publishEmptySquareImage, publishSquareImageWithRGBData };