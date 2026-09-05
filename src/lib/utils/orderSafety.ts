// Fail closed for trading. Metadata/mark-price caches are never a substitute
// for a current, two-sided order book. Display-only prices can use other sources.
export const TRADE_QUOTE_MAX_AGE_MS = 15_000;
const MAX_CLOCK_SKEW_MS = 5_000;

export interface TradeQuote {
	coin: string;
	midPx: string;
	exchangeTime: number;
	receivedAt: number;
	generation: number;
}

export function isFreshQuote(quote: TradeQuote | null, coin: string, now = Date.now()): quote is TradeQuote {
	return !!quote && quote.coin === coin && Number.isFinite(Number(quote.midPx)) && Number(quote.midPx) > 0 &&
		now >= quote.receivedAt && now - quote.receivedAt <= TRADE_QUOTE_MAX_AGE_MS &&
		Number.isFinite(quote.exchangeTime) && quote.exchangeTime > 0 &&
		quote.exchangeTime <= now + MAX_CLOCK_SKEW_MS && now - quote.exchangeTime <= TRADE_QUOTE_MAX_AGE_MS;
}

export function quoteFromBook(
	book: { coin: string; time: number; levels: [Array<{ px: string; sz: string }>, Array<{ px: string; sz: string }>] },
	generation: number,
	now = Date.now()
): TradeQuote | null {
	const [bid, ask] = [book.levels[0][0], book.levels[1][0]];
	if (!bid || !ask) return null;
	const [bidPx, askPx, bidSize, askSize] = [Number(bid.px), Number(ask.px), Number(bid.sz), Number(ask.sz)];
	if (![bidPx, askPx, bidSize, askSize].every((n) => Number.isFinite(n) && n > 0) || askPx < bidPx) return null;
	const quote = { coin: book.coin, midPx: String(bidPx / 2 + askPx / 2), exchangeTime: book.time, receivedAt: now, generation };
	return isFreshQuote(quote, book.coin, now) ? quote : null;
}

export interface OrderContext {
	coin: string;
	account: string | null;
	walletClient: unknown;
	isSpot: boolean;
}

export function sameOrderContext(expected: OrderContext, current: OrderContext): boolean {
	return !!expected.account && !!current.account && !!expected.walletClient &&
		expected.account.toLowerCase() === current.account.toLowerCase() &&
		expected.walletClient === current.walletClient && expected.coin === current.coin && expected.isSpot === current.isSpot;
}

export function confirmationError(
	order: OrderContext & { orderType: 'market' | 'limit'; quote: TradeQuote | null },
	current: OrderContext,
	quote: TradeQuote | null,
	now = Date.now()
): string | null {
	if (!sameOrderContext(order, current)) return 'Wallet or market changed. Review the order again.';
	if (order.orderType === 'market' && (
		!isFreshQuote(order.quote, order.coin, now) || !isFreshQuote(quote, order.coin, now) ||
		order.quote.generation !== quote.generation
	)) return 'Market quote expired or the feed reconnected. Review the order again.';
	return null;
}
