/**
 * (c) Su & William Entriken, released under MIT license
 * 
 * Create ERC-721 metadata images showing 10,000 Squares before personalization
 *
 * - build/metadata/[00001-10000].svg (OUTPUT)
 * - build/metadata/[00001-10000].json (OUTPUT)
 */

import fs from "fs";
import { publishMetadataJson } from "./libs/metadata.mjs";
import { publishEmptySquareImage } from "./libs/image-processing.mjs";
import cliProgress from "cli-progress";
const METADATA_DIR = "./build/metadata";
const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
bar.start(10000, 0);

fs.mkdirSync(METADATA_DIR, { recursive: true });

for (let squareNumber=1; squareNumber<=10000; squareNumber++) {
    bar.increment();
    publishMetadataJson(squareNumber);
    publishEmptySquareImage(squareNumber);
}

bar.stop();