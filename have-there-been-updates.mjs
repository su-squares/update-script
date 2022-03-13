/**
 * Su Squares Updates
 * (c) 2021 Su & William Entriken, released under MIT license
 * 
 * Checks if any updates have occurred on-chain since state recorded in resume file
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
const config = JSON.parse(fs.readFileSync("./config.json"));
const state = JSON.parse(fs.readFileSync("./build/resume.json"));
const provider = new ethers.providers.JsonRpcProvider(config.provider);

// Contracts ///////////////////////////////////////////////////////////////////
const suSquares = {
    address: "0xE9e3F9cfc1A64DFca53614a0182CFAD56c10624F",
    abi: [
        "function suSquares(uint256 squareNumber) view returns (uint256 version, bytes rgbData, string title, string href)",
        "event Personalized(uint256 squareNumber)",
        "event Transfer(address indexed from, address indexed to, uint256 indexed squareNumber)"
    ],
    startBlock: 6645906
};
suSquares.contract = new ethers.Contract(suSquares.address, suSquares.abi, provider);

const underlay = {
    address: "0x992bDEC05cD423B73085586f7DcbbDaB953E0DCd",
    abi: [
        "event PersonalizedUnderlay(uint256 indexed squareNumber, bytes rgbData, string title, string href)"
    ],
    startBlock: 13425124    
};
underlay.contract = new ethers.Contract(underlay.address, underlay.abi, provider);


// Filters /////////////////////////////////////////////////////////////////////
const filterSold = suSquares.contract.filters.Transfer(suSquares.address, null, null);
const sold = suSquares.contract.queryFilter(filterSold, state.startBlock);

const filterPersonalized = suSquares.contract.filters.Personalized();
const personalized = suSquares.contract.queryFilter(filterPersonalized, state.startBlock);

const filterUnderlay = underlay.contract.filters.PersonalizedUnderlay();
const personalizedUnderlay = underlay.contract.queryFilter(filterUnderlay, state.startBlock);


// Main program ////////////////////////////////////////////////////////////////
await Promise.all([sold, personalized, personalizedUnderlay]).then((values) => {
    const [soldEvents, personalizedEvents, personalizedUnderlayEvents] = values;
    console.log("Scanning since block", state.startBlock);
    console.log(
        "Count of events",
        soldEvents.length,
        personalizedEvents.length,
        personalizedUnderlayEvents.length
    );
    if (soldEvents.length + personalizedEvents.length + personalizedUnderlayEvents.length === 0) {
        process.exit(0); // success
    }
    process.exit(1); // failure
});