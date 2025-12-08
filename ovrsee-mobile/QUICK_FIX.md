# ✅ Fixed: Missing Script Error

## Problem
You tried to run `npm run dev:3000` but it wasn't defined.

## Solution
I've added the `dev:3000` script to your `package.json`.

## Now You Can Run:

```bash
npm run dev:3000
```

This will start the Expo app on web at port 3000.

## Alternative Commands

If `dev:3000` doesn't work as expected, you can also use:

```bash
# Start Expo (will show a menu)
npm start

# Then press 'w' to open web

# OR directly start web:
npm run web
```

## Note About Ports

- Expo web typically runs on port **19006** by default
- The `dev:3000` script will try to use port 3000
- If port 3000 is in use, Expo will suggest another port
- Check the terminal output for the actual URL

## Quick Start

```bash
cd /Users/nemo/cursor/COMMANDX/ovrsee-mobile
npm run dev:3000
```

The app will open in your browser automatically! 🎉




