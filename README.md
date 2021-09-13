# Su Squares Update Script

This script pulls data from the [Su Squares smart contract](https://github.com/su-squares/ethereum-contract) and builds [wholeSquare.png](https://tenthousandsu.com/build/wholeSquare.png), [squarePersonalizations.json](https://tenthousandsu.com/build/squarePersonalizations.json) and the [ERC-721 metadata files](https://github.com/su-squares/tenthousandsu.com/tree/master/erc721) deployed on https://tenthousandsu.com. 

## Install it

You will need **Node.js** for this project. Here are installation instructions for macOS (tested on 10.12+).

```sh
# Change into the su-squares-update-script directory
brew install node

# One-time install
npm install
```

Also you will need a connection to the Ethereum network. You can get an HTTP provider at https://infura.io/dashboard/ethereum/.

## Configure it

Configure the blockchain script by writing a file **config.json** like so: 

```json
{
    "account": "0xE9e3F9cfc1A64DFca53614a0182CFAD56c10624F",
    "startBlock": 6645906,
    "provider": "https://mainnet.infura.io/v3/YOUR INFURA API URL HERE"
}
```

## Run it

Here is the complete run script to build the main image.

```sh
cd ~/Developer/su-squares/update-script
# Load however many blocks you want, repeat
time node load-blockchain.js 100000 
time zsh build-square.sh && rm -rf build/squares-rgb
```

Deploy generally looks like this.

```sh
cp build/wholeSquare.png ~/Sites/tenthousandsu.com/build/wholeSquare.png
cp build/squarePersonalizations.json ~/Sites/tenthousandsu.com/build/squarePersonalizations.json
cp build/metadata/*.json ~/Sites/tenthousandsu.com/erc721
cd ~/Sites/tenthousandsu.com
git status # Manually do a sanity check git diff # Manually do a sanity check
git commit -am 'Load from blockchain'
git push
```

You can set this up as a cron job. But in production we are running this manually based on [email alerts from Etherscan](https://etherscan.io/myaddress) and specific customer requests.

## License

This project is released under the MIT license, enjoy! See [LICENSE](./LICENSE).
