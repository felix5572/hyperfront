# Hyperfront

Unofficial mobile-first frontend for Hyperliquid, built for emergency monitoring and lightweight trading when desktop is unavailable.

## Disclaimer

- Hyperfront is an unofficial community frontend related to the Hyperliquid ecosystem and is **not created, maintained, or endorsed by the official Hyperliquid development team**.
- This project is provided "as is" without warranties of any kind.
- Use at your own risk. You are fully responsible for all actions, transactions, and losses.
- This project is not investment, legal, or tax advice.
- No custody: Hyperfront does not store private keys or seed phrases on a backend.
- Wallet operations are signature-based; only approve actions you understand.

## What It Supports

- Market watch for Perp, Spot, and HIP-3 assets
- Order placement and order management on mobile
- Open orders, fills, and history views
- Basic account info page (subaccounts, referral, fees, abstraction)
- PWA install support for mobile home screen usage

## Security Model

- Hyperfront does not ask for your private key or seed phrase in normal operation.
- Wallet interaction is done via wallet authorization/signature when needed (for example, place/cancel orders).
- Prefer using an agent wallet with limited permissions and small balances on mobile.

## Local Development

```sh
npm install
npm run dev
```

## Build

```sh
npm run build
npm run preview
```

## Deploy (DigitalOcean Recommended)

### Option A: App Platform (Static Site)

- Runtime: Static Site
- Build command: `npm ci && npm run build`
- Output directory: `build`
- Root directory: `hyperfront`
- Enable auto-deploy from your Git branch

### Option B: Droplet + Nginx

Build locally or in CI, then upload `build/` to server (for example `/var/www/hyperfront`) and use an SPA fallback:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/hyperfront;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
    add_header Content-Security-Policy "default-src 'self'; connect-src 'self' https://api.hyperliquid.xyz https://api.hyperliquid-testnet.xyz wss://api.hyperliquid.xyz wss://api.hyperliquid-testnet.xyz; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self' data:;" always;
}
```

Then terminate TLS with Let's Encrypt (Certbot) or Caddy.

## Production Checklist

- Verify current network endpoint (mainnet/testnet) in UI before trading
- Confirm disclaimer is visible in `Info`
- Confirm websocket error visibility in UI (no silent failure)
- Fix/verify PWA icon dimensions in manifest (`192x192`, `512x512`)
- Keep dependencies updated and pin lockfile in CI

## PWA Install Notes

- Android/Chromium browsers: install prompt is usually available.
- iOS Safari: install is usually manual via `Share -> Add to Home Screen`.

## Security Notes

- Prefer using an agent wallet with limited permissions.
- Keep balances small for operational/mobile usage.
- Verify domain and TLS before wallet interactions.
