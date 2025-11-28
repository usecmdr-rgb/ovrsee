const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const inputFile = path.join(__dirname, '../public/ovrsee_stacked_transparent.png');
const outputDir = path.join(__dirname, '../public');

async function createFaviconClean() {
  try {
    console.log('Creating clean favicon from logo (O and S)...\n');
    
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
        width: Math.floor(letterWidth * 0.95), // Narrow to avoid other letters
        height: Math.floor(rowHeight * 0.98)   // Almost full row height
      })
      .toBuffer();
    
    // Extract S from bottom row (first letter, left side)
    const letterS = await sharp(blackLogo)
      .extract({
        left: 0,
        top: Math.floor(rowHeight * 1.0), // Start at bottom row
        width: Math.floor(letterWidth * 0.95), // Narrow to avoid other letters
        height: Math.floor(rowHeight * 1.0)   // Full row height
      })
      .toBuffer();
    
    // Get dimensions
    const oMeta = await sharp(letterO).metadata();
    const sMeta = await sharp(letterS).metadata();
    
    // Use consistent size for both letters
    const letterSize = Math.max(oMeta.width, oMeta.height, sMeta.width, sMeta.height);
    
    // Calculate vertical spacing: O ends at rowHeight*0.98, S starts at rowHeight*1.0
    // Gap = rowHeight*1.0 - rowHeight*0.98 = rowHeight*0.02 = 2% of row height
    // Measured: 4px gap / 167px row height = 0.024 (2.4%)
    const gapRatio = 0.024;
    const verticalGap = Math.floor(letterSize * gapRatio);
    
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
        background: { r: 0, g: 0, b: 0, alpha: 255 } // Solid black
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
        background: { r: 0, g: 0, b: 0, alpha: 255 } // Solid black
      }
    })
    .composite([{ input: resizedS, blend: 'dest-in' }])
    .png()
    .toBuffer();
    
    // Create SVG favicon - centered in square canvas with padding to prevent cropping
    // Calculate canvas size to center the letters
    const totalHeight = (letterSize * 2) + verticalGap;
    const padding = Math.floor(letterSize * 0.05); // 5% padding on all sides to prevent cropping
    const canvasSize = Math.max(letterSize, totalHeight) + (padding * 2); // Square canvas with padding
    const offsetY = padding + (canvasSize - (padding * 2) - totalHeight) / 2; // Center vertically with padding
    
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasSize}" height="${canvasSize}" viewBox="0 0 ${canvasSize} ${canvasSize}">
  <image href="data:image/png;base64,${filledO.toString('base64')}" x="${(canvasSize - letterSize) / 2}" y="${offsetY}" width="${letterSize}" height="${letterSize}"/>
  <image href="data:image/png;base64,${filledS.toString('base64')}" x="${(canvasSize - letterSize) / 2}" y="${offsetY + letterSize + verticalGap}" width="${letterSize}" height="${letterSize}"/>
</svg>`;
    
    // Save SVG favicon
    fs.writeFileSync(path.join(outputDir, 'favicon.svg'), svgContent);
    console.log('✓ Created favicon.svg');
    
    // Generate PNG versions
    const svgBuffer = Buffer.from(svgContent);
    
    await sharp(svgBuffer)
      .resize(16, 16)
      .png()
      .toFile(path.join(outputDir, 'favicon-16x16.png'));
    console.log('✓ Created favicon-16x16.png');
    
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
    
    await sharp(svgBuffer)
      .resize(180, 180)
      .png()
      .toFile(path.join(outputDir, 'apple-touch-icon.png'));
    console.log('✓ Created apple-touch-icon.png');
    
    // Also create the old name for compatibility
    fs.writeFileSync(path.join(outputDir, 'ovrsee_favicon.svg'), svgContent);
    console.log('✓ Created ovrsee_favicon.svg (for compatibility)');
    
    console.log('\n✅ All favicon files created successfully!');
    console.log(`\nFavicon details:`);
    console.log(`  - Canvas size: ${canvasSize}x${canvasSize}px`);
    console.log(`  - Letter size: ${letterSize}px`);
    console.log(`  - Vertical gap: ${verticalGap}px`);
    console.log(`  - Centered: Yes`);
    
  } catch (error) {
    console.error('Error creating favicon:', error);
    process.exit(1);
  }
}

createFaviconClean();

