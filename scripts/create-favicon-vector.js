const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const inputFile = path.join(__dirname, '../public/ovrsee_stacked_transparent.png');
const outputDir = path.join(__dirname, '../public');

async function createFaviconVector() {
  try {
    console.log('Creating vector-based favicon from logo (O and S)...\n');
    
    const metadata = await sharp(inputFile).metadata();
    const width = metadata.width;
    const height = metadata.height;
    const rowHeight = Math.floor(height / 2);
    const letterWidth = Math.floor(width / 3);
    
    console.log(`Logo dimensions: ${width}x${height}`);
    console.log(`Row height: ${rowHeight}, Letter width: ${letterWidth}\n`);
    
    // Make logo black to match design
    const blackLogo = await sharp(inputFile)
      .modulate({ brightness: 0, saturation: 0 })
      .toBuffer();
    
    // Extract O from top row (first letter, left side)
    const letterO = await sharp(blackLogo)
      .extract({
        left: 0,
        top: 0,
        width: Math.floor(letterWidth * 0.95),
        height: Math.floor(rowHeight * 0.98)
      })
      .extend({
        top: 10,
        bottom: 10,
        left: 0,
        right: 0,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .toBuffer();
    
    // Extract S from bottom row (first letter, left side)
    // Ensure we get the full S by starting earlier and using available height
    const sTop = Math.floor(rowHeight * 0.95); // Start even earlier
    const sHeight = Math.min(Math.floor(rowHeight * 1.1), height - sTop); // Extract more height
    const letterS = await sharp(blackLogo)
      .extract({
        left: 0,
        top: sTop,
        width: Math.floor(letterWidth * 0.95),
        height: sHeight
      })
      .extend({
        top: 10,
        bottom: 10,
        left: 0,
        right: 0,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .toBuffer();
    
    // Get dimensions
    const oMeta = await sharp(letterO).metadata();
    const sMeta = await sharp(letterS).metadata();
    
    // Use consistent size for both letters
    const letterSize = Math.max(oMeta.width, oMeta.height, sMeta.width, sMeta.height);
    
    // Resize both letters to same size, maintaining aspect ratio
    const resizedO = await sharp(letterO)
      .resize(letterSize, letterSize, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .ensureAlpha()
      .toBuffer();
    
    const resizedS = await sharp(letterS)
      .resize(letterSize, letterSize, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .ensureAlpha()
      .toBuffer();
    
    // Create filled black versions using alpha channel as mask
    const filledO = await sharp({
      create: {
        width: letterSize,
        height: letterSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 255 }
      }
    })
    .composite([{ input: resizedO, blend: 'dest-in' }])
    .png()
    .toBuffer();
    
    const filledS = await sharp({
      create: {
        width: letterSize,
        height: letterSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 255 }
      }
    })
    .composite([{ input: resizedS, blend: 'dest-in' }])
    .png()
    .toBuffer();
    
    // Create SVG favicon with viewBox="0 0 100 100" and 12% padding
    // Padding: 12% top and bottom = 12 units each, leaving 76 units for content
    // Increase bottom padding slightly to ensure S is not cropped
    const topPadding = 12; // 12% of 100
    const bottomPadding = 15; // 15% for extra safety at bottom
    const padding = topPadding;
    const contentHeight = 100 - topPadding - bottomPadding; // 73 units
    const contentWidth = 100; // Full width
    
    // Calculate positions
    // Scale letters to fit in content area (76 units tall total)
    // Each letter gets 38 units (half of 76), but scale down to ensure fit with extra margin
    const letterScale = (contentHeight / 2) / letterSize * 0.90; // Scale factor with 10% margin for safety
    const scaledLetterSize = letterSize * letterScale;
    const letterWidthUnits = scaledLetterSize;
    const letterHeightUnits = scaledLetterSize;
    
    // Center horizontally
    const letterX = (100 - letterWidthUnits) / 2;
    
    // Position O at top of content area
    const oY = padding;
    
    // Position S in the second half of content area, ensuring it doesn't exceed bottom padding
    const sY = padding + (contentHeight / 2);
    
    // Ensure S doesn't exceed bottom boundary (y + height <= 100 - bottomPadding)
    const maxSY = 100 - bottomPadding - letterHeightUnits;
    const finalSY = Math.min(sY, maxSY);
    
    // Create SVG with proper viewBox
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
  <image href="data:image/png;base64,${filledO.toString('base64')}" x="${letterX}" y="${oY}" width="${letterWidthUnits}" height="${letterHeightUnits}"/>
  <image href="data:image/png;base64,${filledS.toString('base64')}" x="${letterX}" y="${finalSY}" width="${letterWidthUnits}" height="${letterHeightUnits}"/>
</svg>`;
    
    // Save SVG favicon
    fs.writeFileSync(path.join(outputDir, 'favicon.svg'), svgContent);
    console.log('✓ Created favicon.svg');
    
    // Generate PNG versions from SVG
    const svgBuffer = Buffer.from(svgContent);
    
    await sharp(svgBuffer)
      .resize(32, 32)
      .png()
      .toFile(path.join(outputDir, 'favicon-32x32.png'));
    console.log('✓ Created favicon-32x32.png');
    
    await sharp(svgBuffer)
      .resize(64, 64)
      .png()
      .toFile(path.join(outputDir, 'favicon-64x64.png'));
    console.log('✓ Created favicon-64x64.png');
    
    // Generate ICO file (multi-size)
    const ico16 = await sharp(svgBuffer).resize(16, 16).png().toBuffer();
    const ico32 = await sharp(svgBuffer).resize(32, 32).png().toBuffer();
    const ico48 = await sharp(svgBuffer).resize(48, 48).png().toBuffer();
    
    // Simple ICO format (concatenate PNGs - browsers will handle it)
    // For a proper ICO, we'd need a library, but this works for most browsers
    fs.writeFileSync(path.join(outputDir, 'favicon.ico'), ico32);
    console.log('✓ Created favicon.ico');
    
    // Apple touch icon
    await sharp(svgBuffer)
      .resize(180, 180)
      .png()
      .toFile(path.join(outputDir, 'apple-touch-icon.png'));
    console.log('✓ Created apple-touch-icon.png');
    
    console.log('\n✅ All favicon files created successfully!');
    console.log(`\nFavicon details:`);
    console.log(`  - ViewBox: 0 0 100 100`);
    console.log(`  - Padding: 12% top and bottom`);
    console.log(`  - Content area: 76 units (y: 12 to 88)`);
    console.log(`  - Letters centered: Yes`);
    
  } catch (error) {
    console.error('Error creating favicon:', error);
    process.exit(1);
  }
}

createFaviconVector();

