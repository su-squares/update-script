/**
 * Su Squares (c) 2022 Su & William Entriken
 *
 * Requires: pip3 install cairosvg; brew install pngquant
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
import { Worker, isMainThread, parentPort } from "worker_threads";
import { cpus } from 'os';
const METADATA_DIR = "./build/metadata";
const numCPUs = cpus().length;

if (isMainThread) {
    fs.mkdirSync(METADATA_DIR, { recursive: true });
    let numActiveThreads = 0;
    const workQueue = [];
    for (let squareNumber=1; squareNumber<=10000; squareNumber++) {
        workQueue.push(squareNumber);
    }
    for (let cpu=0; cpu<numCPUs; cpu++) {
        if (workQueue.length > 0) {
            const worker = new Worker(new URL(import.meta.url));
            worker.on("message", squareNumber => {
                console.log(`Generated ${squareNumber}`);
                if (workQueue.length > 0) {
                    worker.postMessage(workQueue.shift());
                } else {
                    numActiveThreads--;
                    if (numActiveThreads === 0) {
                        process.exit(0);
                    }
                }
            });
            worker.postMessage(workQueue.shift());
            numActiveThreads++;
        }
    }
} else {
    parentPort.on('message', squareNumber => {
        publishMetadataJson(squareNumber);
        publishEmptySquareImage(squareNumber);
        parentPort.postMessage(squareNumber);
    });
}