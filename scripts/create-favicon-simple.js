const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const inputFile = path.join(__dirname, '../public/ovrsee_stacked_transparent.png');
const outputDir = path.join(__dirname, '../public');

async function createFaviconSimple() {
  try {
    console.log('Creating simple, visible favicon from O+S group...\n');
    
    const metadata = await sharp(inputFile).metadata();
    const width = metadata.width;
    const height = metadata.height;
    const rowHeight = Math.floor(height / 2);
    const letterWidth = Math.floor(width / 3);
    
    // Extract O and S together as ONE GROUP
    const groupWidth = Math.floor(letterWidth * 0.95);
    const groupHeight = height;
    
    // Extract the O+S group
    const osGroup = await sharp(inputFile)
      .extract({
        left: 0,
        top: 0,
        width: groupWidth,
        height: groupHeight
      })
      .toBuffer();
    
    // Get group dimensions
    const groupMeta = await sharp(osGroup).metadata();
    
    // Create a properly filled black version
    // Use threshold to ensure solid black letters
    const blackGroup = await sharp(osGroup)
      .greyscale()
      .threshold(100) // Lower threshold to capture more of the letter
      .toBuffer();
    
    // Create a canvas with the black letters
    const finalGroup = await sharp({
      create: {
        width: groupMeta.width,
        height: groupMeta.height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
      }
    })
    .composite([{ 
      input: blackGroup,
      blend: 'over' // Overlay the black letters
    }])
    .png()
    .toBuffer();
    
    // Create SVG favicon
    const topPadding = 15;
    const bottomPadding = 15;
    const contentHeight = 100 - topPadding - bottomPadding;
    const contentWidth = 100;
    
    const scaleByHeight = contentHeight / groupMeta.height;
    const scaleByWidth = contentWidth / groupMeta.width;
    const scale = Math.min(scaleByHeight, scaleByWidth) * 0.85; // 85% for better visibility
    
    const scaledWidth = groupMeta.width * scale;
    const scaledHeight = groupMeta.height * scale;
    
    const groupX = (100 - scaledWidth) / 2;
    const groupY = topPadding + (contentHeight - scaledHeight) / 2;
    
    console.log(`Group: ${groupMeta.width}x${groupMeta.height}`);
    console.log(`Scaled: ${scaledWidth.toFixed(2)}x${scaledHeight.toFixed(2)}`);
    console.log(`Position: x=${groupX.toFixed(2)}, y=${groupY.toFixed(2)}\n`);
    
    // Create SVG
    const base64Image = finalGroup.toString('base64');
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
  <image href="data:image/png;base64,${base64Image}" x="${groupX.toFixed(2)}" y="${groupY.toFixed(2)}" width="${scaledWidth.toFixed(2)}" height="${scaledHeight.toFixed(2)}"/>
</svg>`;
    
    fs.writeFileSync(path.join(outputDir, 'favicon.svg'), svgContent);
    console.log('✓ Created favicon.svg');
    
    // Generate PNG files from the group directly with proper sizing
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
        input: await sharp(finalGroup)
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
    
    // ICO file
    const ico32 = await sharp({
      create: {
        width: 32,
        height: 32,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
    .composite([{
      input: await sharp(finalGroup)
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
    const appleIcon = await sharp(finalGroup)
      .resize(180, 180, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    fs.writeFileSync(path.join(outputDir, 'apple-touch-icon.png'), appleIcon);
    console.log('✓ Created apple-touch-icon.png');
    
    console.log('\n✅ All favicon files created successfully!');
    
  } catch (error) {
    console.error('Error creating favicon:', error);
    process.exit(1);
  }
}

createFaviconSimple();




