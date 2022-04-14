/**
 * Su Squares Updates
 * (c) 2021 Su & William Entriken, released under MIT license
 *
 * Slice images from Squares into the complete image
 */

import fs from "fs";
import sharp from "sharp";
import exec from "child_process";
import { INDIVIDUAL_SQUARE_EDGE_PIXELS, row, column } from "./geometry.mjs";
const EMPTY_BOARD = "assets/empty-board.png";
const BUILT_BOARD = "build/wholeSquare.png";
const METADATA_DIR = "build/metadata";
const composites = [];

/**
 * Generate SVG image for an unpersonalized Square
 * @param {Number} squareNumber 
 * @returns String SVG data
 */
function svgForEmptySquare(squareNumber) {
    const paddedSquareNumber = ("00000" + squareNumber).slice(-5);
    return [
        `<svg width="800" height="1000" xmlns="http://www.w3.org/2000/svg">`,
        `<defs>`,
        `<linearGradient id="g" x1="0" x2="1" y1="0" y2="1">`,
        `<stop offset="0%" stop-color="#2d3c96"/>`,
        `<stop offset="100%" stop-color="#d53392"/>`,
        `</linearGradient>`,
        `</defs>`,
        `<rect x="10" y="10" width="780" height="980" fill="url(#g)" rx="50" ry="50" stroke="gold" stroke-width="20"/>`,
        `<text x="400" y="570" width="780" text-anchor="middle" style="font:bold 200px 'Helvetica Neue';fill:gold">${paddedSquareNumber}</text>`,
        `</svg>`,
    ].join("");
}

/**
 * Generate SVG image for a personalized Square
 * @param {Number} squareNumber 
 * @param {Buffer} rgbData 
 * @returns 
 */
function svgForSquareWithRGBData(squareNumber, rgbData) {
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
    return [
        `<svg width="800" height="1000" xmlns="http://www.w3.org/2000/svg">`,
        `<defs>`,
        `<linearGradient id="g" x1="0" x2="1" y1="0" y2="1">`,
        `<stop offset="0%" stop-color="#2d3c96"/>`,
        `<stop offset="100%" stop-color="#d53392"/>`,
        `</linearGradient>`,
        `</defs>`,
        `<rect x="10" y="10" width="780" height="980" fill="url(#g)" rx="50" ry="50" stroke="gold" stroke-width="20"/>`,
        `<text x="400" y="920" width="780" text-anchor="middle" style="font:bold 200px 'Helvetica Neue';fill:gold">${paddedSquareNumber}</text>`,
        `<g transform="translate(80 80) scale(64)">`,
        ...svgPixels,
        `</g>`,
        `</svg>`,
    ].join("");
}

/**
 * Publish SVG and PNG images to the metadata folder
 * @param {Number} squareNumber 
 */
function publishEmptySquareImage(squareNumber) {
    const paddedSquareNumber = ("00000" + squareNumber).slice(-5);
    const svg = svgForEmptySquare(squareNumber);
    fs.writeFileSync(`${METADATA_DIR}/${paddedSquareNumber}.svg`, svg);
    exec.execSync(`cairosvg ${METADATA_DIR}/${paddedSquareNumber}.svg -o ${METADATA_DIR}/${paddedSquareNumber}.png`);
    exec.execSync(`pngquant ${METADATA_DIR}/${paddedSquareNumber}.png --ext .png --force --strip`);
}

/**
 * Publish SVG and PNG images to the metadata folder
 * @param {Number} squareNumber 
 * @param {Buffer} rgbData}
 */
function publishSquareImageWithRGBData(squareNumber, rgbData) {
    const paddedSquareNumber = ("00000" + squareNumber).slice(-5);
    const svg = svgForSquareWithRGBData(squareNumber, rgbData);
    fs.writeFileSync(`${METADATA_DIR}/${paddedSquareNumber}.svg`, svg);
    exec.execSync(`cairosvg ${METADATA_DIR}/${paddedSquareNumber}.svg -o ${METADATA_DIR}/${paddedSquareNumber}.png`);
    exec.execSync(`pngquant ${METADATA_DIR}/${paddedSquareNumber}.png --ext .png --force --strip`);
}

/**
 * @param {Number} squareNumber 
 * @param {Buffer} rgbData 
 * @param {Boolean} generateMetadataImage
 */
function paintSuSquare(squareNumber, rgbData, publishMetadataImage) {
    const zeroBasedColumn = column(squareNumber) - 1;
    const zeroBasedRow = row(squareNumber) - 1;

    composites.push({
        input: rgbData,
        raw: { width: INDIVIDUAL_SQUARE_EDGE_PIXELS, height: INDIVIDUAL_SQUARE_EDGE_PIXELS, channels: 3 },
        left: INDIVIDUAL_SQUARE_EDGE_PIXELS * zeroBasedColumn,
        top: INDIVIDUAL_SQUARE_EDGE_PIXELS * zeroBasedRow,
    });
    if (publishMetadataImage) {
        publishSquareImageWithRGBData(squareNumber, rgbData);
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

export { paintSuSquare, saveWholeSuSquare, publishEmptySquareImage, publishSquareImageWithRGBData };