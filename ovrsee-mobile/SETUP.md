# OVRSEE Mobile - Setup Instructions

## ⚠️ Important: You Must Be in the Correct Directory

The mobile app is in the **`ovrsee-mobile`** folder. Make sure you're inside that directory before running any commands.

## Quick Setup

1. **Navigate to the mobile app directory:**
   ```bash
   cd ovrsee-mobile
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```
   
   If you see warnings about deprecated packages, that's normal and won't affect functionality.

3. **Start the development server:**
   ```bash
   npm start
   ```

4. **Run on your device:**
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Scan QR code with Expo Go app on your phone

## Troubleshooting

### Error: "Cannot determine the project's Expo SDK version"

**Cause**: You're running the command from the wrong directory.

**Solution**: 
```bash
# Make sure you're in the ovrsee-mobile directory
cd ovrsee-mobile
pwd  # Should show: /Users/nemo/cursor/COMMANDX/ovrsee-mobile

# Then run npm install and npm start
npm install
npm start
```

### Error: "expo module is not installed"

**Solution**:
```bash
cd ovrsee-mobile
npm install expo
npm install
```

### If dependencies fail to install

Try clearing the cache and reinstalling:
```bash
cd ovrsee-mobile
rm -rf node_modules package-lock.json
npm install
```

## Verification

After setup, you should see:
- ✅ Expo development server starting
- ✅ QR code displayed in terminal
- ✅ Options to open on iOS/Android/Web

## Next Steps

Once the app is running:
1. The app will open in Expo Go (if on device) or simulator
2. You'll see the OVRSEE mobile app with all 5 tabs
3. Mock data is loaded automatically for demonstration

## Project Structure

Remember: The mobile app is completely separate from the main Next.js project:
- **Main project**: `/Users/nemo/cursor/COMMANDX/` (Next.js)
- **Mobile app**: `/Users/nemo/cursor/COMMANDX/ovrsee-mobile/` (Expo/React Native)

You must be in the `ovrsee-mobile` directory to run mobile app commands.


