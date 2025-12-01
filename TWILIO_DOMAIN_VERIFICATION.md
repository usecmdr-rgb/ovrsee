# Twilio Domain Verification - DNS Method

This guide shows you how to verify your domain with Twilio using DNS TXT records.

## Your Verification Token

**Token:** `70f961eb52238e5b9279bcb7a4af9475`

## DNS TXT Record Configuration

Add the following TXT record to your domain's DNS settings:

```
Type: TXT
Name: _twilio
Value: 70f961eb52238e5b9279bcb7a4af9475
TTL: 3600 (or default)
```

### Step-by-Step Instructions

1. **Access Your DNS Management:**
   - Log in to your domain registrar (e.g., GoDaddy, Namecheap, Cloudflare, etc.)
   - Navigate to DNS Management / DNS Settings

2. **Add the TXT Record:**
   - Click "Add Record" or "Create Record"
   - Select **TXT** as the record type
   - For the **Name/Host** field, enter: `_twilio`
     - Note: Some DNS providers may require just `_twilio` while others may require `_twilio.yourdomain.com`
     - If your provider shows the full domain automatically, that's fine
   - For the **Value/Content** field, enter: `70f961eb52238e5b9279bcb7a4af9475`
   - Set **TTL** to 3600 (or leave as default)
   - Save the record

3. **Verify in Twilio Console:**
   - Go to [Twilio Console](https://console.twilio.com)
   - Navigate to **Admin** → **Domains**
   - Find your domain and click **Verify Domain**
   - Twilio will check for the TXT record

4. **Wait for DNS Propagation:**
   - DNS changes can take a few minutes to 72 hours to propagate
   - You can check if the record is live using:
     ```bash
     dig _twilio.yourdomain.com TXT
     ```
   - Or use online tools like: https://dnschecker.org

## DNS Record Examples by Provider

### Cloudflare
- Type: `TXT`
- Name: `_twilio`
- Content: `70f961eb52238e5b9279bcb7a4af9475`
- TTL: `Auto` or `3600`

### GoDaddy
- Type: `TXT`
- Host: `_twilio`
- TXT Value: `70f961eb52238e5b9279bcb7a4af9475`
- TTL: `1 Hour`

### Namecheap
- Type: `TXT Record`
- Host: `_twilio`
- Value: `70f961eb52238e5b9279bcb7a4af9475`
- TTL: `Automatic`

### AWS Route 53
- Record Type: `TXT`
- Record Name: `_twilio`
- Value: `70f961eb52238e5b9279bcb7a4af9475`
- TTL: `3600`

## Verification Checklist

- [ ] TXT record added to DNS with name `_twilio`
- [ ] Value set to: `70f961eb52238e5b9279bcb7a4af9475`
- [ ] DNS record saved and propagated
- [ ] Verified in Twilio Console → Admin → Domains

## Troubleshooting

### DNS Not Propagating
- Wait up to 72 hours for full propagation
- Check DNS propagation: `dig _twilio.yourdomain.com TXT` or use https://dnschecker.org
- Ensure the record name is exactly `_twilio` (with underscore)

### Twilio Can't Verify
- Double-check the record name is `_twilio` (not `twilio` or `_Twilio`)
- Verify the value matches exactly: `70f961eb52238e5b9279bcb7a4af9475`
- Ensure DNS has propagated (can take time)
- Check that you're verifying the correct domain (root domain vs subdomain)

### Wrong Record Name Format
Some DNS providers automatically append the domain. That's fine! The important part is that when queried, `_twilio.yourdomain.com` returns the correct value.

## After Verification

Once verified, you can:
- Use the domain for Twilio Voice/SMS services
- Configure custom webhooks and callbacks
- Set up branded messaging and voice

## Quick Reference

**DNS TXT Record:**
```
Name: _twilio
Type: TXT
Value: 70f961eb52238e5b9279bcb7a4af9475
```

**Check DNS:**
```bash
dig _twilio.yourdomain.com TXT
```

**Twilio Console:**
https://console.twilio.com/us1/develop/runtime/admin/domains
