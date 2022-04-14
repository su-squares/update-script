/**
 * Su Squares Updates
 * (c) 2021 Su & William Entriken, released under MIT license
 * 
 * Checks if any updates occurred on-chain since resume.json was saved.
 * 
 * SYNOPSIS
 * node have-there-been-updates.js
 * 
 * EXIT STATUS
 * 0 (success) if no new updates since resume file updated
 * 1 (success) if new updates since resume file updated
 */

import fs from "fs";
import { ethers } from "ethers";
import { suSquares, underlay } from "./libs/contracts.mjs";
const config = JSON.parse(fs.readFileSync("./config.json"));
const state = JSON.parse(fs.readFileSync("./build/resume.json"));
const provider = new ethers.providers.JsonRpcProvider(config.provider);

// Load events /////////////////////////////////////////////////////////////////
const suSquaresConnected = suSquares.connect(provider);
const underlayConnected = underlay.connect(provider);

const filterSold = suSquaresConnected.filters.Transfer(suSquares.address, null, null);
const sold = suSquaresConnected.queryFilter(filterSold, state.startBlock);

const filterPersonalized = suSquaresConnected.filters.Personalized();
const personalized = suSquaresConnected.queryFilter(filterPersonalized, state.startBlock);

const filterUnderlay = underlayConnected.filters.PersonalizedUnderlay();
const personalizedUnderlay = underlayConnected.queryFilter(filterUnderlay, state.startBlock);

// Main program ////////////////////////////////////////////////////////////////
await Promise.all([sold, personalized, personalizedUnderlay]).then((values) => {
    const [soldEvents, personalizedEvents, personalizedUnderlayEvents] = values;
    console.log(`Since block ${state.startBlock}, there have been:`);
    console.log(`  ${soldEvents.length} sold`);
    console.log(`  ${personalizedEvents.length} personalized`);
    console.log(`  ${personalizedUnderlayEvents.length} personalized underlay`);
    if (soldEvents.length + personalizedEvents.length + personalizedUnderlayEvents.length === 0) {
        process.exit(0); // success
    }
    process.exit(1); // failure
});