/**
 * Su Squares Updates
 * (c) Su & William Entriken, released under MIT license
 * 
 * Checks if any updates occurred on-chain since loadedTo.json was saved.
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
import { suSquares, underlay } from "./libs/contracts.mjs";
const config = JSON.parse(fs.readFileSync("./config.json"));
const loadedTo = JSON.parse(fs.readFileSync("./build/loadedTo.json"));
const provider = new ethers.providers.JsonRpcProvider(config.provider);

// Load events /////////////////////////////////////////////////////////////////
const suSquaresConnected = suSquares.connect(provider);
const underlayConnected = underlay.connect(provider);

const filterSold = suSquaresConnected.filters.Transfer(suSquares.address, null, null);
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
    if (soldEvents.length + personalizedEvents.length + personalizedUnderlayEvents.length === 0) {
        process.exit(0); // success
    }
    process.exit(1); // failure
});