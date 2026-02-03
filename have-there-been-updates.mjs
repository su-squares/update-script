/**
 * (c) Su & William Entriken, released under MIT license
 * 
 * Check if any updates occurred on-chain since loadedTo.json was saved.
 * 
 * SYNOPSIS
 * node have-there-been-updates.js
 * 
 * EXIT STATUS
 * 0 (success) if no new updates since loadedTo.json file updated
 * 1 (success) if new updates since loadedTo.json file updated
 */

import fs from "fs";
import { ethers } from "ethers";
import "dotenv/config";
import { suSquares, suSquaresDeploymentBlock, underlay } from "./libs/contracts.mjs";

const loadedTo = fs.existsSync("./build/loadedTo.json")
    ? JSON.parse(fs.readFileSync("./build/loadedTo.json"))
    : suSquaresDeploymentBlock;
const provider = new ethers.JsonRpcProvider(process.env.PROVIDER_URL);

// Load events /////////////////////////////////////////////////////////////////
const suSquaresConnected = suSquares.connect(provider);
const underlayConnected = underlay.connect(provider);

const filterSold = suSquaresConnected.filters.Transfer(suSquares.getAddress(), null, null);
const sold = suSquaresConnected.queryFilter(filterSold, loadedTo + 1);

const filterPersonalized = suSquaresConnected.filters.Personalized();
const personalized = suSquaresConnected.queryFilter(filterPersonalized, loadedTo + 1);

const filterUnderlay = underlayConnected.filters.PersonalizedUnderlay();
const personalizedUnderlay = underlayConnected.queryFilter(filterUnderlay, loadedTo + 1);

// Main program ////////////////////////////////////////////////////////////////
await Promise.all([sold, personalized, personalizedUnderlay]).then((values) => {
    const [soldEvents, personalizedEvents, personalizedUnderlayEvents] = values;
    console.log(`Since block ${loadedTo + 1}, there have been:`);
    console.log(`  ${soldEvents.length} sold`);
    console.log(`  ${personalizedEvents.length} personalized`);
    console.log(`  ${personalizedUnderlayEvents.length} personalized underlay`);

    const allEvents = [...soldEvents, ...personalizedEvents, ...personalizedUnderlayEvents];
    if (allEvents.length === 0) {
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

    process.exit(1); // failure
});