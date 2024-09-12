# API from blockchain indexers

## :page_facing_up: loadedTo.json

The latest block height where updated personalizations were found and processed.

## :page_facing_up: squarePersonalizations.json

An array of length 10,000 with one entry per Square having:

* If the Square is personalized on main contract:
  * An array with [title, href] from the main contract personalization
* or else if the Square is personalized on the underlay contract:
  * An array with [title, href] from the underlay contract personalization
* or else:
  * `null`

:information_source: Note that `squarePersonalizations[0]` is for Square 1.

## :page_facing_up: underlayPersonalizations.json

An array of length 10,000 with one entry per Square having:

* If the Square was ever personalized on the underlay contract:
  * An array with `[title, href, rgbData]` from the most recent underlay contract personalization
  * `rgbData` is row-major R-G-B pixel bytes for the underlay personalization image.
* or else:
  * `null`

:information_source: Note that `underlayPersonalizations[0]` is for Square 1.

## :page_facing_up: squareExtra.json

An array of length 10,000 with one entry per Square having:

* If the Square is minted:
  * An array with `[mintedBlock, updatedBlock, mainIsPersonalized, version]`
  * `mintedBlock` is the block number when the Square was minted.
  * `updatedBlock` is the greatest block number of when the Square was minted or any personalization (either on main contract or underlay contract).
  * `mainIsPersonalized` is `true` if the Square was ever personalized on the main contract and the most recent personalization was not all black pixels with empty string title and href. 
  * `version` is the number of times the Square was personalized on the main contract.
* or else:
  * `null`

:information_source: Note that `squareExtra[0]` is for Square 1.