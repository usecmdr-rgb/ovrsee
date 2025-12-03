const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const inputFile = path.join(__dirname, '../public/ovrsee_stacked_transparent.png');
const outputDir = path.join(__dirname, '../public');

async function createFaviconFixed() {
  try {
    console.log('Creating fixed favicon from O+S group...\n');
    
    const metadata = await sharp(inputFile).metadata();
    const width = metadata.width;
    const height = metadata.height;
    const rowHeight = Math.floor(height / 2);
    const letterWidth = Math.floor(width / 3);
    
    console.log(`Logo dimensions: ${width}x${height}`);
    console.log(`Row height: ${rowHeight}, Letter width: ${letterWidth}\n`);
    
    // Extract O and S together as ONE GROUP
    const groupTop = 0;
    const groupLeft = 0;
    const groupWidth = Math.floor(letterWidth * 0.95);
    const groupHeight = height;
    
    // Extract the O+S group
    const osGroup = await sharp(inputFile)
      .extract({
        left: groupLeft,
        top: groupTop,
        width: groupWidth,
        height: groupHeight
      })
      .toBuffer();
    
    // Get group dimensions
    const groupMeta = await sharp(osGroup).metadata();
    
    // Create a solid black version - ensure letters are fully opaque and black
    // First, make it grayscale and then threshold to ensure solid black
    const blackGroup = await sharp(osGroup)
      .greyscale()
      .threshold(128) // Convert to pure black/white
      .toBuffer();
    
    // Create filled black version with white background for visibility
    const filledGroup = await sharp({
      create: {
        width: groupMeta.width,
        height: groupMeta.height,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 255 } // White background
      }
    })
    .composite([{ 
      input: blackGroup, 
      blend: 'multiply' // This will make black areas stay black
    }])
    .png()
    .toBuffer();
    
    // Now invert to get black letters on transparent background
    const finalGroup = await sharp(filledGroup)
      .negate({ alpha: false }) // Invert colors but keep alpha
      .toBuffer();
    
    // Create SVG favicon with viewBox="0 0 100 100"
    const topPadding = 15;
    const bottomPadding = 15;
    const contentHeight = 100 - topPadding - bottomPadding;
    const contentWidth = 100;
    
    // Calculate scale
    const scaleByHeight = contentHeight / groupMeta.height;
    const scaleByWidth = contentWidth / groupMeta.width;
    const scale = Math.min(scaleByHeight, scaleByWidth) * 0.90; // 90% for margin
    
    const scaledWidth = groupMeta.width * scale;
    const scaledHeight = groupMeta.height * scale;
    
    // Center horizontally
    const groupX = (100 - scaledWidth) / 2;
    
    // Center vertically
    const groupY = topPadding + (contentHeight - scaledHeight) / 2;
    
    console.log(`Scaling calculations:`);
    console.log(`  - Original: ${groupMeta.width}x${groupMeta.height}`);
    console.log(`  - Scaled: ${scaledWidth.toFixed(2)}x${scaledHeight.toFixed(2)}`);
    console.log(`  - Position: x=${groupX.toFixed(2)}, y=${groupY.toFixed(2)}\n`);
    
    // Create SVG with proper viewBox - use base64 embedded image
    const base64Image = finalGroup.toString('base64');
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
  <image href="data:image/png;base64,${base64Image}" x="${groupX.toFixed(2)}" y="${groupY.toFixed(2)}" width="${scaledWidth.toFixed(2)}" height="${scaledHeight.toFixed(2)}"/>
</svg>`;
    
    // Save SVG favicon
    fs.writeFileSync(path.join(outputDir, 'favicon.svg'), svgContent);
    console.log('✓ Created favicon.svg');
    
    // Generate PNG versions directly from the group image (not from SVG)
    // This ensures they're properly rendered
    const png16 = await sharp(finalGroup)
      .resize(Math.round(groupMeta.width * scale * 0.16), Math.round(groupMeta.height * scale * 0.16), {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .extend({
        top: Math.round(groupY * 0.16),
        bottom: Math.round((100 - groupY - scaledHeight) * 0.16),
        left: Math.round(groupX * 0.16),
        right: Math.round(groupX * 0.16),
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .resize(16, 16, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    
    const png32 = await sharp(finalGroup)
      .resize(Math.round(groupMeta.width * scale * 0.32), Math.round(groupMeta.height * scale * 0.32), {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .extend({
        top: Math.round(groupY * 0.32),
        bottom: Math.round((100 - groupY - scaledHeight) * 0.32),
        left: Math.round(groupX * 0.32),
        right: Math.round(groupX * 0.32),
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    
    const png64 = await sharp(finalGroup)
      .resize(Math.round(groupMeta.width * scale * 0.64), Math.round(groupMeta.height * scale * 0.64), {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .extend({
        top: Math.round(groupY * 0.64),
        bottom: Math.round((100 - groupY - scaledHeight) * 0.64),
        left: Math.round(groupX * 0.64),
        right: Math.round(groupX * 0.64),
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    
    // Save PNG files
    fs.writeFileSync(path.join(outputDir, 'favicon-16x16.png'), png16);
    console.log('✓ Created favicon-16x16.png');
    
    fs.writeFileSync(path.join(outputDir, 'favicon-32x32.png'), png32);
    console.log('✓ Created favicon-32x32.png');
    
    fs.writeFileSync(path.join(outputDir, 'favicon-64x64.png'), png64);
    console.log('✓ Created favicon-64x64.png');
    
    // Generate ICO file
    fs.writeFileSync(path.join(outputDir, 'favicon.ico'), png32);
    console.log('✓ Created favicon.ico');
    
    // Apple touch icon
    const appleIcon = await sharp(finalGroup)
      .resize(180, 180, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toBuffer();
    fs.writeFileSync(path.join(outputDir, 'apple-touch-icon.png'), appleIcon);
    console.log('✓ Created apple-touch-icon.png');
    
    console.log('\n✅ All favicon files created successfully!');
    console.log(`\nFavicon details:`);
    console.log(`  - ViewBox: 0 0 100 100`);
    console.log(`  - Padding: 15% top and bottom`);
    console.log(`  - O+S group: Black letters on transparent background`);
    console.log(`  - All PNG files generated directly from source`);
    
  } catch (error) {
    console.error('Error creating favicon:', error);
    process.exit(1);
    }
}

createFaviconFixed();




