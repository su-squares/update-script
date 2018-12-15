# Su Squares Update Script
This script pull data from the [Su Squares smart contract](https://github.com/su-squares/ethereum-contract) and builds [wholeSquare.png](https://tenthousandsu.com/build/wholeSquare.png), [squarePersonalizations.json](https://tenthousandsu.com/build/squarePersonalizations.json) and erc721/*.json which are all deployed on https://tenthousandsu.com. 

## Install it

You will need **Node.js** and **ImageMagick** for this project. Here are installation instructions for macOS (tested on 10.12+).

```sh
# Change into the su-squares-update-script directory
brew install node
brew install imagemagick
```

Also you will need a connection to the Ethereum network. This script uses **Infura** to connect, so you will need an Infura API key.

## Configure it

Configure the blockchain script by writing to **query-blockchain.config.json** like so. 

```sh
#!/bin/sh
cat << EOL > query-blockchain.config.json
{
    "account": "0xE9e3F9cfc1A64DFca53614a0182CFAD56c10624F",
    "startBlock": 6645906,
    "infuraKey": "YOUR INFURA API KEY HERE"
}
EOL
```

## Run it

Here is the complete run script.

```sh
# Prepare build
set -e
rm -rf build
mkdir build
mkdir build/metadata
mkdir build/squares-rgb

# Get blockchain data
time node query-blockchain.js

# Build the image
time zsh build-square.sh
```

You can set this up as a cron job. But in production we are running this manually based on [email alerts from EtherScan](https://etherscan.io/myaddress) and specific customer requests.