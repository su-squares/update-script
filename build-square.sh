#!/bin/zsh -e

# Su Squares Data Extractor
# (c) 2018 Su & William Entriken
# 
# Convert RGB data from Su Squares blockchain into a complete PNG file.
# 
#  - build/wholeSquare.png (INPUT / OUTPUT)
#      The complete image
#  - build/squares-rgb/*.rgb (INPUT)
#      One rgb-encoded image file for each minted/personalized Su Square

emptyBoard="assets/empty-board.png"
output="build/wholeSquare.png"
canvas="build/wholeSquare.tmp.mpc" # Efficient internal format

cp -n $emptyBoard $output
convert PNG32:$output MPC:$canvas

for square in ./build/squares-rgb/*.rgb
do
  number=$(basename $square .rgb)
  echo Updating $number
  ((offsetX = (number-1)%100*10))
  ((offsetY = (number-1)/100*10))
  convert\
    -size 1000x1000 -depth 8 MPC:$canvas\
    -size 10x10 -depth 8 RGB:$square -geometry "+$offsetX+$offsetY"\
    -composite MPC:$canvas

  cmp -s assets/nonpersonalized.rgb $square && (
    echo "WAS NOT personalized" $square
  ) || (
    pixelSVG=$(convert -size 10x10 -depth 8 RGB:$square txt:- | tail -n +2 | perl -pe 's|(\d),(\d):.*(#......).*|<rect x="$1" y="$2" width="1" height="1" fill="$3" />|' | tr -d '\n')
    cat assets/template.svg | sed -e "s|SQUARE|$number|" -e "s|PIXELS|$pixelSVG|" > build/metadata/$number.svg
    echo "WAS personalized: " $square

    # TODO ALSO MAKE PNG
  )
done
convert -size 1000x1000 -depth 8 MPC:$canvas PNG32:$output
rm $canvas "build/wholeSquare.tmp.cache"