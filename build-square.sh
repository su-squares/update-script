#!/bin/zsh

# Su Squares Data Extractor
# (c) 2018 Su & William Entriken
# 
# Convert RGB data from Su Squares blockchain into a complete PNG file.
# 
#  - build/squares-rgb/*.rgb (INPUT)
#      One rgb-encoded image file for each personalized Su Square
#  - build/metadata/*.json (INPUT)
#      One JSON file for each personalized Su Square, this is the tokenURI
#      target for ERC-721
#  - build/wholeSquare.png
#      Output complete image

emptyBoard="assets/empty-board.png"
notPersonalizedSquare="assets/one-gray-square.png"
# canvas="RGB:build/wholeSquare.tmp.rgb"
canvas="MPC:build/wholeSquare.tmp.mpc"
output="build/wholeSquare.png"

convert $emptyBoard $canvas

for square in {00001..10000}
do
  # Skip if square not sold yet
  if [ ! -s build/metadata/$square.json ]
  then continue
  fi

  square_image=$notPersonalizedSquare
  if [ -s build/squares-rgb/$square.rgb ]
  then
  	square_image="RGB:build/squares-rgb/$square.rgb" # you... square 2447!!!
  fi

  offsetX=$((((square-1)%100)*10))
  offsetY=$((((square-1)/100)*10))
  echo "Adding image #$square"
  convert -size 1000x1000 -depth 8 $canvas -size 10x10 -depth 8 $square_image -geometry "+$offsetX+$offsetY" -composite $canvas
done
convert -size 1000x1000 -depth 8 $canvas $output