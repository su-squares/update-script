/**
 * Su Squares Updates
 * (c) Su & William Entriken, released under MIT license
 *
 * Create ERC-721 images showing 10,000 Squares before personalization
 */

import fs from "fs";
import { row, column, manhattanDistanceToCenter } from "./geometry.mjs";
const METADATA_DIR = "./build/metadata";

function numberOfPrimeDivisorsCountedWithMultiplicity(integer) {
    let count = 0;
    let divisor = 2;
    while (integer > 1) {
        if (integer % divisor === 0) {
            count += 1;
            integer /= divisor;
        } else {
            divisor += 1;
        }
    }
    return count;
}

function palindromeClassification(integer) {
    const str = integer.toString();
    // If all digits are the same
    if (str.split("").every(digit => digit === str[0])) {
        return "ALL SAME DIGIT";
    }
    // If palindrome
    if (str === str.split("").reverse().join("")) {
        return "PALINDROME";
    }
    return "NOT A PALINDROME";
}

/**
 * Publish a personalization to TenThousandSu.com
 * @param {Number} squareNumber
 * @param {String} title
 */
function publishMetadataJson(squareNumber, title="Available for sale") {
    const paddedSquareNumber = ("00000" + squareNumber).slice(-5);
    const metadata = {
        name: `Square #${squareNumber}`,
        description: title,
        image: `https://tenthousandsu.com/erc721/${paddedSquareNumber}.svg`,
        external_url: `https://tenthousandsu.com/square#${paddedSquareNumber}`,
        attributes: [
            {
                trait_type: "Row",
                value: row(squareNumber),
            }, {
                trait_type: "Column",
                value: column(squareNumber),
            }, {
                trait_type: "Manhattan distance to center",
                value: manhattanDistanceToCenter(squareNumber),
            }, {
                trait_type: "Prime divisors",
                value: numberOfPrimeDivisorsCountedWithMultiplicity(squareNumber),
            }, {
                trait_type: "Palindrome",
                value: palindromeClassification(squareNumber),
            }
        ],
    };
    const metadataFile = METADATA_DIR + "/" + paddedSquareNumber + ".json";
    fs.writeFileSync(metadataFile, JSON.stringify(metadata));
}

export { publishMetadataJson };