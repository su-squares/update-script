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

canvas=build/wholeSquare.tmp.rgb
output=build/wholeSquare.png
cp empty-board.rgb $canvas

for square in {00001..10000}
do
  # Skip if square not sold yet
  if [ ! -s build/metadata/$square.json ]
  then continue
  fi

  square_image="one-gray-square.rgb"
  if [ -s build/squares-rgb/$square.rgb ]
  then
  	square_image="build/squares-rgb/$square.rgb"
  fi

  offsetX=$((((square-1)%100)*10))
  offsetY=$((((square-1)/100)*10))
  echo "Adding image #$square"
  convert -size 1000x1000 -depth 8 $canvas -size 10x10 -depth 8 $square_image -geometry "+$offsetX+$offsetY" -composite $canvas
done
convert -size 1000x1000 -depth 8 $canvas $output