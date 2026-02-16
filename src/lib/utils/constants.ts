export const API_URL = 'https://api.hyperliquid.xyz';
export const WS_URL = 'wss://api.hyperliquid.xyz/ws';
export const INFO_URL = `${API_URL}/info`;

/** Exchange base URL (configurable for proxy). Defaults to API_URL. */
export function getExchangeBaseUrl(): string {
	const url = typeof import.meta !== 'undefined' && import.meta.env?.VITE_EXCHANGE_URL;
	return (typeof url === 'string' && url.trim() !== '' ? url.trim() : API_URL).replace(/\/$/, '');
}

export const EXCHANGE_URL = `${API_URL}/exchange`;

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
