# OVRSEE Brand Assets

## Logo Files

All logo files are located in the `public/` directory:

- **`ovrsee_logo.svg`** - Main logo (stacked OVRSEE)
- **`ovrsee_logo_primary.svg`** - Primary stacked logo variant
- **`ovrsee_mark.svg`** - Compact mark (stylized O only)
- **`ovrsee_favicon.svg`** - Favicon source (stylized O)

## Generating Favicon and OG Image

### Option 1: Using Node.js (Recommended)

1. Install sharp:
   ```bash
   npm install sharp --save-dev
   ```

2. Generate assets:
   ```bash
   npm run generate:assets
   ```

This will create:
- `favicon.ico`
- `favicon-16x16.png`
- `favicon-32x32.png`
- `apple-touch-icon.png` (180x180)
- `android-chrome-192x192.png`
- `android-chrome-512x512.png`
- `ovrsee_og.png` (1200x630)

### Option 2: Using ImageMagick or Inkscape

Run the shell script:
```bash
npm run generate:assets:shell
```

Or manually:
```bash
chmod +x scripts/generate-assets.sh
./scripts/generate-assets.sh
```

## Using the Logos

### In React Components

```tsx
import Image from "next/image";

// Primary logo
<Image src="/ovrsee_logo_primary.svg" alt="OVRSEE" width={200} height={300} />

// Mark (compact)
<Image src="/ovrsee_mark.svg" alt="OVRSEE" width={40} height={40} />
```

### Animated Logo Component

The `AnimatedLogo` component supports both animated text and static SVG:

```tsx
// Animated text (default)
<AnimatedLogo />

// Static SVG logo
<AnimatedLogo useSvg={true} />
```

## Metadata

Favicon and OG image references are configured in `app/layout.tsx`:
- Favicons: `/ovrsee_favicon.svg`, `/favicon-16x16.png`, `/favicon-32x32.png`
- Apple touch icon: `/apple-touch-icon.png`
- OG image: `/ovrsee_og.png`
- Manifest: `/manifest.json`

## Notes

- All SVG files are optimized for web use
- Logo maintains aspect ratio at any size
- Black background (#000000) with white (#FFFFFF) logo
- All assets are vector-based for maximum quality



