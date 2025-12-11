# ElSawa7 Deployment Guide

## Overview
This guide covers deploying ElSawa7 from Lovable with domain setup, SSL, and SEO configuration.

## Lovable Deployment

### 1. Deploy from Lovable
1. Click "Publish" in the top-right corner
2. Wait for build to complete
3. Your app is now live at `*.lovable.app`

### 2. Custom Domain Setup

#### A. Purchase/Configure Domain
Register a domain (e.g., `elsawa7.app`) from:
- Namecheap
- GoDaddy
- Cloudflare Registrar

#### B. Add Custom Domain in Lovable
1. Go to Project Settings → Domains
2. Click "Add Custom Domain"
3. Enter your domain (e.g., `elsawa7.app`)
4. Note the provided DNS records

#### C. Configure DNS Records
Add these records at your DNS provider:

```
Type: A
Name: @
Value: [Lovable IP provided]
TTL: 3600

Type: CNAME
Name: www
Value: [Lovable domain provided]
TTL: 3600
```

#### D. SSL Certificate
Lovable automatically provisions SSL via Let's Encrypt once DNS propagates.

## Cloudflare Setup (Recommended)

### 1. Add Site to Cloudflare
1. Create Cloudflare account
2. Add your domain
3. Update nameservers at registrar

### 2. Configure DNS
```
Type: A
Name: @
Content: [Lovable IP]
Proxy: ON (orange cloud)

Type: CNAME
Name: www
Content: elsawa7.app
Proxy: ON
```

### 3. SSL/TLS Settings
- Mode: Full (Strict)
- Always Use HTTPS: ON
- Automatic HTTPS Rewrites: ON

### 4. Performance Settings
- Auto Minify: JS, CSS, HTML
- Brotli: ON
- HTTP/3: ON

### 5. Security Settings
- Bot Fight Mode: ON
- Browser Integrity Check: ON
- Challenge Passage: 30 minutes

## SEO Configuration

### 1. Sitemap
Already created at `/sitemap.xml`. Update URLs to your domain:
```xml
<loc>https://elsawa7.app/</loc>
<loc>https://elsawa7.app/about</loc>
<loc>https://elsawa7.app/auth</loc>
```

### 2. Robots.txt
Already created at `/robots.txt`. Update sitemap URL:
```
Sitemap: https://elsawa7.app/sitemap.xml
```

### 3. Google Search Console
1. Go to https://search.google.com/search-console
2. Add property → Domain
3. Verify via DNS TXT record:
   ```
   Type: TXT
   Name: @
   Value: google-site-verification=XXXXXX
   ```
4. Submit sitemap: `https://elsawa7.app/sitemap.xml`

### 4. Schema.org Markup
Already included in `index.html`:
```json
{
  "@type": "LocalBusiness",
  "name": "ElSawa7",
  "alternateName": "السوّاح"
}
```

### 5. Open Graph Tags
Already configured:
```html
<meta property="og:title" content="ElSawa7 - السوّاح" />
<meta property="og:description" content="..." />
<meta property="og:image" content="/og-image.png" />
```

## PWA Installation

### Android
1. Visit site in Chrome
2. Tap menu → "Add to Home Screen"
3. Or use the "نزّل التطبيق" button

### iOS
1. Visit site in Safari
2. Tap Share → "Add to Home Screen"

## APK Generation (External)

Lovable cannot generate APKs. Use Capacitor:

### 1. Export Project to GitHub
Settings → GitHub → Export

### 2. Clone and Setup
```bash
git clone https://github.com/youruser/elsawa7.git
cd elsawa7
npm install
```

### 3. Initialize Capacitor
```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "ElSawa7" "app.elsawa7.mobile"
```

### 4. Configure capacitor.config.ts
```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.elsawa7.mobile',
  appName: 'ElSawa7',
  webDir: 'dist',
  server: {
    url: 'https://elsawa7.app',
    cleartext: true
  }
};

export default config;
```

### 5. Build and Add Android
```bash
npm run build
npx cap add android
npx cap sync android
```

### 6. Open in Android Studio
```bash
npx cap open android
```

### 7. Generate APK
In Android Studio:
- Build → Build Bundle(s) / APK(s) → Build APK(s)

### 8. Play Store Submission
1. Create Google Play Developer account ($25)
2. Create new app
3. Upload signed APK/AAB
4. Fill store listing with Arabic content
5. Submit for review

## Scheduled Jobs

### Expire Holds (TTL Enforcement)
Set up a cron job to call the edge function:

#### Option A: External Cron (cron-job.org)
URL: `https://[project-ref].supabase.co/functions/v1/expire-holds`
Schedule: Every 5 minutes

#### Option B: Supabase pg_cron
```sql
SELECT cron.schedule(
  'expire-holds',
  '*/5 * * * *',
  $$SELECT net.http_post(
    'https://[project-ref].supabase.co/functions/v1/expire-holds',
    '{}',
    '{}'::jsonb
  )$$
);
```

### Anomaly Detection
Same setup, run every hour:
```
URL: https://[project-ref].supabase.co/functions/v1/anomaly-detector
Schedule: 0 * * * * (hourly)
```

## Environment Variables

### Required Secrets (Already Set)
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- LOVABLE_API_KEY

### Optional (For External ML)
- ML_SERVICE_URL

## Monitoring

### Supabase Dashboard
- Edge Function logs
- Database metrics
- Auth events

### External (Recommended)
- Sentry for error tracking
- Datadog/New Relic for APM
- UptimeRobot for availability

## Troubleshooting

### Domain Not Working
1. Check DNS propagation: https://dnschecker.org
2. Wait 24-48 hours for full propagation
3. Verify records match Lovable requirements

### SSL Error
1. Ensure DNS is correctly configured
2. Wait for certificate provisioning (up to 24 hours)
3. Check Cloudflare SSL mode if using proxy

### PWA Not Installing
1. Ensure served over HTTPS
2. Check manifest.json is accessible
3. Verify service worker registration
