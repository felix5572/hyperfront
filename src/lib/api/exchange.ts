import { signL1Action, signUserSignedAction } from '@nktkas/hyperliquid/signing';
import type { AbstractWallet } from '@nktkas/hyperliquid/signing';
import { ApproveAgentTypes } from '@nktkas/hyperliquid/api/exchange';
import { getExchangeBaseUrl, API_URL } from '$lib/utils/constants';

export { getExchangeBaseUrl };

const EXCHANGE_PATH = '/exchange';

export type HexAddress = `0x${string}`;
export type Cloid = `0x${string}`;
export type OrderRef = number | Cloid;
export type Tif = 'Gtc' | 'Ioc' | 'Alo' | 'FrontendMarket' | 'LiquidationMarket';

export type ExchangeRequestOptions = {
	vaultAddress?: HexAddress;
	expiresAfter?: number;
	isTestnet?: boolean;
};

export type OrderWire = {
	a: number;
	b: boolean;
	p: string;
	s: string;
	r: boolean;
	t:
		| { limit: { tif: Tif } }
		| { trigger: { isMarket: boolean; triggerPx: string; tpsl: 'tp' | 'sl' } };
	c?: Cloid;
};

export type PlaceOrderParams = {
	asset: number;
	side: 'buy' | 'sell';
	orderType: 'limit' | 'market';
	price: string;
	size: string;
	reduceOnly?: boolean;
	tif?: Tif;
	cloid?: Cloid;
	grouping?: 'na' | 'normalTpsl' | 'positionTpsl';
	builder?: { b: HexAddress; f: number };
};

export type OrderStatus =
	| { resting: { oid: number; cloid?: `0x${string}` } }
	| { filled: { totalSz: string; avgPx: string; oid: number; cloid?: `0x${string}` } }
	| { error: string }
	| 'waitingForFill'
	| 'waitingForTrigger';

export type PlaceOrderResult = { statuses: OrderStatus[] };

export type CancelOrderResult = { statuses: ('success' | { error: string })[] };

export type DefaultResult = { type?: string };

type ExchangeResult = {
	status?: string;
	response?: {
		type: string;
		data?: {
			statuses?: unknown[];
		};
	};
};

type ExchangeAction =
	| { type: 'order'; orders: OrderWire[]; grouping: 'na' | 'normalTpsl' | 'positionTpsl'; builder?: { b: HexAddress; f: number } }
	| { type: 'cancel'; cancels: { a: number; o: number }[] }
	| { type: 'cancelByCloid'; cancels: { asset: number; cloid: Cloid }[] }
	| { type: 'modify'; oid: OrderRef; order: OrderWire }
	| { type: 'batchModify'; modifies: { oid: OrderRef; order: OrderWire }[] }
	| { type: 'scheduleCancel'; time?: number }
	| { type: 'updateLeverage'; asset: number; isCross: boolean; leverage: number }
	| { type: 'updateIsolatedMargin'; asset: number; isBuy: boolean; ntli: number };

function getStatuses<T>(out: ExchangeResult): T[] {
	return (out.response?.data?.statuses ?? []) as T[];
}

async function postExchange(
	wallet: AbstractWallet,
	action: ExchangeAction,
	opts: ExchangeRequestOptions = {}
): Promise<ExchangeResult> {
	const nonce = Date.now();
	const signature = await signL1Action({
		wallet,
		action,
		nonce,
		isTestnet: opts.isTestnet ?? false,
		vaultAddress: opts.vaultAddress,
		expiresAfter: opts.expiresAfter
	});
	const base = getExchangeBaseUrl();
	const url = `${base}${EXCHANGE_PATH}`;
	const payload: {
		action: ExchangeAction;
		nonce: number;
		signature: { r: string; s: string; v: number };
		vaultAddress?: HexAddress;
		expiresAfter?: number;
	} = {
		action,
		nonce,
		signature: { r: signature.r, s: signature.s, v: signature.v }
	};
	if (opts.vaultAddress) payload.vaultAddress = opts.vaultAddress;
	if (opts.expiresAfter != null) payload.expiresAfter = opts.expiresAfter;
	const res = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});
	const text = await res.text();
	if (!res.ok) {
		throw new Error(`Exchange request failed: ${res.status} ${res.statusText} - ${text}`);
	}
	let data: ExchangeResult;
	try {
		data = JSON.parse(text) as ExchangeResult;
	} catch {
		throw new Error(`Exchange returned invalid JSON: ${text}`);
	}
	if (data.status !== 'ok') {
		throw new Error(`Exchange returned non-ok status: ${text}`);
	}
	return data;
}

export async function placeOrder(
	wallet: AbstractWallet,
	params: PlaceOrderParams,
	opts: ExchangeRequestOptions = {}
): Promise<PlaceOrderResult> {
	const tif =
		params.orderType === 'market'
			? 'FrontendMarket'
			: (params.tif ?? 'Gtc');
	const order: OrderWire = {
		a: params.asset,
		b: params.side === 'buy',
		p: params.price,
		s: params.size,
		r: params.reduceOnly ?? false,
		t: { limit: { tif } }
	};
	if (params.cloid) order.c = params.cloid;
	const action = {
		type: 'order' as const,
		orders: [order],
		grouping: params.grouping ?? 'na',
		builder: params.builder
	};
	const out = await postExchange(wallet, action, opts);
	const statuses = getStatuses<OrderStatus>(out);
	return { statuses };
}

export async function cancelOrder(
	wallet: AbstractWallet,
	asset: number,
	oid: number,
	opts: ExchangeRequestOptions = {}
): Promise<CancelOrderResult> {
	const action = {
		type: 'cancel' as const,
		cancels: [{ a: asset, o: oid }]
	};
	const out = await postExchange(wallet, action, opts);
	const statuses = getStatuses<CancelOrderResult['statuses'][number]>(out);
	return { statuses };
}

export async function cancelOrders(
	wallet: AbstractWallet,
	cancels: { a: number; o: number }[],
	opts: ExchangeRequestOptions = {}
): Promise<CancelOrderResult> {
	const action = {
		type: 'cancel' as const,
		cancels
	};
	const out = await postExchange(wallet, action, opts);
	const statuses = getStatuses<CancelOrderResult['statuses'][number]>(out);
	return { statuses };
}

export async function cancelOrdersByCloid(
	wallet: AbstractWallet,
	cancels: { asset: number; cloid: Cloid }[],
	opts: ExchangeRequestOptions = {}
): Promise<CancelOrderResult> {
	const action = { type: 'cancelByCloid' as const, cancels };
	const out = await postExchange(wallet, action, opts);
	const statuses = getStatuses<CancelOrderResult['statuses'][number]>(out);
	return { statuses };
}

export type ModifyOrderParams = {
	oid: OrderRef;
	order: OrderWire;
};

export async function modifyOrder(
	wallet: AbstractWallet,
	params: ModifyOrderParams,
	opts: ExchangeRequestOptions = {}
): Promise<PlaceOrderResult> {
	const action = {
		type: 'modify' as const,
		oid: params.oid,
		order: params.order
	};
	const out = await postExchange(wallet, action, opts);
	const statuses = getStatuses<OrderStatus>(out);
	return { statuses };
}

export async function batchModifyOrders(
	wallet: AbstractWallet,
	modifies: { oid: OrderRef; order: OrderWire }[],
	opts: ExchangeRequestOptions = {}
): Promise<PlaceOrderResult> {
	const action = {
		type: 'batchModify' as const,
		modifies
	};
	const out = await postExchange(wallet, action, opts);
	const statuses = getStatuses<OrderStatus>(out);
	return { statuses };
}

export async function scheduleCancel(
	wallet: AbstractWallet,
	time?: number,
	opts: ExchangeRequestOptions = {}
): Promise<DefaultResult> {
	const action = {
		type: 'scheduleCancel' as const,
		...(time == null ? {} : { time })
	};
	const out = await postExchange(wallet, action, opts);
	return { type: out.response?.type };
}

export async function updateLeverage(
	wallet: AbstractWallet,
	params: { asset: number; isCross: boolean; leverage: number },
	opts: ExchangeRequestOptions = {}
): Promise<DefaultResult> {
	const action = {
		type: 'updateLeverage' as const,
		asset: params.asset,
		isCross: params.isCross,
		leverage: params.leverage
	};
	const out = await postExchange(wallet, action, opts);
	return { type: out.response?.type };
}

export async function updateIsolatedMargin(
	wallet: AbstractWallet,
	params: { asset: number; isBuy: boolean; ntli: number },
	opts: ExchangeRequestOptions = {}
): Promise<DefaultResult> {
	const action = {
		type: 'updateIsolatedMargin' as const,
		asset: params.asset,
		isBuy: params.isBuy,
		ntli: params.ntli
	};
	const out = await postExchange(wallet, action, opts);
	return { type: out.response?.type };
}

export async function approveAgentWallet(
	masterWallet: AbstractWallet,
	agentAddress: HexAddress
): Promise<void> {
	const nonce = Date.now();
	const expiresAt = nonce + 24 * 60 * 60 * 1000; // 24 h
	const action = {
		type: 'approveAgent' as const,
		signatureChainId: '0xa4b1' as const,
		hyperliquidChain: 'Mainnet' as const,
		agentAddress,
		agentName: `hyper-front.xyz valid_until ${expiresAt}`,
		nonce
	};
	const signature = await signUserSignedAction({
		wallet: masterWallet,
		action,
		types: ApproveAgentTypes
	});
	// approveAgent is user-signed so it goes directly to Hyperliquid (no proxy needed, avoids CORS)
	const res = await fetch(`${API_URL}${EXCHANGE_PATH}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ action, nonce, signature })
	});
	const text = await res.text();
	if (!res.ok) throw new Error(`approveAgent failed: ${res.status} - ${text}`);
	const data = JSON.parse(text);
	if (data.status !== 'ok') throw new Error(`approveAgent returned non-ok: ${text}`);
}
