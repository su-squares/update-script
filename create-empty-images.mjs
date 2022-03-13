/**
 * Su Squares (c) 2022 Su & William Entriken
 *
 * Requires: pip3 install cairosvg
 * 
 * Create ERC-721 metadata images showing 10,000 Squares before personalization
 *
 * - build/metadata/[00001-10000].svg (OUTPUT)
 * - build/metadata/[00001-10000].png (OUTPUT)
 */

import fs from "fs";
fs.mkdirSync("./build/metadata", { recursive: true });

for (let squareNumber=1; squareNumber<=10000; squareNumber++) {
  const paddedSquareNumber = ("00000" + squareNumber).slice(-5);
  const svg =
`<svg width="800" height="1000" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
      <linearGradient id="Gradient2" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="#2d3c96"/>
        <stop offset="100%" stop-color="#d53392"/>
      </linearGradient>
  </defs>
  <rect x="10" y="10" width="780" height="980" fill="url(#Gradient2)" rx="50" ry="50" stroke="#ffd700" stroke-width="20"/>
  <text x="400" y="570" width="780" text-anchor="middle" style="font: bold 200px 'Helvetica Neue'; fill: #ffd700">${paddedSquareNumber}</text>
</svg>`;
  fs.writeFileSync("build/metadata/"+paddedSquareNumber+".svg", svg);
}