/**
 * (c) Su & William Entriken, released under MIT license
 *
 * Check if any updates occurred on-chain since loadedTo.json was saved.
 *
 * SYNOPSIS
 * node have-there-been-updates.mjs
 *
 * EXIT STATUS
 * 0  no new updates since loadedTo.json was saved
 * 2  new updates since loadedTo.json was saved
 * 1  failure, including an uncaught provider error
 *
 * Exit 2 is deliberate. Node already exits 1 when a provider call rejects
 * and nothing catches it. The website workflow treats only exit 2 as
 * "events found". Sharing exit 1 with a crash would start load-blockchain
 * after a failed scan.
 *
 * FAST_FORWARD=1
 * With no new events, write loadedTo.json forward to the settled block.
 * The website workflow sets this only after 6 weeks with no commit.
 */

import fs from "fs";
import { ethers } from "ethers";
import "dotenv/config";
import { suSquares, suSquaresDeploymentBlock, underlay } from "./libs/contracts.mjs";
import { queryFilterChunked, settledBlockNumber } from "./libs/logs.mjs";

function reportFatal(error) {
    console.error(error);
    process.exit(1);
}
process.on("unhandledRejection", reportFatal);
process.on("uncaughtException", reportFatal);

const loadedTo = fs.existsSync("./build/loadedTo.json")
    ? JSON.parse(fs.readFileSync("./build/loadedTo.json"))
    : suSquaresDeploymentBlock;
const provider = new ethers.JsonRpcProvider(process.env.PROVIDER_URL, 1, {
    staticNetwork: true,
    batchMaxCount: 1,
});
const settledBlock = await settledBlockNumber(provider);

// Load events /////////////////////////////////////////////////////////////////
const suSquaresConnected = suSquares.connect(provider);
const underlayConnected = underlay.connect(provider);

const fromBlock = loadedTo + 1;
const filterSold = suSquaresConnected.filters.Transfer(suSquares.getAddress(), null, null);
const filterPersonalized = suSquaresConnected.filters.Personalized();
const filterUnderlay = underlayConnected.filters.PersonalizedUnderlay();

const [soldEvents, personalizedEvents, personalizedUnderlayEvents] = fromBlock > settledBlock
    ? [[], [], []]
    : await Promise.all([
        queryFilterChunked(suSquaresConnected, filterSold, fromBlock, settledBlock),
        queryFilterChunked(suSquaresConnected, filterPersonalized, fromBlock, settledBlock),
        queryFilterChunked(underlayConnected, filterUnderlay, fromBlock, settledBlock),
    ]);

// Main program ////////////////////////////////////////////////////////////////
console.log(`Since block ${fromBlock} through ${settledBlock}, there have been:`);
console.log(`  ${soldEvents.length} sold`);
console.log(`  ${personalizedEvents.length} personalized`);
console.log(`  ${personalizedUnderlayEvents.length} personalized underlay`);

const allEvents = [...soldEvents, ...personalizedEvents, ...personalizedUnderlayEvents];
if (allEvents.length === 0) {
    if (process.env.FAST_FORWARD === "1" && settledBlock > loadedTo) {
        fs.mkdirSync("./build", { recursive: true });
        fs.writeFileSync("./build/loadedTo.json", JSON.stringify(settledBlock));
        console.log(`Fast-forwarded loadedTo.json: ${loadedTo} → ${settledBlock}`);
    }
    process.exit(0); // success
}

// Find the earliest block with a change
const earliestBlock = Math.min(...allEvents.map(e => e.blockNumber));
console.log(`\nNext update at block: ${earliestBlock}`);

// Update loadedTo to just before the earliest change
const newLoadedTo = Math.max(loadedTo, earliestBlock - 1);
if (newLoadedTo > loadedTo) {
    fs.mkdirSync("./build", { recursive: true });
    fs.writeFileSync("./build/loadedTo.json", JSON.stringify(newLoadedTo));
    console.log(`Updated loadedTo.json: ${loadedTo} → ${newLoadedTo}`);
}

process.exit(2); // updates found
