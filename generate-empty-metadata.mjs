/**
 * Su Squares (c) 2022 Su & William Entriken
 * 
 * Create ERC-721 metadata images showing 10,000 Squares before personalization
 *
 * - build/metadata/[00001-10000].svg (OUTPUT)
 * - build/metadata/[00001-10000].png (OUTPUT)
 * - build/metadata/[00001-10000].json (OUTPUT)
 */

import fs from "fs";
import { publishMetadataJson } from "./libs/metadata.mjs";
import { publishEmptySquareImage } from "./libs/image-processing.mjs";
const METADATA_DIR = "./build/metadata";

fs.mkdirSync(METADATA_DIR, { recursive: true });

for (let squareNumber=1; squareNumber<=10000; squareNumber++) {
    console.log(`Generating ${squareNumber}`);
    await publishMetadataJson(squareNumber);
    publishEmptySquareImage(squareNumber);
}