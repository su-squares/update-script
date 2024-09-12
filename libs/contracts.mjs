/**
 * Su Squares Updates
 * (c) Su & William Entriken, released under MIT license
 * 
 * Data structures representing the Su Squares contracts on-chain
 */

import { ethers } from "ethers";

const suSquares = new ethers.Contract(
    "0xE9e3F9cfc1A64DFca53614a0182CFAD56c10624F",
    [
        "function suSquares(uint256 squareNumber) view returns (uint256 version, bytes rgbData, string title, string href)",
        "event Personalized(uint256 squareNumber)",
        "event Transfer(address indexed from, address indexed to, uint256 indexed squareNumber)",
    ]
);

const underlay = new ethers.Contract(
    "0x992bDEC05cD423B73085586f7DcbbDaB953E0DCd",
    [
        "event PersonalizedUnderlay(uint256 indexed squareNumber, bytes rgbData, string title, string href)"
    ]
);

const suSquaresDeploymentBlock = 6645906;

export { suSquares, suSquaresDeploymentBlock, underlay };