# Su Squares Update Script

This script pulls data from the [Su Squares smart contract](https://github.com/su-squares/ethereum-contract) and builds [wholeSquare.png](https://tenthousandsu.com/build/wholeSquare.png), [squarePersonalizations.json](https://tenthousandsu.com/build/squarePersonalizations.json) and the [ERC-721 metadata files](https://github.com/su-squares/tenthousandsu.com/tree/master/erc721) deployed on https://tenthousandsu.com. 

## Install it

You will need **Node.js 14+** for this project. Here are installation instructions for macOS (tested on 10.12+).

```sh
# Change into the su-squares-update-script directory
brew install node
brew install nvm
nvm use 14

# One-time install
npm install
```

Also you will need a connection to the Ethereum network. You can get an HTTP provider at https://infura.io/dashboard/ethereum/.

## Configure it

Configure the blockchain script by writing a file **config.json** like so: 

```json
{
    "provider": "https://mainnet.infura.io/v3/YOUR INFURA API URL HERE"
}
```

## Run it

Here is the complete run script to build the main image.

```sh
cd ~/Developer/su-squares/update-script
nvm use 14
# Load however many blocks you want, repeat
time node load-blockchain.mjs 100000 
time zsh build-square.sh && rm -rf build/squares-rgb
```

Deploy generally looks like this.

```sh
cp build/wholeSquare.png ~/Sites/tenthousandsu.com/build/wholeSquare.png
cp build/squarePersonalizations.json ~/Sites/tenthousandsu.com/build/squarePersonalizations.json
cp build/metadata/*.json build/metadata/*.svg ~/Sites/tenthousandsu.com/erc721
cd ~/Sites/tenthousandsu.com
git status # Manually do a sanity check git diff # Manually do a sanity check
git commit -am 'Load from blockchain'
git push
```

You can set this up as a cron job. But in production we are running this manually based on [email alerts from Etherscan](https://etherscan.io/myaddress) and specific customer requests.

Were there any recent updates?

```
cd ~/Developer/su-squares/update-script
node have-there-been-updates.js
```


## The non-personalized Squares

Create them one time. Save this file to `tmp`:

```svg
<svg width="800" height="1000" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
      <linearGradient id="Gradient2" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="#2d3c96"/>
        <stop offset="100%" stop-color="#d53392"/>
      </linearGradient>
  </defs>
  <rect x="10" y="10" width="780" height="980" fill="url(#Gradient2)" rx="50" ry="50" stroke="#ffd700" stroke-width="20"/>
  <text x="400" y="570" width="780" text-anchor="middle" style="font: bold 200px 'Helvetica Neue'; fill: #ffd700">xxxx</text>
</svg>
```

Then run:

```sh
#!/bin/zsh

for square in {00001..10000}; do cat ~/Desktop/tmp | sed -e "s/xxxx/$square/" > $square.svg; done
```


## License

This project is released under the MIT license, enjoy! See [LICENSE](./LICENSE).
