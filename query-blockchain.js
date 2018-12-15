/**
 * Su Squares Data Extractor
 * (c) 2018 Su & William Entriken
 * 
 * Collect all useful information from Ethereum Mainnet about Su Squares and
 * save it into files on disk.
 *
 *  - build/squares-rgb/*.rgb
 *      One rgb-encoded image file for each personalized Su Square
 *  - build/squarePersonalizations.json
 *      A json file including personalization information for each square. This
 *      is an array of 10000 squares, each element like [version, title, href],
 *      or null if that square is not personalized.
 *  - build/metadata/*.json
 *      One JSON file for each personalized Su Square, this is the tokenURI
 *      target for ERC-721
 *
 * The technique is to start at contract creation, find affected squares and
 * get relevent details of those squares. P.S when there is much more
 * personalization activity, this algorithm can be updated to for(i=1...10000).
 */
const fs = require('fs');
const config = require('./query-blockchain.config.json');
const Web3 = require('web3'); // Use web3@1.0.0-beta.36+ https://github.com/ethereum/web3.js/issues/1916
const web3 = new Web3(new Web3.providers.HttpProvider('https://mainnet.infura.io/' + config.infuraKey));

const abi=[{"anonymous":false,"inputs":[{"indexed":false,"name":"_nftId","type":"uint256"}],"name":"Personalized","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"_from","type":"address"},{"indexed":true,"name":"_to","type":"address"},{"indexed":true,"name":"_tokenId","type":"uint256"}],"name":"Transfer","type":"event"},{"constant":true,"inputs":[{"name":"","type":"uint256"}],"name":"suSquares","outputs":[{"name":"version","type":"uint256"},{"name":"rgbData","type":"bytes"},{"name":"title","type":"string"},{"name":"href","type":"string"}],"payable":false,"stateMutability":"view","type":"function"}];
const contract = new web3.eth.Contract(abi, config.account);
const NUM_SQUARES = 10000;
var allData = Array(NUM_SQUARES).fill(null);

// Find squares that were personalized
let personalized = contract.getPastEvents('Personalized', {fromBlock: config.startBlock}).then(events => {
  return events.map(e => e.returnValues._nftId);
});
let transferFromContract = contract.getPastEvents('Transfer', {fromBlock: config.startBlock, filter: {_from: config.account}}).then(events => {
  return events.map(e => e.returnValues._tokenId);
});
let touchedSquares = Promise.all([personalized, transferFromContract]).then(arrayOfArrayOfSquares => {
  return new Set([].concat(...arrayOfArrayOfSquares));
});

// Now start to collect details on affected squares
let squareProcessing = touchedSquares.then(touchedSquares => {
  console.log('Touched squares:', touchedSquares);

  return Promise.all([...touchedSquares].map(squareNumber => {
    console.log('Processing square:', squareNumber);

    return contract.methods.suSquares(squareNumber).call().then(result => {
      // Save to the master JSON file
      allData[squareNumber - 1] = [result.version, result.title, result.href];

      let paddedSquareNumber = ('00000' + squareNumber).slice(-5);
      // Build ERC-721 metadata JSON file
      var erc721Object = {
        'name' : 'Square #' + paddedSquareNumber,
        'description' : result ? result[2] : '',
        'image' : 'https://tenthousandsu.com/erc721/' + paddedSquareNumber + '.png'
      };
      fs.writeFileSync('build/metadata/' + paddedSquareNumber + '.json', JSON.stringify(erc721Object));

      // If the square is personalized then save image data
      if (result && result.rgbData && result.rgbData.length == (2 + 300*2)) {
        var rgbData = Buffer.from(result.rgbData.substr(2), 'hex');
        fs.writeFileSync('build/squares-rgb/'+paddedSquareNumber+'.rgb', rgbData);
      }
    });
  }));
});

// Exit when complete
squareProcessing.then(() => {
  fs.writeFileSync('build/squarePersonalizations.json', JSON.stringify(allData));
  process.exit();
});