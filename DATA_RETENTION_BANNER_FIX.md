# Data Retention Banner Fix

## Issue Explanation

### Why the Banner Appears

The data retention banner appears when:
1. **Trial Expired**: User's 3-day free trial has ended, and they're in the 30-day retention window
2. **Paid Subscription Canceled/Paused**: User canceled or paused their paid subscription, and they're in the 60-day retention window
3. **Data Cleared**: User's data has been permanently deleted after the retention window expired

This is **correct behavior** - the banner is designed to warn users that their data will be (or has been) cleared if they don't reactivate.

### Why It Shows "29 Days" Instead of "30 Days"

The calculation is **mathematically correct**:

1. When a trial expires, `data_retention_expires_at` is set to `NOW() + 30 days` at the moment of expiration
2. The days remaining calculation uses: `Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24))`
3. If the trial expired 1 day ago, then `expiresAt - now = 29 days` (30 - 1 = 29)

**Example Timeline:**
- Day 0: Trial expires → `data_retention_expires_at = Day 0 + 30 days = Day 30`
- Day 1: User checks → Days remaining = `Day 30 - Day 1 = 29 days` ✅
- Day 29: User checks → Days remaining = `Day 30 - Day 29 = 1 day` ✅
- Day 30: User checks → Days remaining = `Day 30 - Day 30 = 0 days` → Data cleared

This is the expected behavior. The banner shows the **actual days remaining** until data deletion, not a fixed "30 days from now".

### Why It Wasn't Shown Properly

**Previous Issues:**
1. **Positioning**: The banner was not fixed, so it could scroll out of view
2. **Spacing**: The banner didn't account for the fixed header (`top-16` = 64px), causing overlap
3. **Layout**: Main content padding didn't account for banner height when visible

**Fixed Issues:**
1. ✅ Banner is now `fixed` at `top-16` (below the header)
2. ✅ Banner has proper z-index (`z-30`) to appear above content but below modals
3. ✅ Main content padding dynamically adjusts using CSS variable `--banner-height`
4. ✅ Wrapper component detects banner visibility and updates CSS variable

## Changes Made

### 1. Updated `DataRetentionBanner.tsx`
- Changed banner from relative to `fixed` positioning
- Positioned at `top-16` (below fixed header)
- Added proper z-index (`z-30`)
- Improved icon alignment with `flex-shrink-0 mt-0.5`
- Added `Math.max(0, daysRemaining ?? 0)` to ensure non-negative days

### 2. Created `DataRetentionBannerWrapper.tsx`
- Client component that wraps the banner
- Detects when banner is visible using MutationObserver
- Dynamically updates CSS variable `--banner-height` based on actual banner height
- Handles resize events to recalculate height

### 3. Updated `app/layout.tsx`
- Replaced `DataRetentionBanner` with `DataRetentionBannerWrapper`
- Updated main content padding to: `calc(var(--page-top-padding, 5rem) + var(--banner-height, 0px))`
- This ensures content is never hidden behind the fixed banner

### 4. Updated `app/globals.css`
- Added `--banner-height: 0px` CSS variable
- Defaults to 0 when banner is not visible

## Result

✅ Banner is now properly visible below the header
✅ Content spacing automatically adjusts when banner appears/disappears
✅ Days remaining calculation is accurate and shows actual time until data deletion
✅ Banner stays fixed at the top for better visibility
✅ No content overlap or layout issues

## Testing

To verify the fix:
1. **Trial Expired User**: Should see orange banner with days remaining countdown
2. **Paid Canceled User**: Should see blue banner with days remaining countdown
3. **Data Cleared User**: Should see amber banner indicating data has been cleared
4. **Active User**: Should not see any banner
5. **Layout**: Content should never be hidden behind the banner
6. **Days Calculation**: Should show accurate days remaining (may be 29, 28, etc. depending on when trial expired)

