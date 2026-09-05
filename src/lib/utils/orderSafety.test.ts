import { describe, expect, it } from 'vitest';
import { confirmationError, isFreshQuote, quoteFromBook, sameOrderContext, TRADE_QUOTE_MAX_AGE_MS } from './orderSafety';

const now = 100_000;
const book = { coin: 'xyz:GOLD', time: now, levels: [[{ px: '100', sz: '1' }], [{ px: '102', sz: '1' }]] as [{ px: string; sz: string }[], { px: string; sz: string }[]] };
const quote = quoteFromBook(book, 1, now)!;
const context = { coin: book.coin, account: '0xabc', walletClient: {}, isSpot: false };

describe('live trading price and confirmation safety', () => {
	it('computes mid only from a valid fresh two-sided book', () => {
		expect(quote.midPx).toBe('101');
		expect(isFreshQuote(quote, book.coin, now)).toBe(true);
		expect(isFreshQuote(quote, 'para:GOLD', now)).toBe(false);
		expect(isFreshQuote(quote, book.coin, now + TRADE_QUOTE_MAX_AGE_MS + 1)).toBe(false);
	});

	it.each([
		{ ...book, levels: [[], book.levels[1]] },
		{ ...book, levels: [book.levels[0], []] },
		{ ...book, levels: [[{ px: '103', sz: '1' }], book.levels[1]] },
		{ ...book, levels: [[{ px: 'NaN', sz: '1' }], book.levels[1]] },
		{ ...book, levels: [[{ px: '100', sz: '0' }], book.levels[1]] },
		{ ...book, time: now - TRADE_QUOTE_MAX_AGE_MS - 1 },
		{ ...book, time: now + 10_000 }
	])('rejects missing, crossed, invalid, or delayed books %#', (bad) => {
		expect(quoteFromBook(bad as typeof book, 1, now)).toBeNull();
	});

	it('rejects wallet, market, disconnect, and wallet-client changes', () => {
		for (const current of [
			{ ...context, account: '0xdef' }, { ...context, coin: 'BTC' },
			{ ...context, account: null }, { ...context, walletClient: {} }, { ...context, isSpot: true }
		]) {
			expect(sameOrderContext(context, current)).toBe(false);
			expect(confirmationError({ ...context, orderType: 'limit', quote: null }, current, null, now)).toContain('changed');
		}
	});

	it('expires the original market confirmation even if new quotes keep arriving', () => {
		const later = now + TRADE_QUOTE_MAX_AGE_MS + 1;
		const latest = quoteFromBook({ ...book, time: later }, 1, later);
		expect(confirmationError({ ...context, orderType: 'market', quote }, context, latest, later)).toContain('expired');
	});

	it('invalidates a confirmation across disconnect/reconnect and requires another review', () => {
		const order = { ...context, orderType: 'market' as const, quote };
		expect(confirmationError(order, context, null, now)).toContain('expired');
		expect(confirmationError(order, context, { ...quote, generation: 2 }, now)).toContain('reconnected');
		expect(confirmationError(order, context, quote, now)).toBeNull();
	});

	it('allows manually priced limit orders without live quotes but still pins the context', () => {
		expect(confirmationError({ ...context, orderType: 'limit', quote: null }, context, null, now)).toBeNull();
	});
});
