const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const inputFile = path.join(__dirname, '../public/ovrsee_stacked_transparent.png');
const outputDir = path.join(__dirname, '../public');

async function createFaviconHorizontal() {
  try {
    console.log('Creating horizontal OS favicon (O and S side by side)...\n');
    
    const metadata = await sharp(inputFile).metadata();
    const width = metadata.width;
    const height = metadata.height;
    const rowHeight = Math.floor(height / 2);
    const letterWidth = Math.floor(width / 3);
    
    console.log(`Logo dimensions: ${width}x${height}`);
    console.log(`Row height: ${rowHeight}, Letter width: ${letterWidth}\n`);
    
    // Extract O from top row (first letter, left side)
    const letterO = await sharp(inputFile)
      .extract({
        left: 0,
        top: 0,
        width: Math.floor(letterWidth * 0.95),
        height: Math.floor(rowHeight * 0.98)
      })
      .toBuffer();
    
    // Extract S from bottom row (first letter, left side)
    const sTop = Math.floor(rowHeight * 0.95);
    const sHeight = Math.min(Math.floor(rowHeight * 1.1), height - sTop);
    const letterS = await sharp(inputFile)
      .extract({
        left: 0,
        top: sTop,
        width: Math.floor(letterWidth * 0.95),
        height: sHeight
      })
      .toBuffer();
    
    // Get dimensions
    const oMeta = await sharp(letterO).metadata();
    const sMeta = await sharp(letterS).metadata();
    
    // Use the taller letter height as reference for consistent sizing
    const letterHeight = Math.max(oMeta.height, sMeta.height);
    const letterWidthFinal = Math.max(oMeta.width, sMeta.width);
    
    // Resize both letters to same height, maintaining aspect ratio
    const resizedO = await sharp(letterO)
      .resize(null, letterHeight, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .toBuffer();
    
    const resizedS = await sharp(letterS)
      .resize(null, letterHeight, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .toBuffer();
    
    // Get final dimensions after resize
    const oFinal = await sharp(resizedO).metadata();
    const sFinal = await sharp(resizedS).metadata();
    
    // Create filled black versions
    const blackO = await sharp(resizedO)
      .greyscale()
      .threshold(100)
      .toBuffer();
    
    const blackS = await sharp(resizedS)
      .greyscale()
      .threshold(100)
      .toBuffer();
    
    // Create final versions with transparent background
    const finalO = await sharp({
      create: {
        width: oFinal.width,
        height: oFinal.height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
    .composite([{ input: blackO, blend: 'over' }])
    .png()
    .toBuffer();
    
    const finalS = await sharp({
      create: {
        width: sFinal.width,
        height: sFinal.height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
    .composite([{ input: blackS, blend: 'over' }])
    .png()
    .toBuffer();
    
    // Calculate spacing - use a small gap between letters (about 5% of letter width)
    const gap = Math.floor(letterWidthFinal * 0.05);
    const totalWidth = oFinal.width + gap + sFinal.width;
    const totalHeight = letterHeight;
    
    // Create horizontal OS group
    const osGroup = await sharp({
      create: {
        width: totalWidth,
        height: totalHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
    .composite([
      { input: finalO, left: 0, top: 0 },
      { input: finalS, left: oFinal.width + gap, top: 0 }
    ])
    .png()
    .toBuffer();
    
    const groupMeta = await sharp(osGroup).metadata();
    
    console.log(`OS group dimensions: ${groupMeta.width}x${groupMeta.height}`);
    console.log(`O: ${oFinal.width}x${oFinal.height}, S: ${sFinal.width}x${sFinal.height}\n`);
    
    // Create SVG favicon with viewBox="0 0 100 100"
    // Use generous padding but make letters fill most of the space
    const topPadding = 10; // 10% padding
    const bottomPadding = 10;
    const leftPadding = 10;
    const rightPadding = 10;
    const contentHeight = 100 - topPadding - bottomPadding; // 80 units
    const contentWidth = 100 - leftPadding - rightPadding; // 80 units
    
    // Calculate scale to fit group in content area
    const scaleByHeight = contentHeight / groupMeta.height;
    const scaleByWidth = contentWidth / groupMeta.width;
    const scale = Math.min(scaleByHeight, scaleByWidth) * 0.95; // 95% for small margin
    
    const scaledWidth = groupMeta.width * scale;
    const scaledHeight = groupMeta.height * scale;
    
    // Center horizontally and vertically
    const groupX = leftPadding + (contentWidth - scaledWidth) / 2;
    const groupY = topPadding + (contentHeight - scaledHeight) / 2;
    
    console.log(`Scaling calculations:`);
    console.log(`  - Original: ${groupMeta.width}x${groupMeta.height}`);
    console.log(`  - Scaled: ${scaledWidth.toFixed(2)}x${scaledHeight.toFixed(2)}`);
    console.log(`  - Position: x=${groupX.toFixed(2)}, y=${groupY.toFixed(2)}\n`);
    
    // Create SVG
    const base64Image = osGroup.toString('base64');
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
  <image href="data:image/png;base64,${base64Image}" x="${groupX.toFixed(2)}" y="${groupY.toFixed(2)}" width="${scaledWidth.toFixed(2)}" height="${scaledHeight.toFixed(2)}"/>
</svg>`;
    
    fs.writeFileSync(path.join(outputDir, 'favicon.svg'), svgContent);
    console.log('✓ Created favicon.svg');
    
    // Generate PNG files directly from the OS group
    const createPNG = async (size, filename) => {
      const scaleFactor = size / 100;
      const imgWidth = Math.round(scaledWidth * scaleFactor);
      const imgHeight = Math.round(scaledHeight * scaleFactor);
      const imgX = Math.round(groupX * scaleFactor);
      const imgY = Math.round(groupY * scaleFactor);
      
      const png = await sharp({
        create: {
          width: size,
          height: size,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
      })
      .composite([{
        input: await sharp(osGroup)
          .resize(imgWidth, imgHeight, { fit: 'contain' })
          .toBuffer(),
        left: imgX,
        top: imgY
      }])
      .png()
      .toBuffer();
      
      fs.writeFileSync(path.join(outputDir, filename), png);
      console.log(`✓ Created ${filename}`);
    };
    
    await createPNG(16, 'favicon-16x16.png');
    await createPNG(32, 'favicon-32x32.png');
    await createPNG(64, 'favicon-64x64.png');
    
    // ICO file (32x32)
    const ico32 = await sharp({
      create: {
        width: 32,
        height: 32,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
    .composite([{
      input: await sharp(osGroup)
        .resize(Math.round(scaledWidth * 0.32), Math.round(scaledHeight * 0.32), { fit: 'contain' })
        .toBuffer(),
      left: Math.round(groupX * 0.32),
      top: Math.round(groupY * 0.32)
    }])
    .png()
    .toBuffer();
    fs.writeFileSync(path.join(outputDir, 'favicon.ico'), ico32);
    console.log('✓ Created favicon.ico');
    
    // Apple touch icon
    const appleIcon = await sharp(osGroup)
      .resize(180, 180, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    fs.writeFileSync(path.join(outputDir, 'apple-touch-icon.png'), appleIcon);
    console.log('✓ Created apple-touch-icon.png');
    
    console.log('\n✅ All favicon files created successfully!');
    console.log(`\nFavicon details:`);
    console.log(`  - Design: O and S side by side (horizontal)`);
    console.log(`  - ViewBox: 0 0 100 100`);
    console.log(`  - Padding: 10% on all sides`);
    console.log(`  - Letters: Same design as logo, properly sized`);
    
  } catch (error) {
    console.error('Error creating favicon:', error);
    process.exit(1);
  }
}

createFaviconHorizontal();




