export const API_URL = 'https://api.hyperliquid.xyz';
export const WS_URL = 'wss://api.hyperliquid.xyz/ws';
export const INFO_URL = `${API_URL}/info`;

// Default HIP-3 market list, curated 2026-09-05. Order here is display-only;
// asset IDs must always use the original indices returned by perpDexs.
export const VISIBLE_HIP3_DEX_NAMES = ['xyz', 'para', 'mkts', 'io'] as const;
// Archive: Felix and VNTL were previously shown via automatic DEX discovery.
// They and other non-allowlisted DEXes are now hidden from the market overview.
// Keep their API metadata available on demand for existing positions/order history.

/** Exchange base URL: proxy server for geo-restricted regions. */
export function getExchangeBaseUrl(): string {
	return 'https://api.hyper-front.xyz';
}


// Arbitrum chain ID (used for Hyperliquid wallet signing)
export const ARBITRUM_CHAIN_ID = 42161;

// Candle interval options
export const CANDLE_INTERVALS = [
	{ label: '1m', value: '1m' },
	{ label: '5m', value: '5m' },
	{ label: '15m', value: '15m' },
	{ label: '1h', value: '1h' },
	{ label: '4h', value: '4h' },
	{ label: '1D', value: '1d' },
] as const;

export type CandleInterval = (typeof CANDLE_INTERVALS)[number]['value'];
