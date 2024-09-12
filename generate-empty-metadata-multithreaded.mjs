/**
 * Su Squares (c) Su & William Entriken
 * 
 * Create ERC-721 metadata images showing 10,000 Squares before personalization
 *
 * - build/metadata/[00001-10000].svg (OUTPUT)
 * - build/metadata/[00001-10000].json (OUTPUT)
 */

import fs from "fs";
import { publishMetadataJson } from "./libs/metadata.mjs";
import { publishEmptySquareImage } from "./libs/image-processing.mjs";
import { Worker, isMainThread, parentPort } from "worker_threads";
import { cpus } from 'os';
import cliProgress from "cli-progress";

const METADATA_DIR = "./build/metadata";
const numCPUs = cpus().length;
const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
bar.start(10000, 0);

if (isMainThread) {
    fs.mkdirSync(METADATA_DIR, { recursive: true });
    let numActiveThreads = 0;
    const workQueue = Array.from({ length: 10000 }, (_, i) => i + 1); // Create an array [1, 2, ..., 10000]
    
    for (let cpuIndex = 0; cpuIndex < numCPUs; cpuIndex++) {
        if (workQueue.length > 0) {
            const worker = new Worker(import.meta.url, { type: 'module' });
            
            worker.on("message", () => {
                bar.increment();
                if (workQueue.length > 0) {
                    worker.postMessage(workQueue.shift());
                } else {
                    numActiveThreads--;
                    if (numActiveThreads === 0) {
                        bar.stop();
                        process.exit(0);
                    }
                }
            });

            worker.on("error", (err) => {
                console.error(`Worker encountered an error: ${err.message}`);
                process.exit(1);
            });

            worker.on("exit", (code) => {
                if (code !== 0) {
                    console.error(`Worker stopped with exit code ${code}`);
                    process.exit(1);
                }
            });

            worker.postMessage(workQueue.shift());
            numActiveThreads++;
        }
    }
} else {
    parentPort.on('message', (squareNumber) => {
        publishMetadataJson(squareNumber);
        publishEmptySquareImage(squareNumber);
        parentPort.postMessage(squareNumber);
    });
}