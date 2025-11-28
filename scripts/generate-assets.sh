#!/bin/bash

# Generate favicon and OG image assets from SVG
# Requires: ImageMagick (convert) or Inkscape
# Alternative: Use Node.js script with sharp (npm install sharp)

echo "Generating OVRSEE brand assets..."

PUBLIC_DIR="public"
SVG_FAVICON="$PUBLIC_DIR/ovrsee_favicon.svg"
SVG_LOGO="$PUBLIC_DIR/ovrsee_logo_primary.svg"

# Check if ImageMagick is available
if command -v convert &> /dev/null; then
    echo "Using ImageMagick..."
    
    # Generate favicon PNGs
    convert -background black "$SVG_FAVICON" -resize 16x16 "$PUBLIC_DIR/favicon-16x16.png"
    convert -background black "$SVG_FAVICON" -resize 32x32 "$PUBLIC_DIR/favicon-32x32.png"
    convert -background black "$SVG_FAVICON" -resize 180x180 "$PUBLIC_DIR/apple-touch-icon.png"
    convert -background black "$SVG_FAVICON" -resize 192x192 "$PUBLIC_DIR/android-chrome-192x192.png"
    convert -background black "$SVG_FAVICON" -resize 512x512 "$PUBLIC_DIR/android-chrome-512x512.png"
    
    # Generate favicon.ico (16x16)
    convert -background black "$SVG_FAVICON" -resize 16x16 "$PUBLIC_DIR/favicon.ico"
    
    # Generate OG image (1200x630)
    convert -size 1200x630 xc:black \
            "$SVG_LOGO" -gravity center -composite \
            "$PUBLIC_DIR/ovrsee_og.png"
    
    echo "✓ Assets generated successfully!"
    
elif command -v inkscape &> /dev/null; then
    echo "Using Inkscape..."
    
    # Generate favicon PNGs
    inkscape "$SVG_FAVICON" --export-filename="$PUBLIC_DIR/favicon-16x16.png" --export-width=16 --export-height=16
    inkscape "$SVG_FAVICON" --export-filename="$PUBLIC_DIR/favicon-32x32.png" --export-width=32 --export-height=32
    inkscape "$SVG_FAVICON" --export-filename="$PUBLIC_DIR/apple-touch-icon.png" --export-width=180 --export-height=180
    inkscape "$SVG_FAVICON" --export-filename="$PUBLIC_DIR/android-chrome-192x192.png" --export-width=192 --export-height=192
    inkscape "$SVG_FAVICON" --export-filename="$PUBLIC_DIR/android-chrome-512x512.png" --export-width=512 --export-height=512
    
    # Generate OG image
    inkscape "$SVG_LOGO" --export-filename="$PUBLIC_DIR/ovrsee_og.png" --export-width=1200 --export-height=630
    
    echo "✓ Assets generated successfully!"
    
else
    echo "Error: Neither ImageMagick nor Inkscape found."
    echo "Please install one of them, or use the Node.js script:"
    echo "  npm install sharp"
    echo "  node scripts/generate-favicons.js"
    echo "  node scripts/generate-og-image.js"
    exit 1
fi

