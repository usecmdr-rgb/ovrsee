/**
 * Generate favicon files from SVG
 * This script requires sharp to be installed: npm install sharp
 * Run: node scripts/generate-favicons.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const faviconSvg = path.join(publicDir, 'ovrsee_favicon.svg');

// Sizes for different favicon formats
const sizes = [
  { size: 16, name: 'favicon-16x16.png' },
  { size: 32, name: 'favicon-32x32.png' },
  { size: 192, name: 'android-chrome-192x192.png' },
  { size: 512, name: 'android-chrome-512x512.png' },
  { size: 180, name: 'apple-touch-icon.png' },
];

async function generateFavicons() {
  if (!fs.existsSync(faviconSvg)) {
    console.error(`Error: ${faviconSvg} not found`);
    process.exit(1);
  }

  console.log('Generating favicon files from SVG...');

  for (const { size, name } of sizes) {
    try {
      await sharp(faviconSvg)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 1 }
        })
        .png()
        .toFile(path.join(publicDir, name));
      
      console.log(`✓ Generated ${name} (${size}x${size})`);
    } catch (error) {
      console.error(`Error generating ${name}:`, error);
    }
  }

  // Generate favicon.ico (16x16)
  try {
    await sharp(faviconSvg)
      .resize(16, 16, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 1 }
      })
      .png()
      .toFile(path.join(publicDir, 'favicon.ico'));
    
    console.log('✓ Generated favicon.ico');
  } catch (error) {
    console.error('Error generating favicon.ico:', error);
  }

  console.log('\nAll favicon files generated successfully!');
}

generateFavicons().catch(console.error);

