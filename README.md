# Su Squares Update Script

This script pulls data from the [Su Squares smart contract](https://github.com/su-squares/ethereum-contract) and builds [wholeSquare.png](https://tenthousandsu.com/build/wholeSquare.png), [squarePersonalizations.json](https://tenthousandsu.com/build/squarePersonalizations.json) and the [ERC-721 metadata files](https://github.com/su-squares/tenthousandsu.com/tree/master/erc721) deployed on https://tenthousandsu.com. 

## Setup

You will need **Node.js 16+** and image libraries for this project. Here are installation instructions for macOS (tested on 10.12+).

```sh
# Change into the su-squares-update-script directory
brew install node
brew install imagemagick
brew install nvm
nvm use 16
pip3 install cairosvg

# One-time install
npm install
```

Also you will need a connection to the Ethereum network. You can get an HTTP provider at https://infura.io/dashboard/ethereum/.

Configure the blockchain script by writing a file **config.json** like so: 

```json
{
    "provider": "https://mainnet.infura.io/v3/YOUR INFURA API URL HERE"
}
```

Create blank SVG images and PNG because the world is not ready for SVG yet :-(

```sh
node create-empty-images.mjs
ls build/metadata/*.svg | parallel --eta cairosvg {} -o {.}.png;
```

## Run it

Here is the complete run script to build the main image.

```sh
cd ~/Developer/su-squares/update-script
# Load however many blocks you want, repeat
time node load-blockchain.mjs 100000 
```

Deploy generally looks like this.

```sh
cp build/wholeSquare.png build/squarePersonalizations.json  build/loadedTo.json ~/Sites/tenthousandsu.com/build
cp build/metadata/*.json build/metadata/*.svg build/metadata/*.png ~/Sites/tenthousandsu.com/erc721
cd ~/Sites/tenthousandsu.com
git status # Manually do a sanity check git diff # Manually do a sanity check
git commit -am 'Load from blockchain'
git push
```

You can set this up as a cron job. But in production we are running this manually based on [email alerts from Etherscan](https://etherscan.io/myaddress) and specific customer requests.

Were there any recent updates?

```sh
cd ~/Developer/su-squares/update-script
node have-there-been-updates.js
```

## License

This project is released under the MIT license, enjoy! See [LICENSE](./LICENSE).
