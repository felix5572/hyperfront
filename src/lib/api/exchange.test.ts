import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ── Module mocks (hoisted before imports by Vitest) ─────────────────────────

vi.mock('@nktkas/hyperliquid/signing', () => ({
	signL1Action: vi.fn().mockResolvedValue({ r: '0xaaa', s: '0xbbb', v: 28 })
}));

vi.mock('$lib/utils/constants', () => ({
	getExchangeBaseUrl: vi.fn().mockReturnValue('https://api.test')
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import {
	placeOrder,
	cancelOrder,
	cancelOrders,
	cancelOrdersByCloid,
	type PlaceOrderParams
} from './exchange';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal wallet — signTypedData never fires because signL1Action is mocked */
const fakeWallet = {
	address: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' as `0x${string}`,
	signTypedData: vi.fn()
};

const BASE_PARAMS: PlaceOrderParams = {
	asset: 3,
	side: 'buy',
	orderType: 'limit',
	price: '100.50',
	size: '0.5'
};

const mockFetch = vi.fn();

/** Successful exchange response wrapping the given statuses array */
function okRes(statuses: unknown[]) {
	return Promise.resolve({
		ok: true,
		status: 200,
		statusText: 'OK',
		text: () =>
			Promise.resolve(
				JSON.stringify({ status: 'ok', response: { type: 'order', data: { statuses } } })
			)
	});
}

/** Exchange-level failure (HTTP 200 but status !== 'ok') */
function exchErrRes() {
	return Promise.resolve({
		ok: true,
		status: 200,
		statusText: 'OK',
		text: () => Promise.resolve(JSON.stringify({ status: 'err', response: { type: 'order' } }))
	});
}

/** HTTP-level failure */
function httpErrRes(status = 400, body = 'Bad Request') {
	return Promise.resolve({
		ok: false,
		status,
		statusText: 'Error',
		text: () => Promise.resolve(body)
	});
}

/** Parse the body of the last fetch call */
function lastBody() {
	const call = mockFetch.mock.lastCall!;
	return JSON.parse(call[1].body as string) as {
		action: Record<string, unknown>;
		nonce: number;
		signature: { r: string; s: string; v: number };
		vaultAddress?: string;
	};
}

beforeEach(() => {
	vi.stubGlobal('fetch', mockFetch);
	mockFetch.mockReset();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

// ═════════════════════════════════════════════════════════════════════════════
// placeOrder — OrderWire construction
// ═════════════════════════════════════════════════════════════════════════════

describe('placeOrder — order wire construction', () => {
	it('sends action.type = "order"', async () => {
		mockFetch.mockReturnValueOnce(okRes([{ resting: { oid: 1 } }]));
		await placeOrder(fakeWallet, BASE_PARAMS);
		expect(lastBody().action.type).toBe('order');
	});

	it('market order → TIF becomes FrontendMarket', async () => {
		mockFetch.mockReturnValueOnce(okRes([{ resting: { oid: 1 } }]));
		await placeOrder(fakeWallet, { ...BASE_PARAMS, orderType: 'market' });
		const order = (lastBody().action.orders as { t: unknown }[])[0];
		expect(order.t).toEqual({ limit: { tif: 'FrontendMarket' } });
	});

	it('limit order with no explicit TIF → defaults to Gtc', async () => {
		mockFetch.mockReturnValueOnce(okRes([{ resting: { oid: 1 } }]));
		await placeOrder(fakeWallet, BASE_PARAMS);
		const order = (lastBody().action.orders as { t: unknown }[])[0];
		expect(order.t).toEqual({ limit: { tif: 'Gtc' } });
	});

	it('limit order with explicit Alo TIF → uses Alo', async () => {
		mockFetch.mockReturnValueOnce(okRes([{ resting: { oid: 1 } }]));
		await placeOrder(fakeWallet, { ...BASE_PARAMS, tif: 'Alo' });
		const order = (lastBody().action.orders as { t: unknown }[])[0];
		expect(order.t).toEqual({ limit: { tif: 'Alo' } });
	});

	it('limit order with explicit Ioc TIF → uses Ioc', async () => {
		mockFetch.mockReturnValueOnce(okRes([{ resting: { oid: 1 } }]));
		await placeOrder(fakeWallet, { ...BASE_PARAMS, tif: 'Ioc' });
		const order = (lastBody().action.orders as { t: unknown }[])[0];
		expect(order.t).toEqual({ limit: { tif: 'Ioc' } });
	});

	it('buy side → b = true', async () => {
		mockFetch.mockReturnValueOnce(okRes([{ resting: { oid: 1 } }]));
		await placeOrder(fakeWallet, { ...BASE_PARAMS, side: 'buy' });
		const order = (lastBody().action.orders as { b: unknown }[])[0];
		expect(order.b).toBe(true);
	});

	it('sell side → b = false', async () => {
		mockFetch.mockReturnValueOnce(okRes([{ resting: { oid: 1 } }]));
		await placeOrder(fakeWallet, { ...BASE_PARAMS, side: 'sell' });
		const order = (lastBody().action.orders as { b: unknown }[])[0];
		expect(order.b).toBe(false);
	});

	it('asset, price, size pass through correctly', async () => {
		mockFetch.mockReturnValueOnce(okRes([{ resting: { oid: 1 } }]));
		await placeOrder(fakeWallet, { ...BASE_PARAMS, asset: 7, price: '50.25', size: '2.0' });
		const order = (lastBody().action.orders as { a: number; p: string; s: string }[])[0];
		expect(order.a).toBe(7);
		expect(order.p).toBe('50.25');
		expect(order.s).toBe('2.0');
	});

	it('reduceOnly omitted → r = false', async () => {
		mockFetch.mockReturnValueOnce(okRes([{ resting: { oid: 1 } }]));
		await placeOrder(fakeWallet, BASE_PARAMS);
		const order = (lastBody().action.orders as { r: unknown }[])[0];
		expect(order.r).toBe(false);
	});

	it('reduceOnly: true → r = true', async () => {
		mockFetch.mockReturnValueOnce(okRes([{ resting: { oid: 1 } }]));
		await placeOrder(fakeWallet, { ...BASE_PARAMS, reduceOnly: true });
		const order = (lastBody().action.orders as { r: unknown }[])[0];
		expect(order.r).toBe(true);
	});

	it('cloid is set in wire when provided', async () => {
		const cloid = '0xabcdef1234567890abcdef1234567890' as `0x${string}`;
		mockFetch.mockReturnValueOnce(okRes([{ resting: { oid: 1 } }]));
		await placeOrder(fakeWallet, { ...BASE_PARAMS, cloid });
		const order = (lastBody().action.orders as { c: unknown }[])[0];
		expect(order.c).toBe(cloid);
	});

	it('cloid is absent from wire when not provided', async () => {
		mockFetch.mockReturnValueOnce(okRes([{ resting: { oid: 1 } }]));
		await placeOrder(fakeWallet, BASE_PARAMS);
		const order = (lastBody().action.orders as { c: unknown }[])[0];
		expect(order.c).toBeUndefined();
	});

	it('grouping defaults to "na"', async () => {
		mockFetch.mockReturnValueOnce(okRes([{ resting: { oid: 1 } }]));
		await placeOrder(fakeWallet, BASE_PARAMS);
		expect(lastBody().action.grouping).toBe('na');
	});

	it('custom grouping is passed through', async () => {
		mockFetch.mockReturnValueOnce(okRes([{ resting: { oid: 1 } }]));
		await placeOrder(fakeWallet, { ...BASE_PARAMS, grouping: 'normalTpsl' });
		expect(lastBody().action.grouping).toBe('normalTpsl');
	});
});

// ═════════════════════════════════════════════════════════════════════════════
// placeOrder — HTTP / signing
// ═════════════════════════════════════════════════════════════════════════════

describe('placeOrder — HTTP request', () => {
	it('POSTs to <baseUrl>/exchange with correct headers', async () => {
		mockFetch.mockReturnValueOnce(okRes([{ resting: { oid: 1 } }]));
		await placeOrder(fakeWallet, BASE_PARAMS);
		const [url, init] = mockFetch.mock.lastCall! as [string, RequestInit & { headers: Record<string, string> }];
		expect(url).toBe('https://api.test/exchange');
		expect(init.method).toBe('POST');
		expect(init.headers['Content-Type']).toBe('application/json');
	});

	it('includes numeric nonce and signature {r,s,v} in body', async () => {
		mockFetch.mockReturnValueOnce(okRes([{ resting: { oid: 1 } }]));
		await placeOrder(fakeWallet, BASE_PARAMS);
		const body = lastBody();
		expect(typeof body.nonce).toBe('number');
		expect(body.signature).toEqual({ r: '0xaaa', s: '0xbbb', v: 28 });
	});

	it('does NOT include vaultAddress when not provided', async () => {
		mockFetch.mockReturnValueOnce(okRes([{ resting: { oid: 1 } }]));
		await placeOrder(fakeWallet, BASE_PARAMS);
		expect(lastBody().vaultAddress).toBeUndefined();
	});

	it('includes vaultAddress when provided via opts', async () => {
		mockFetch.mockReturnValueOnce(okRes([{ resting: { oid: 1 } }]));
		const vault = '0x1111111111111111111111111111111111111111' as `0x${string}`;
		await placeOrder(fakeWallet, BASE_PARAMS, { vaultAddress: vault });
		expect(lastBody().vaultAddress).toBe(vault);
	});
});

// ═════════════════════════════════════════════════════════════════════════════
// placeOrder — return values
// ═════════════════════════════════════════════════════════════════════════════

describe('placeOrder — return values', () => {
	it('returns resting status', async () => {
		mockFetch.mockReturnValueOnce(okRes([{ resting: { oid: 42 } }]));
		const result = await placeOrder(fakeWallet, BASE_PARAMS);
		expect(result.statuses).toEqual([{ resting: { oid: 42 } }]);
	});

	it('returns filled status', async () => {
		mockFetch.mockReturnValueOnce(
			okRes([{ filled: { totalSz: '0.5', avgPx: '100.0', oid: 99 } }])
		);
		const result = await placeOrder(fakeWallet, BASE_PARAMS);
		expect(result.statuses).toEqual([{ filled: { totalSz: '0.5', avgPx: '100.0', oid: 99 } }]);
	});

	it('error status from exchange is returned in statuses, not thrown', async () => {
		mockFetch.mockReturnValueOnce(okRes([{ error: 'Order would immediately liquidate' }]));
		const result = await placeOrder(fakeWallet, BASE_PARAMS);
		expect(result.statuses).toEqual([{ error: 'Order would immediately liquidate' }]);
	});

	it('returns empty statuses when response has none', async () => {
		mockFetch.mockReturnValueOnce(okRes([]));
		const result = await placeOrder(fakeWallet, BASE_PARAMS);
		expect(result.statuses).toEqual([]);
	});
});

// ═════════════════════════════════════════════════════════════════════════════
// placeOrder — error paths
// ═════════════════════════════════════════════════════════════════════════════

describe('placeOrder — error paths', () => {
	it('throws when HTTP response is not ok', async () => {
		mockFetch.mockReturnValueOnce(httpErrRes(400, 'invalid request'));
		await expect(placeOrder(fakeWallet, BASE_PARAMS)).rejects.toThrow('Exchange request failed: 400');
	});

	it('throws when exchange returns non-ok status', async () => {
		mockFetch.mockReturnValueOnce(exchErrRes());
		await expect(placeOrder(fakeWallet, BASE_PARAMS)).rejects.toThrow('non-ok status');
	});

	it('throws when response body is not valid JSON', async () => {
		mockFetch.mockReturnValueOnce(
			Promise.resolve({
				ok: true,
				status: 200,
				statusText: 'OK',
				text: () => Promise.resolve('not-json{{{{')
			})
		);
		await expect(placeOrder(fakeWallet, BASE_PARAMS)).rejects.toThrow('invalid JSON');
	});
});

// ═════════════════════════════════════════════════════════════════════════════
// cancelOrder
// ═════════════════════════════════════════════════════════════════════════════

describe('cancelOrder', () => {
	it('sends action.type = "cancel" with correct asset and oid', async () => {
		mockFetch.mockReturnValueOnce(okRes(['success']));
		await cancelOrder(fakeWallet, 3, 12345);
		const { action } = lastBody();
		expect(action.type).toBe('cancel');
		expect(action.cancels).toEqual([{ a: 3, o: 12345 }]);
	});

	it('returns success status', async () => {
		mockFetch.mockReturnValueOnce(okRes(['success']));
		const result = await cancelOrder(fakeWallet, 3, 12345);
		expect(result.statuses).toEqual(['success']);
	});

	it('error status from exchange is returned in statuses, not thrown', async () => {
		mockFetch.mockReturnValueOnce(okRes([{ error: 'Order not found' }]));
		const result = await cancelOrder(fakeWallet, 3, 99999);
		expect(result.statuses).toEqual([{ error: 'Order not found' }]);
	});

	it('throws on HTTP error', async () => {
		mockFetch.mockReturnValueOnce(httpErrRes(500, 'server error'));
		await expect(cancelOrder(fakeWallet, 3, 1)).rejects.toThrow('Exchange request failed');
	});

	it('throws when exchange returns non-ok status', async () => {
		mockFetch.mockReturnValueOnce(exchErrRes());
		await expect(cancelOrder(fakeWallet, 3, 1)).rejects.toThrow('non-ok status');
	});
});

// ═════════════════════════════════════════════════════════════════════════════
// cancelOrders (batch by OID)
// ═════════════════════════════════════════════════════════════════════════════

describe('cancelOrders', () => {
	it('sends all cancels in the action', async () => {
		mockFetch.mockReturnValueOnce(okRes(['success', 'success']));
		const cancels = [
			{ a: 0, o: 1 },
			{ a: 0, o: 2 }
		];
		await cancelOrders(fakeWallet, cancels);
		expect(lastBody().action).toEqual({ type: 'cancel', cancels });
	});

	it('returns all statuses including partial errors', async () => {
		mockFetch.mockReturnValueOnce(okRes(['success', { error: 'Order not found' }]));
		const result = await cancelOrders(fakeWallet, [
			{ a: 0, o: 1 },
			{ a: 0, o: 9999 }
		]);
		expect(result.statuses).toEqual(['success', { error: 'Order not found' }]);
	});

	it('handles empty cancels list', async () => {
		mockFetch.mockReturnValueOnce(okRes([]));
		const result = await cancelOrders(fakeWallet, []);
		expect(result.statuses).toEqual([]);
		expect(lastBody().action).toEqual({ type: 'cancel', cancels: [] });
	});
});

// ═════════════════════════════════════════════════════════════════════════════
// cancelOrdersByCloid
// ═════════════════════════════════════════════════════════════════════════════

describe('cancelOrdersByCloid', () => {
	const cloid1 = '0xaabbccdd11223344aabbccdd11223344' as `0x${string}`;
	const cloid2 = '0x11223344aabbccdd11223344aabbccdd' as `0x${string}`;

	it('sends action.type = "cancelByCloid" with correct fields', async () => {
		mockFetch.mockReturnValueOnce(okRes(['success']));
		await cancelOrdersByCloid(fakeWallet, [{ asset: 3, cloid: cloid1 }]);
		const { action } = lastBody();
		expect(action.type).toBe('cancelByCloid');
		expect(action.cancels).toEqual([{ asset: 3, cloid: cloid1 }]);
	});

	it('handles multiple cloid cancels', async () => {
		mockFetch.mockReturnValueOnce(okRes(['success', 'success']));
		const cancels = [
			{ asset: 3, cloid: cloid1 },
			{ asset: 3, cloid: cloid2 }
		];
		await cancelOrdersByCloid(fakeWallet, cancels);
		expect(lastBody().action.cancels).toEqual(cancels);
	});

	it('returns all statuses', async () => {
		mockFetch.mockReturnValueOnce(okRes(['success', { error: 'Cloid not found' }]));
		const result = await cancelOrdersByCloid(fakeWallet, [
			{ asset: 3, cloid: cloid1 },
			{ asset: 3, cloid: cloid2 }
		]);
		expect(result.statuses).toEqual(['success', { error: 'Cloid not found' }]);
	});

	it('error status from exchange is returned, not thrown', async () => {
		mockFetch.mockReturnValueOnce(okRes([{ error: 'Cloid not found' }]));
		const result = await cancelOrdersByCloid(fakeWallet, [{ asset: 3, cloid: cloid1 }]);
		expect(result.statuses).toEqual([{ error: 'Cloid not found' }]);
	});
});
