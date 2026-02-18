import { infoClient } from '$api/client';
import {
	subscribeL2Book,
	subscribeTrades,
	subscribeAllMids,
	unsubscribe
} from '$api/subscriptions';

const MARKET_CACHE_TTL_MS = 5 * 60 * 1000;

// --- Perp types ---
export interface AssetMeta {
	name: string;
	szDecimals: number;
	maxLeverage: number;
	onlyIsolated?: boolean;
	isDelisted?: boolean;
}

export interface AssetCtx {
	funding: string;
	openInterest: string;
	prevDayPx: string;
	dayNtlVlm: string;
	premium: string;
	oraclePx: string;
	markPx: string;
	midPx: string;
}

export interface PerpAsset {
	meta: AssetMeta;
	ctx: AssetCtx;
	assetId: number;
	quoteCurrency?: string; // HIP-3 only: each DEX may use a different collateral token
}

// --- Spot types ---
export interface EvmContract {
	address: string;
	evm_extra_wei_decimals?: number;
}

export interface SpotToken {
	name: string;
	szDecimals: number;
	weiDecimals: number;
	index: number;
	tokenId: string;
	isCanonical: boolean;
	fullName: string | null;
	evmContract?: EvmContract | null;
	deployerTradingFeeShare?: string;
}

export interface SpotPair {
	name: string;
	tokens: [number, number];
	index: number;
	isCanonical: boolean;
}

export interface SpotCtx {
	coin: string;
	prevDayPx: string;
	dayNtlVlm: string;
	markPx: string;
	midPx: string;
	circulatingSupply: string;
	totalSupply: string;
	dayBaseVlm: string;
}

export interface SpotAsset {
	token: SpotToken;
	quoteToken: SpotToken;
	pair: SpotPair;
	ctx: SpotCtx;
	displayName: string;
	quoteName: string;
	tokenIndex: number;
	spotId: string;
	assetId: number;
}

// --- HIP-3 types ---
export interface PerpDex {
	name: string;
	fullName: string;
	deployer: string;
	perpDexIndex: number;
}

// --- Order book types ---
export interface BookLevel {
	px: string;
	sz: string;
	n: number;
}

export interface Trade {
	coin: string;
	side: string;
	px: string;
	sz: string;
	time: number;
	tid: number;
}

// --- Sort helper ---
function byVolume(a: { ctx: { dayNtlVlm: string } }, b: { ctx: { dayNtlVlm: string } }): number {
	return parseFloat(b.ctx.dayNtlVlm || '0') - parseFloat(a.ctx.dayNtlVlm || '0');
}

// --- Reactive state ---

// Market list state
let activeTab = $state<'perp' | 'spot' | 'hip3'>('perp');
let searchQuery = $state('');

// Raw data from API -- main perp
let assetMetas = $state<AssetMeta[]>([]);
let assetCtxs = $state<AssetCtx[]>([]);
let perpCollateralToken = $state(0);

// Raw data from API -- spot
let spotTokens = $state<SpotToken[]>([]);
let spotPairs = $state<SpotPair[]>([]);
let spotCtxs = $state<SpotCtx[]>([]);

// HIP-3 state
let hip3Dexes = $state<PerpDex[]>([]);
let activeHip3Dex = $state('__all__');
let activeHip3DexIndex = $state(0);
let hip3Metas = $state<AssetMeta[]>([]);
let hip3Ctxs = $state<AssetCtx[]>([]);
let hip3CollateralToken = $state(0);
let hip3Loading = $state(false);
// Pre-merged assets from all HIP-3 DEXes
let hip3AllAssets = $state<PerpAsset[]>([]);
let hip3AllInFlight: Promise<void> | null = null;
const hip3DexInFlight = new Map<string, Promise<void>>();

// All mids (shared across pages)
let allMids = $state<Record<string, string>>({});
let midsInitialized = $state(false);

// Coin detail state
let selectedCoin = $state('BTC');
let bids = $state<BookLevel[]>([]);
let asks = $state<BookLevel[]>([]);
let recentTrades = $state<Trade[]>([]);

// Cache timestamps
let perpMetaFetchedAt = $state(0);
let spotMetaFetchedAt = $state(0);
let perpDexsFetchedAt = $state(0);
let hip3AllFetchedAt = $state(0);
let hip3DexCache = $state<Record<string, {
	metas: AssetMeta[];
	ctxs: AssetCtx[];
	collateralToken: number;
	fetchedAt: number;
}>>({});

function isFresh(ts: number): boolean {
	return ts > 0 && (Date.now() - ts) < MARKET_CACHE_TTL_MS;
}

// --- Quote currency helper ---
function getQuoteCurrency(collateralTokenIdx: number): string {
	const token = spotTokens.find((t) => t.index === collateralTokenIdx);
	return token?.name ?? 'USDC';
}

// --- Derived ---

const mainQuote = $derived(getQuoteCurrency(perpCollateralToken));

// Merged perp assets (meta + ctx), sorted by volume
const perpAssets = $derived<PerpAsset[]>(
	assetMetas
		.map((meta, i) => ({ meta, ctx: assetCtxs[i] ?? {} as AssetCtx, assetId: i }))
		.filter((a) => !a.meta.isDelisted)
		.sort(byVolume)
);

// Fallback token object when lookup fails
const unknownToken: SpotToken = { name: '???', szDecimals: 0, weiDecimals: 0, index: -1, tokenId: '', isCanonical: false, fullName: null, evmContract: null };

// Empty ctx fallback
const emptySpotCtx: SpotCtx = { coin: '', prevDayPx: '0', dayNtlVlm: '0', markPx: '0', midPx: '0', circulatingSupply: '0', totalSupply: '0', dayBaseVlm: '0' };

// Merged spot assets: match ctx to pair via ctx.coin === pair.name
const spotAssets = $derived<SpotAsset[]>(
	spotPairs.map((pair) => {
		const baseTokenIdx = pair.tokens[0];
		const quoteTokenIdx = pair.tokens[1];
		const baseToken = spotTokens.find((t) => t.index === baseTokenIdx) ?? { ...unknownToken, index: baseTokenIdx, name: pair.name };
		const quoteToken = spotTokens.find((t) => t.index === quoteTokenIdx) ?? { ...unknownToken, index: quoteTokenIdx, name: 'USDC' };
		// Match ctx by coin field (pair.name is the API coin identifier, e.g. "PURR/USDC" or "@1")
		const ctx = spotCtxs.find((c) => c.coin === pair.name) ?? emptySpotCtx;
		// Always resolve from token objects for uniform "BASE / QUOTE" format
		const displayName = `${baseToken.name} / ${quoteToken.name}`;
		return {
			token: baseToken,
			quoteToken,
			pair,
			ctx,
			displayName,
			quoteName: quoteToken.name,
			tokenIndex: baseTokenIdx,
			spotId: `@${pair.index}`,
			assetId: 10000 + pair.index
		};
	}).sort(byVolume)
);

// HIP-3 assets for the active dex
const hip3Quote = $derived(getQuoteCurrency(hip3CollateralToken));

const hip3Assets = $derived<PerpAsset[]>(
	hip3Metas
		.map((meta, i) => ({
			meta,
			ctx: hip3Ctxs[i] ?? {} as AssetCtx,
			assetId: 100000 + activeHip3DexIndex * 10000 + i,
			quoteCurrency: hip3Quote
		}))
		.filter((a) => !a.meta.isDelisted)
		.sort(byVolume)
);

// Filtered + sorted results
const filteredPerpAssets = $derived(
	perpAssets.filter((a) =>
		a.meta.name.toLowerCase().includes(searchQuery.toLowerCase())
	)
);

const filteredSpotAssets = $derived(
	spotAssets.filter((a) =>
		a.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
		a.pair.name.toLowerCase().includes(searchQuery.toLowerCase())
	)
);

const activeHip3List = $derived(activeHip3Dex === '__all__' ? hip3AllAssets : hip3Assets);

const filteredHip3Assets = $derived(
	activeHip3List.filter((a) =>
		a.meta.name.toLowerCase().includes(searchQuery.toLowerCase())
	)
);

const midPrice = $derived(allMids[selectedCoin] ?? null);

// --- Functions ---

// Fetch perp metadata + asset contexts (main dex)
async function fetchPerpMeta(force = false) {
	if (!force && assetMetas.length > 0 && isFresh(perpMetaFetchedAt)) return;
	const result = await infoClient.metaAndAssetCtxs();
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const [meta, ctxs] = result as any;
	assetMetas = meta?.universe ?? [];
	assetCtxs = ctxs ?? [];
	perpCollateralToken = meta?.collateralToken ?? 0;
	perpMetaFetchedAt = Date.now();
}

// Fetch spot metadata + asset contexts
async function fetchSpotMeta(force = false) {
	if (!force && spotTokens.length > 0 && spotPairs.length > 0 && isFresh(spotMetaFetchedAt)) return;
	const result = await infoClient.spotMetaAndAssetCtxs();
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const [meta, ctxs] = result as any;
	spotTokens = meta?.tokens ?? [];
	spotPairs = meta?.universe ?? [];
	spotCtxs = ctxs ?? [];
	spotMetaFetchedAt = Date.now();
}

// Fetch all HIP-3 perpDexes (preserve original index for asset ID calculation)
async function fetchPerpDexs(force = false) {
	if (!force && hip3Dexes.length > 0 && isFresh(perpDexsFetchedAt)) return;
	const result = await infoClient.perpDexs();
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const raw = result as any[];
	hip3Dexes = raw
		.map((d, i) => d !== null ? { ...d, perpDexIndex: i } as PerpDex : null)
		.filter((d): d is PerpDex => d !== null);
	perpDexsFetchedAt = Date.now();
	// If user is already on HIP-3 while dexes are loading, warm data automatically.
	if (activeTab === 'hip3') {
		void (activeHip3Dex === '__all__' ? fetchAllHip3(force) : fetchHip3Meta(activeHip3Dex, force));
	}
}

// Fetch meta + ctxs for a specific HIP-3 DEX
async function fetchHip3Meta(dex: string, force = false) {
	const cached = hip3DexCache[dex];
	if (!force && cached && isFresh(cached.fetchedAt)) {
		hip3Metas = cached.metas;
		hip3Ctxs = cached.ctxs;
		hip3CollateralToken = cached.collateralToken;
		return;
	}
	if (!force) {
		const inFlight = hip3DexInFlight.get(dex);
		if (inFlight) return inFlight;
	}
	const task = (async () => {
		hip3Loading = true;
		try {
			const result = await infoClient.metaAndAssetCtxs({ dex });
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const [meta, ctxs] = result as any;
			const metas = meta?.universe ?? [];
			const contexts = ctxs ?? [];
			const collateralToken = meta?.collateralToken ?? 0;
			hip3Metas = metas;
			hip3Ctxs = contexts;
			hip3CollateralToken = collateralToken;
			hip3DexCache = {
				...hip3DexCache,
				[dex]: {
					metas,
					ctxs: contexts,
					collateralToken,
					fetchedAt: Date.now()
				}
			};
		} finally {
			hip3Loading = false;
			hip3DexInFlight.delete(dex);
		}
	})();
	hip3DexInFlight.set(dex, task);
	return task;
}

// Fetch all HIP-3 DEXes in parallel and merge into a single list
async function fetchAllHip3(force = false) {
	if (!force && hip3AllAssets.length > 0 && isFresh(hip3AllFetchedAt)) return;
	if (!force && hip3AllInFlight) return hip3AllInFlight;
	const task = (async () => {
		hip3Loading = true;
		try {
			const results = await Promise.all(
				hip3Dexes.map((dex) => infoClient.metaAndAssetCtxs({ dex: dex.name }))
			);
			const merged: PerpAsset[] = [];
			results.forEach((result, idx) => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const [meta, ctxs] = result as any;
				const metas: AssetMeta[] = meta?.universe ?? [];
				const contexts: AssetCtx[] = ctxs ?? [];
				const dexIndex = hip3Dexes[idx].perpDexIndex;
				const quoteCurrency = getQuoteCurrency(meta?.collateralToken ?? 0);
				metas.forEach((m, i) => {
					if (!m.isDelisted) {
						merged.push({
							meta: m,
							ctx: contexts[i] ?? {} as AssetCtx,
							assetId: 100000 + dexIndex * 10000 + i,
							quoteCurrency
						});
					}
				});
			});
			hip3AllAssets = merged.sort(byVolume);
			hip3AllFetchedAt = Date.now();
		} finally {
			hip3Loading = false;
			hip3AllInFlight = null;
		}
	})();
	hip3AllInFlight = task;
	return task;
}

// Select a HIP-3 DEX sub-tab (or "__all__" for all DEXes)
async function selectHip3Dex(dex: string, force = false) {
	activeHip3Dex = dex;
	if (dex === '__all__') {
		await fetchAllHip3(force);
	} else {
		const dexInfo = hip3Dexes.find((d) => d.name === dex);
		activeHip3DexIndex = dexInfo?.perpDexIndex ?? 0;
		await fetchHip3Meta(dex, force);
	}
}

// Subscribe to all mid prices (idempotent)
async function initMids() {
	if (midsInitialized) return;
	midsInitialized = true;
	await subscribeAllMids((data) => {
		allMids = data.mids;
	});
}

// Select a coin and subscribe to its L2 book + trades
async function selectCoin(coin: string) {
	await unsubscribe(`l2Book:${selectedCoin}`);
	await unsubscribe(`trades:${selectedCoin}`);

	selectedCoin = coin;
	bids = [];
	asks = [];
	recentTrades = [];

	await subscribeL2Book(coin, (data) => {
		bids = data.levels[0];
		asks = data.levels[1];
	});

	await subscribeTrades(coin, (data) => {
		recentTrades = [...data, ...recentTrades].slice(0, 100);
	});
}

// Unsubscribe from coin detail streams
async function unselectCoin() {
	await unsubscribe(`l2Book:${selectedCoin}`);
	await unsubscribe(`trades:${selectedCoin}`);
	bids = [];
	asks = [];
	recentTrades = [];
}

// Initialize market overview (list page)
async function initMarketList(force = false) {
	await Promise.allSettled([fetchPerpMeta(force), fetchSpotMeta(force), fetchPerpDexs(force), initMids()]);
	// Preload HIP-3 assets in the background. Do not await this to avoid blocking
	// route transitions or first-page interactions when data size is large.
	if (hip3Dexes.length > 0) {
		void fetchAllHip3(force);
	}
}

// Full init (overview + coin detail)
async function init() {
	await initMarketList();
	await selectCoin(selectedCoin);
}

function setTab(tab: 'perp' | 'spot' | 'hip3') {
	activeTab = tab;
	// Auto-fetch HIP-3 when switching tabs; handles both loaded and not-yet-loaded dex metadata.
	if (tab === 'hip3') {
		if (hip3Dexes.length === 0) {
			void fetchPerpDexs();
			return;
		}
		if (activeHip3Dex === '__all__' && (hip3AllAssets.length === 0 || !isFresh(hip3AllFetchedAt))) {
			void selectHip3Dex('__all__');
		}
	}
}

function setSearch(query: string) {
	searchQuery = query;
}

function reset() {
	bids = [];
	asks = [];
	recentTrades = [];
}

function resetAll() {
	reset();
	allMids = {};
	midsInitialized = false;
	perpMetaFetchedAt = 0;
	spotMetaFetchedAt = 0;
	perpDexsFetchedAt = 0;
	hip3AllFetchedAt = 0;
	hip3DexCache = {};
}

// --- Find helpers ---
function findPerpAsset(coin: string): PerpAsset | undefined {
	return perpAssets.find((a) => a.meta.name === coin) ??
		hip3Assets.find((a) => a.meta.name === coin) ??
		hip3AllAssets.find((a) => a.meta.name === coin);
}

function findSpotAsset(coin: string): SpotAsset | undefined {
	return spotAssets.find((a) => a.displayName === coin || a.pair.name === coin);
}

// Look up szDecimals and isSpot for a given coin name
function getCoinPriceParams(coin: string): { szDecimals: number; isSpot: boolean } {
	const perp = findPerpAsset(coin);
	if (perp) return { szDecimals: perp.meta.szDecimals, isSpot: false };
	const spot = findSpotAsset(coin);
	if (spot) return { szDecimals: spot.token.szDecimals, isSpot: true };
	return { szDecimals: 0, isSpot: false };
}

/**
 * Resolve a spot token's mid price.
 * Tries allMids[coin] first (works for perp coins like "BTC"), then falls back
 * to spotAssets ctx.midPx matched by token name or index.
 */
function getSpotMidPrice(coin: string, tokenIndex: number): number | null {
	if (allMids[coin]) return parseFloat(allMids[coin]);
	const spot = spotAssets.find((a) => a.token.name === coin || a.token.index === tokenIndex);
	const mid = spot?.ctx?.midPx;
	return mid && mid !== '0' ? parseFloat(mid) : null;
}

/** Resolve coin (e.g. "BTC", "@260") to asset index. Perp = universe index; spot = 10000 + pair index. */
function getAssetId(coin: string): number | null {
	const perp = findPerpAsset(coin);
	if (perp != null) return perp.assetId;
	const spot = findSpotAsset(coin);
	if (spot != null) return spot.assetId;
	return null;
}

export const marketStore = {
	// Market list
	get activeTab() { return activeTab; },
	get searchQuery() { return searchQuery; },
	get perpAssets() { return perpAssets; },
	get spotAssets() { return spotAssets; },
	get filteredPerpAssets() { return filteredPerpAssets; },
	get filteredSpotAssets() { return filteredSpotAssets; },
	get assetMetas() { return assetMetas; },
	get assetCtxs() { return assetCtxs; },
	get spotTokens() { return spotTokens; },
	get mainQuote() { return mainQuote; },

	// HIP-3
	get hip3Dexes() { return hip3Dexes; },
	get activeHip3Dex() { return activeHip3Dex; },
	get hip3Assets() { return hip3Assets; },
	get filteredHip3Assets() { return filteredHip3Assets; },
	get hip3Quote() { return hip3Quote; },
	get hip3Loading() { return hip3Loading; },

	// All mids
	get allMids() { return allMids; },

	// Coin detail
	get selectedCoin() { return selectedCoin; },
	get bids() { return bids; },
	get asks() { return asks; },
	get recentTrades() { return recentTrades; },
	get midPrice() { return midPrice; },

	// Functions
	setTab,
	setSearch,
	selectCoin,
	unselectCoin,
	selectHip3Dex,
	initMids,
	initMarketList,
	init,
	reset,
	resetAll,
	findPerpAsset,
	findSpotAsset,
	getAssetId,
	getSpotMidPrice,
	getCoinPriceParams,
	fetchPerpMeta,
	fetchSpotMeta,
	fetchPerpDexs
};
