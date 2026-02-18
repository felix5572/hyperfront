// =============================================================================
// Hyperliquid price/size formatting rules
// =============================================================================
//
// Price: max 5 significant figures, max decimals = MAX_DECIMALS - szDecimals
//   MAX_DECIMALS = 6 (perp), 8 (spot)
//   Integer prices always valid regardless of sig figs.
//
// Size: rounded to szDecimals decimal places.

const SIG_FIGS = 5;
const MAX_DECIMALS_PERP = 6;
const MAX_DECIMALS_SPOT = 8;

// Compute the max decimal places allowed for a price
export function maxPriceDecimals(szDecimals: number, isSpot: boolean): number {
	const maxDec = isSpot ? MAX_DECIMALS_SPOT : MAX_DECIMALS_PERP;
	return maxDec - szDecimals;
}

// Compute the tick size (minimum price increment) for display
export function tickSize(price: number, szDecimals: number, isSpot: boolean): number {
	if (price === 0) return 0.01;
	const absP = Math.abs(price);
	// From 5 sig figs
	const magnitude = Math.floor(Math.log10(absP));
	const sigFigDecimals = Math.max(0, SIG_FIGS - 1 - magnitude);
	// From max decimals rule
	const maxDec = maxPriceDecimals(szDecimals, isSpot);
	// The actual number of decimals is the min of the two (more restrictive wins)
	const decimals = Math.min(sigFigDecimals, maxDec);
	return Math.pow(10, -decimals);
}

// Format a price per Hyperliquid display rules:
//   - 5 significant figures
//   - no more than (MAX_DECIMALS - szDecimals) decimal places
//   - integers always allowed
export function formatPrice(
	value: number | string,
	szDecimals = 0,
	isSpot = false
): string {
	const num = typeof value === 'string' ? parseFloat(value) : value;
	if (isNaN(num) || num === 0) return '0';

	const absNum = Math.abs(num);
	const magnitude = Math.floor(Math.log10(absNum));

	// Integer prices are always valid
	if (magnitude >= SIG_FIGS - 1) {
		return Math.round(num).toString();
	}

	// Decimals from 5 sig figs
	const sigFigDecimals = Math.max(0, SIG_FIGS - 1 - magnitude);
	// Decimals from max rule
	const maxDec = maxPriceDecimals(szDecimals, isSpot);
	// Use the more restrictive
	const decimals = Math.min(sigFigDecimals, maxDec);

	return num.toFixed(decimals);
}

// Conservative mid price: bid floors down, ask ceils up
export function formatMid(
	bid: number | string,
	ask: number | string,
	szDecimals = 0,
	isSpot = false
): { bid: string; ask: string; mid: string } {
	const b = typeof bid === 'string' ? parseFloat(bid) : bid;
	const a = typeof ask === 'string' ? parseFloat(ask) : ask;
	if (isNaN(b) || isNaN(a) || b === 0 || a === 0) {
		return { bid: formatPrice(b, szDecimals, isSpot), ask: formatPrice(a, szDecimals, isSpot), mid: '0' };
	}

	const midRaw = (a + b) / 2;
	const t = tickSize(midRaw, szDecimals, isSpot);
	const absP = Math.abs(midRaw);
	const magnitude = Math.floor(Math.log10(absP));
	const sigFigDecimals = Math.max(0, SIG_FIGS - 1 - magnitude);
	const maxDec = maxPriceDecimals(szDecimals, isSpot);
	const decimals = Math.min(sigFigDecimals, maxDec);

	// Conservative rounding: bid floors, ask ceils
	const bidFloored = Math.floor(b / t) * t;
	const askCeiled = Math.ceil(a / t) * t;
	const mid = (bidFloored + askCeiled) / 2;

	return {
		bid: bidFloored.toFixed(decimals),
		ask: askCeiled.toFixed(decimals),
		mid: mid.toFixed(decimals)
	};
}

// Format size/quantity rounded to szDecimals
export function formatSize(value: number | string, szDecimals = 0): string {
	const num = typeof value === 'string' ? parseFloat(value) : value;
	if (isNaN(num)) return '0';
	if (szDecimals <= 0) return Math.round(num).toString();
	// Remove trailing zeros
	return parseFloat(num.toFixed(szDecimals)).toString();
}

// =============================================================================
// General formatting helpers
// =============================================================================

// Format USD value with appropriate precision
export function formatUsd(value: number | string, _compact = false): string {
	const num = typeof value === 'string' ? parseFloat(value) : value;
	if (isNaN(num)) return '$0.00';
	return num.toLocaleString('en-US', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	});
}

// Format percentage
export function formatPct(value: number | string, decimals = 2): string {
	const num = typeof value === 'string' ? parseFloat(value) : value;
	if (isNaN(num)) return '0%';
	const sign = num > 0 ? '+' : '';
	return `${sign}${(num * 100).toFixed(decimals)}%`;
}

// Truncate ethereum address (6 chars start + 6 chars end)
export function truncateAddress(address: string): string {
	if (!address) return '';
	return `${address.slice(0, 6)}…${address.slice(-6)}`;
}

// Timestamp to locale time string
export function formatTime(ts: number): string {
	return new Date(ts).toLocaleTimeString('en-US', {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false
	});
}
