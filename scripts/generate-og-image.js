/**
 * Generate OG image from SVG
 * This script requires sharp to be installed: npm install sharp
 * Run: node scripts/generate-og-image.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const logoPath = path.join(publicDir, 'ovrsee_logo_primary.svg');
const outputPath = path.join(publicDir, 'ovrsee_og.png');

async function generateOGImage() {
  if (!fs.existsSync(logoPath)) {
    console.error(`Error: ${logoPath} not found`);
    process.exit(1);
  }

  console.log('Generating OG image...');

  try {
    // Create 1200x630 image with logo centered
    await sharp({
      create: {
        width: 1200,
        height: 630,
        channels: 3,
        background: { r: 0, g: 0, b: 0 }
      }
    })
      .composite([
        {
          input: logoPath,
          top: 165, // Center vertically: (630 - 300) / 2
          left: 500, // Center horizontally: (1200 - 200) / 2
          blend: 'over'
        }
      ])
      .png()
      .toFile(outputPath);
    
    console.log(`✓ Generated ${outputPath} (1200x630)`);
  } catch (error) {
    console.error('Error generating OG image:', error);
    process.exit(1);
  }
}

generateOGImage().catch(console.error);

