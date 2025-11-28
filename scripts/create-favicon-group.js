const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const inputFile = path.join(__dirname, '../public/ovrsee_stacked_transparent.png');
const outputDir = path.join(__dirname, '../public');

async function createFaviconGroup() {
  try {
    console.log('Creating favicon from O+S group (maintaining exact spacing)...\n');
    
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
    
    // Extract O and S together as ONE GROUP
    // O is in top row, first letter (left side)
    // S is in bottom row, first letter (left side)
    // Extract from top of O to bottom of S, maintaining their exact spacing
    
    // Calculate extraction bounds for the O+S group
    const groupTop = 0; // Start from top of O
    const groupLeft = 0; // Start from left edge
    const groupWidth = Math.floor(letterWidth * 0.95); // Width of one letter
    const groupHeight = height; // Full height to capture both rows with spacing
    
    // Extract the O+S group as one image
    const osGroup = await sharp(blackLogo)
      .extract({
        left: groupLeft,
        top: groupTop,
        width: groupWidth,
        height: groupHeight
      })
      .toBuffer();
    
    // Get group dimensions
    const groupMeta = await sharp(osGroup).metadata();
    const groupAspectRatio = groupMeta.width / groupMeta.height;
    
    console.log(`O+S group dimensions: ${groupMeta.width}x${groupMeta.height}`);
    console.log(`Aspect ratio: ${groupAspectRatio.toFixed(3)}\n`);
    
    // Create filled black version using alpha channel as mask
    const filledGroup = await sharp({
      create: {
        width: groupMeta.width,
        height: groupMeta.height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 255 }
      }
    })
    .composite([{ input: osGroup, blend: 'dest-in' }])
    .png()
    .toBuffer();
    
    // Create SVG favicon with viewBox="0 0 100 100"
    // Padding: 15% top and bottom = 15 units each, leaving 70 units for content
    const topPadding = 15; // 15% of 100
    const bottomPadding = 15; // 15% of 100
    const contentHeight = 100 - topPadding - bottomPadding; // 70 units
    const contentWidth = 100; // Full width
    
    // Calculate scale to fit group in content area
    // Group should fit within contentHeight, maintaining aspect ratio
    const scaleByHeight = contentHeight / groupMeta.height;
    const scaleByWidth = contentWidth / groupMeta.width;
    const scale = Math.min(scaleByHeight, scaleByWidth) * 0.95; // 95% to add small margin
    
    const scaledWidth = groupMeta.width * scale;
    const scaledHeight = groupMeta.height * scale;
    
    // Center horizontally
    const groupX = (100 - scaledWidth) / 2;
    
    // Center vertically in content area (between y=15 and y=85)
    const groupY = topPadding + (contentHeight - scaledHeight) / 2;
    
    console.log(`Scaling calculations:`);
    console.log(`  - Original: ${groupMeta.width}x${groupMeta.height}`);
    console.log(`  - Scaled: ${scaledWidth.toFixed(2)}x${scaledHeight.toFixed(2)}`);
    console.log(`  - Position: x=${groupX.toFixed(2)}, y=${groupY.toFixed(2)}`);
    console.log(`  - Scale factor: ${scale.toFixed(3)}\n`);
    
    // Create SVG with proper viewBox - embed O+S group as single image
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
  <image href="data:image/png;base64,${filledGroup.toString('base64')}" x="${groupX.toFixed(2)}" y="${groupY.toFixed(2)}" width="${scaledWidth.toFixed(2)}" height="${scaledHeight.toFixed(2)}"/>
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
    
    // Generate ICO file
    const ico32 = await sharp(svgBuffer).resize(32, 32).png().toBuffer();
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
    console.log(`  - Padding: 15% top and bottom`);
    console.log(`  - Content area: 70 units (y: 15 to 85)`);
    console.log(`  - O+S group treated as single unit: Yes`);
    console.log(`  - Spacing between O and S: Preserved from original logo`);
    
  } catch (error) {
    console.error('Error creating favicon:', error);
    process.exit(1);
  }
}

createFaviconGroup();

