const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const inputFile = path.join(__dirname, '../public/ovrsee_stacked_transparent.png');
const outputDir = path.join(__dirname, '../public');

async function createFavicon() {
  try {
    console.log('Creating favicon from logo...\n');
    
    const metadata = await sharp(inputFile).metadata();
    const width = metadata.width;
    const height = metadata.height;
    const rowHeight = Math.floor(height / 2);
    const letterWidth = Math.floor(width / 3);
    
    // Make logo black first
    const blackLogo = await sharp(inputFile)
      .modulate({ brightness: 0, saturation: 0 })
      .toBuffer();
    
    // Extract O from top row
    const letterO = await sharp(blackLogo)
      .extract({
        left: 0,
        top: 0,
        width: Math.floor(letterWidth * 0.95),
        height: Math.floor(rowHeight * 0.98)
      })
      .toBuffer();
    
    // Extract S from bottom row
    const letterS = await sharp(blackLogo)
      .extract({
        left: 0,
        top: Math.floor(rowHeight * 1.0),
        width: Math.floor(letterWidth * 0.95),
        height: Math.floor(rowHeight * 1.0)
      })
      .toBuffer();
    
    // Get dimensions
    const oMeta = await sharp(letterO).metadata();
    const sMeta = await sharp(letterS).metadata();
    const letterSize = Math.max(oMeta.width, oMeta.height, sMeta.width, sMeta.height);
    
    // Add white space above and below each letter (30% padding)
    const verticalPadding = Math.floor(letterSize * 0.3);
    const paddedHeight = letterSize + (verticalPadding * 2);
    
    // Calculate vertical gap: O ends at rowHeight*0.98, S starts at rowHeight*1.0
    // Gap = rowHeight*1.0 - rowHeight*0.98 = rowHeight*0.02 = 2% of row height
    // Measured gap is 4px = 0.024 of row height (167px)
    const gapRatio = 0.024;
    const verticalGap = Math.floor(letterSize * gapRatio);
    
    // Resize and add padding to O
    const resizedO = await sharp(letterO)
      .resize(letterSize, letterSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({ top: verticalPadding, bottom: verticalPadding, left: 0, right: 0, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha()
      .toBuffer();
    
    // Resize and add padding to S
    const resizedS = await sharp(letterS)
      .resize(letterSize, letterSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({ top: verticalPadding, bottom: verticalPadding, left: 0, right: 0, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha()
      .toBuffer();
    
    // Create filled black versions
    const filledO = await sharp({
      create: { width: letterSize, height: paddedHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 255 } }
    })
    .composite([{ input: resizedO, blend: 'dest-in' }])
    .png()
    .toBuffer();
    
    const filledS = await sharp({
      create: { width: letterSize, height: paddedHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 255 } }
    })
    .composite([{ input: resizedS, blend: 'dest-in' }])
    .png()
    .toBuffer();
    
    // Create SVG with correct vertical spacing
    const canvasHeight = (paddedHeight * 2) + verticalGap;
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${letterSize}" height="${canvasHeight}" viewBox="0 0 ${letterSize} ${canvasHeight}">
  <image href="data:image/png;base64,${filledO.toString('base64')}" x="0" y="0" width="${letterSize}" height="${paddedHeight}"/>
  <image href="data:image/png;base64,${filledS.toString('base64')}" x="0" y="${paddedHeight + verticalGap}" width="${letterSize}" height="${paddedHeight}"/>
</svg>`;
    
    fs.writeFileSync(path.join(outputDir, 'ovrsee_favicon.svg'), svgContent);
    console.log('✓ Created ovrsee_favicon.svg');
    
    // Generate PNGs
    const svgBuffer = Buffer.from(svgContent);
    
    await sharp(svgBuffer).resize(16, 16).png().toFile(path.join(outputDir, 'favicon-16x16.png'));
    console.log('✓ Created favicon-16x16.png');
    
    await sharp(svgBuffer).resize(32, 32).png().toFile(path.join(outputDir, 'favicon-32x32.png'));
    console.log('✓ Created favicon-32x32.png');
    
    await sharp(svgBuffer).resize(180, 180).png().toFile(path.join(outputDir, 'apple-touch-icon.png'));
    console.log('✓ Created apple-touch-icon.png');
    
    console.log('\nAll favicon files created successfully!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createFavicon();





