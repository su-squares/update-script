# Su Squares update script

This script pulls data from the [Su Squares smart contract](https://github.com/su-squares/ethereum-contract) and builds [the website](https://github.com/su-squares/tenthousandsu.com/) deployed on https://TenThousandSu.com.

## Setup

### Node

You will need Node (recommending to use `nvm`) for this project. Here are installation instructions.

```sh
nvm install --lts --reinstall-packages-from=current
nvm use --lts
yarn install
```

### Ethereum

Also you will need a connection to the Ethereum network. You can get an HTTP provider at https://infura.io/dashboard/ethereum/.

Configure the blockchain script by writing a file **config.json** like so: 

```json
{
    "provider": "https://mainnet.infura.io/v3/YOUR INFURA API URL HERE"
}
```

### Setup blank image

Create blank metadata files and images (initial state before reading blockchain data):

```sh
node generate-empty-metadata-multithreaded.mjs
```

### Setup font

Here is how to produce `assets/Inter-bold-subset.txt` which is used in the SVG images.

The Inter font looks great and is available under the SIL Open Font License.

First [download from the RSMS project](https://rsms.me/inter/download/) save `InterVariable.ttf` to `build/`.

Now extract, subset and encode just the glyphes we need:

```sh
# Extract just the wght=700 and opsz=16 instance
pip install fonttools brotli
fonttools varLib.instancer build/InterVariable.ttf wght=700 opsz=16

# Subset the font to only include the digits
fonttools subset build/InterVariable-instance.ttf \
  --output-file=build/Inter-subset.woff2 \
  --flavor=woff2 \
  --text="0123456789" \
  --layout-features='kern' \
  --no-hinting

# Encode the font, must NOT have newline at end
base64 -i build/Inter-subset.woff2 | tr -d '\n' > assets/Inter-bold-subset.txt
```

## Run it

Here is the complete run script to build the main image.

```sh
cd ~/Developer/su-squares/update-script
# Load however many blocks you want, repeat
time node load-blockchain.mjs 100000 
```

Deploy generally looks like this.

```zsh
cp build/*.{json,png} ~/Sites/tenthousandsu.com/build
cp build/metadata/*.{json,svg} ~/Sites/tenthousandsu.com/erc721
cd ~/Sites/tenthousandsu.com
git status # Manually do a sanity check git diff # Manually do a sanity check
git commit -am 'Load from blockchain'
git push
```

We run this as a cron job.

Were there any recent updates?

```sh
cd ~/Developer/su-squares/update-script
node have-there-been-updates.mjs
```

## License

This project is released under the MIT license, enjoy! See [LICENSE](./LICENSE).
