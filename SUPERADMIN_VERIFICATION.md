# Superadmin Account Verification

## Superadmin Configuration

**Configured Superadmin Email:** `usecmdr@gmail.com`

**Location:** `lib/config/superAdmins.ts`

## Superadmin Privileges

Superadmins have:
- ✅ Access to all agents (Sync, Aloha, Studio, Insight)
- ✅ Treated as "elite" tier for all feature checks
- ✅ Account mode set to "subscribed" (bypasses all paywalls)
- ✅ Bypass all subscription and trial restrictions

## Verification Steps

### 1. Check Superadmin Status

Visit the diagnostic endpoint:
```
https://ovrsee.ai/api/auth/check-superadmin
```

This will show:
- Whether you're authenticated
- Your email address
- Whether you're recognized as a superadmin
- Detailed email matching information
- Configuration details

### 2. Check Agent Access

Visit:
```
https://ovrsee.ai/api/user/agents
```

This should return:
```json
{
  "ok": true,
  "agents": ["sync", "aloha", "studio", "insight"],
  "isAdmin": true,
  "isSuperAdmin": true
}
```

### 3. Check Account Mode

Superadmins should have account mode set to `"subscribed"` regardless of subscription status.

## Common Issues

### Issue 1: Not Recognized as Superadmin

**Symptoms:**
- `/api/auth/check-superadmin` shows `isSuperAdmin: false`
- Limited access to agents
- Paywalls still showing

**Possible Causes:**
1. **Email Mismatch**: Email doesn't match exactly (case-insensitive check should handle this)
2. **Session Not Persisting**: Cookie issue (should be fixed with recent middleware update)
3. **Email Not in Session**: User email not available in session

**Fix:**
- Verify email in session matches `usecmdr@gmail.com` exactly
- Check `/api/auth/check-superadmin` for email matching details
- Clear cookies and re-login if session issue

### Issue 2: Session Not Persisting

**Symptoms:**
- Login works but session lost on refresh
- Superadmin status not recognized after page reload

**Fix:**
- This should be fixed with the recent cookie domain update
- Verify cookies have domain `.ovrsee.ai` in production
- Check `/api/auth/check-config` for cookie configuration

### Issue 3: Access Check Failing

**Symptoms:**
- Superadmin status recognized but access still denied
- API returns empty agents array

**Possible Causes:**
1. **API Route Issue**: `/api/user/agents` not checking superadmin correctly
2. **Cache Issue**: Client-side cache not updating
3. **Session Token Issue**: Access token not being passed correctly

**Fix:**
- Check browser console for errors
- Verify `/api/user/agents` response
- Clear browser cache and reload

## Testing Checklist

- [ ] Can log in with `usecmdr@gmail.com`
- [ ] Session persists after page refresh
- [ ] `/api/auth/check-superadmin` shows `isSuperAdmin: true`
- [ ] `/api/user/agents` returns all agents
- [ ] Account mode is `"subscribed"`
- [ ] Can access all agent pages (Sync, Aloha, Studio, Insight)
- [ ] No paywalls or subscription prompts
- [ ] Preview banner doesn't show (if applicable)

## Diagnostic Endpoints

### Check Superadmin Status
```
GET /api/auth/check-superadmin
```

### Check Agent Access
```
GET /api/user/agents
Authorization: Bearer <access_token>
```

### Check Configuration
```
GET /api/auth/check-config
```

### Verify Account
```
GET /api/auth/verify-account
Authorization: Bearer <access_token>
```

## Code Locations

- **Superadmin Config**: `lib/config/superAdmins.ts`
- **Auth Check**: `lib/auth.ts` → `isSuperAdmin()`
- **Agent Access**: `app/api/user/agents/route.ts`
- **Account Mode**: `lib/account-mode.ts` → `getAccountMode()`
- **Client Hook**: `hooks/useAgentAccess.ts`

## Related Files

- `middleware.ts` - Cookie configuration (recently fixed)
- `components/modals/AuthModal.tsx` - OAuth login
- `context/AppStateContext.tsx` - Session management

## Next Steps

1. **Test on Live Site:**
   - Log in with `usecmdr@gmail.com`
   - Visit `/api/auth/check-superadmin`
   - Verify `isSuperAdmin: true`

2. **If Not Working:**
   - Check email matching in diagnostic endpoint
   - Verify session persistence
   - Check browser console for errors
   - Review server logs for authentication issues

3. **If Working:**
   - Test all agent pages
   - Verify no paywalls
   - Confirm full access to all features




