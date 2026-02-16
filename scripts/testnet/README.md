# Hyperliquid Testnet Exchange Smoke Test

This script runs critical exchange API checks on Hyperliquid testnet:

1. place order
2. modify single order
3. cancel single order
4. cancel all (by submitting 2 orders then batch cancel)
5. update leverage
6. update isolated margin (if a position exists)

## Run

```bash
cd hyperfront
HL_TESTNET_PRIVATE_KEY=0xyour_testnet_key \
HL_TESTNET_COIN=HYPE \
npm run test:exchange:testnet
```

Optional env vars:

- `HL_TESTNET_API_URL` (default: `https://api.hyperliquid-testnet.xyz`)
- `HL_TESTNET_ORDER_NOTIONAL_USD` (default: `12`)
- `HL_TESTNET_LEVERAGE` (default: `2`)
- `HL_TESTNET_ISO_MARGIN_DELTA_USD` (default: `1`)

## Output

The script prints JSON lines with step-by-step results, including key exchange responses (`statuses`, `oid`, errors).

## Note on IDs (HYPE example)

- Mainnet token ID: `150`
- Mainnet spot ID: `107`
- Testnet token ID: `1105`
- Testnet spot ID: `1035`

The script does not hardcode these IDs. It resolves IDs dynamically from `metaAndAssetCtxs` and `spotMetaAndAssetCtxs` on testnet.
