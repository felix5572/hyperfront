import * as hl from '@nktkas/hyperliquid';
import { privateKeyToAccount } from 'viem/accounts';
import { randomBytes } from 'node:crypto';

function fail(msg) {
	console.error(`[FAIL] ${msg}`);
	process.exit(1);
}

function now() {
	return new Date().toISOString();
}

function logStep(name, details = {}) {
	console.log(JSON.stringify({ ts: now(), step: name, ...details }));
}

function parseArgs() {
	const args = process.argv.slice(2);
	const out = {};
	for (const a of args) {
		if (!a.startsWith('--')) continue;
		const [k, v] = a.slice(2).split('=');
		out[k] = v ?? 'true';
	}
	return out;
}

function toFixedUp(value, decimals) {
	const factor = 10 ** decimals;
	return (Math.ceil(value * factor) / factor).toFixed(decimals);
}

function mkCloid() {
	return `0x${randomBytes(16).toString('hex')}`;
}

function parseOrderStatus(statuses) {
	if (!Array.isArray(statuses) || statuses.length === 0) return { kind: 'empty' };
	const first = statuses[0];
	if (typeof first === 'string') return { kind: first };
	if (first?.error) return { kind: 'error', error: first.error };
	if (first?.resting) return { kind: 'resting', oid: first.resting.oid, cloid: first.resting.cloid };
	if (first?.filled) return { kind: 'filled', oid: first.filled.oid, cloid: first.filled.cloid };
	return { kind: 'unknown', raw: first };
}

async function main() {
	const args = parseArgs();

	const PRIVATE_KEY = process.env.HL_TESTNET_PRIVATE_KEY;
	if (!PRIVATE_KEY) fail('Missing HL_TESTNET_PRIVATE_KEY');

	const TARGET_COIN = process.env.HL_TESTNET_COIN || 'HYPE';
	const TARGET_LEVERAGE = Number(process.env.HL_TESTNET_LEVERAGE || '2');
	const ISO_MARGIN_DELTA_USD = Number(process.env.HL_TESTNET_ISO_MARGIN_DELTA_USD || '1');
	const apiUrl = process.env.HL_TESTNET_API_URL || 'https://api.hyperliquid-testnet.xyz';
	const targetNotional = Number(process.env.HL_TESTNET_ORDER_NOTIONAL_USD || '12');

	const wallet = privateKeyToAccount(PRIVATE_KEY);
	const transport = new hl.HttpTransport({ isTestnet: true, apiUrl });
	const info = new hl.InfoClient({ transport });
	const exchange = new hl.ExchangeClient({ transport, wallet });

	logStep('start', {
		address: wallet.address,
		apiUrl,
		isTestnet: true,
		targetCoin: TARGET_COIN
	});

	const [meta, assetCtxs] = await info.metaAndAssetCtxs();
	const perpIdx = meta.universe.findIndex((a) => a.name === TARGET_COIN);
	if (perpIdx < 0) fail(`Perp asset not found for coin=${TARGET_COIN}`);
	const perpMeta = meta.universe[perpIdx];
	const perpCtx = assetCtxs[perpIdx];
	const mid = Number(perpCtx.midPx || perpCtx.markPx || perpCtx.oraclePx);
	if (!Number.isFinite(mid) || mid <= 0) fail(`Invalid mid/mark/oracle price for ${TARGET_COIN}`);

	const spotMetaAndCtx = await info.spotMetaAndAssetCtxs();
	const spotMeta = spotMetaAndCtx[0];
	const spotTokens = spotMeta.tokens ?? [];
	const spotPairs = spotMeta.universe ?? [];
	const hypeToken = spotTokens.find((t) => t.name === TARGET_COIN);
	const usdcToken = spotTokens.find((t) => t.name === 'USDC');
	const hypePair = (hypeToken && usdcToken)
		? spotPairs.find((p) => p.tokens?.[0] === hypeToken.index && p.tokens?.[1] === usdcToken.index)
		: null;

	logStep('preflight.ids', {
		perpAssetIndex: perpIdx,
		perpSzDecimals: perpMeta.szDecimals,
		perpMidPx: mid,
		spotTokenId: hypeToken?.index ?? null,
		spotPairName: hypePair?.name ?? null,
		spotPairIndex: hypePair?.index ?? null,
		spotAssetIdFormula: hypePair ? 10000 + hypePair.index : null
	});

	const restingBuyPx = (mid * 0.6).toFixed(6);
	const restingModifyPx = (mid * 0.55).toFixed(6);
	const sz = toFixedUp(targetNotional / Number(restingBuyPx), perpMeta.szDecimals);
	const notional = Number(sz) * Number(restingBuyPx);

	logStep('preflight.orderPlan', {
		side: 'buy',
		tif: 'Alo',
		price: restingBuyPx,
		size: sz,
		estimatedNotional: notional
	});

	const cloid1 = mkCloid();
	const place1 = await exchange.order({
		orders: [
			{
				a: perpIdx,
				b: true,
				p: restingBuyPx,
				s: sz,
				r: false,
				t: { limit: { tif: 'Alo' } },
				c: cloid1
			}
		],
		grouping: 'na'
	});
	const st1 = parseOrderStatus(place1.response?.data?.statuses);
	logStep('order.place', { cloid: cloid1, result: st1, raw: place1.response?.data?.statuses ?? null });
	if (st1.kind === 'error') fail(`place failed: ${st1.error}`);
	const oid1 = st1.oid;
	if (!oid1) fail('place did not return oid');

	const modify1 = await exchange.modify({
		oid: oid1,
		order: {
			a: perpIdx,
			b: true,
			p: restingModifyPx,
			s: sz,
			r: false,
			t: { limit: { tif: 'Gtc' } },
			c: cloid1
		}
	});
	const stMod = parseOrderStatus(modify1.response?.data?.statuses);
	logStep('order.modify', { oid: oid1, result: stMod, raw: modify1.response?.data?.statuses ?? null });
	if (stMod.kind === 'error') fail(`modify failed: ${stMod.error}`);

	let cancelMode = 'cancelByCloid';
	let cancelResult;
	const cancelByCloid = await exchange.cancelByCloid({ cancels: [{ asset: perpIdx, cloid: cloid1 }] });
	const stCancelByCloid = parseOrderStatus(cancelByCloid.response?.data?.statuses);
	if (stCancelByCloid.kind === 'error') {
		cancelMode = 'cancel';
		cancelResult = await exchange.cancel({ cancels: [{ a: perpIdx, o: oid1 }] });
	} else {
		cancelResult = cancelByCloid;
	}
	logStep('order.cancelSingle', {
		mode: cancelMode,
		raw: cancelResult.response?.data?.statuses ?? null
	});

	const cloid2 = mkCloid();
	const cloid3 = mkCloid();
	const placeBatch = await exchange.order({
		orders: [
			{
				a: perpIdx,
				b: true,
				p: (mid * 0.58).toFixed(6),
				s: sz,
				r: false,
				t: { limit: { tif: 'Alo' } },
				c: cloid2
			},
			{
				a: perpIdx,
				b: true,
				p: (mid * 0.56).toFixed(6),
				s: sz,
				r: false,
				t: { limit: { tif: 'Alo' } },
				c: cloid3
			}
		],
		grouping: 'na'
	});
	const statusesBatch = placeBatch.response?.data?.statuses ?? [];
	const oidsToCancel = statusesBatch
		.map((s) => s?.resting?.oid ?? s?.filled?.oid)
		.filter((x) => Number.isInteger(x));

	logStep('order.placeForCancelAll', {
		statuses: statusesBatch,
		oidsToCancel
	});

	if (oidsToCancel.length > 0) {
		const cancelAll = await exchange.cancel({
			cancels: oidsToCancel.map((o) => ({ a: perpIdx, o }))
		});
		logStep('order.cancelAll', {
			requestCount: oidsToCancel.length,
			raw: cancelAll.response?.data?.statuses ?? null
		});
	} else {
		logStep('order.cancelAll', { skipped: true, reason: 'No OIDs from placement statuses' });
	}

	const levResp = await exchange.updateLeverage({
		asset: perpIdx,
		isCross: true,
		leverage: TARGET_LEVERAGE
	});
	logStep('risk.updateLeverage', { leverage: TARGET_LEVERAGE, responseType: levResp.response?.type ?? null });

	const ch = await info.clearinghouseState({ user: wallet.address });
	const pos = (ch?.assetPositions ?? []).find((p) => p?.position?.coin === TARGET_COIN)?.position;
	if (!pos) {
		logStep('risk.updateIsolatedMargin', { skipped: true, reason: `No open ${TARGET_COIN} position` });
	} else {
		const ntli = Math.round(ISO_MARGIN_DELTA_USD * 1_000_000);
		const isoResp = await exchange.updateIsolatedMargin({
			asset: perpIdx,
			isBuy: Number(pos.szi) > 0,
			ntli
		});
		logStep('risk.updateIsolatedMargin', {
			deltaUsd: ISO_MARGIN_DELTA_USD,
			ntli,
			responseType: isoResp.response?.type ?? null
		});
	}

	const openOrders = await info.frontendOpenOrders({ user: wallet.address, dex: '' });
	logStep('summary', {
		openOrdersCount: Array.isArray(openOrders) ? openOrders.length : null
	});
	logStep('done', { ok: true });
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
