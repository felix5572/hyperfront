import { infoClient } from '$api/client';
import { VISIBLE_HIP3_DEX_NAMES } from '$utils/constants';
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

// Keep the complete registry for historical asset lookups; only the curated
// subset is exposed to the market overview (including its "All" tab).
let allHip3Dexes = $state<PerpDex[]>([]);
const hip3Dexes = $derived(
	VISIBLE_HIP3_DEX_NAMES.flatMap((name) => allHip3Dexes.filter((d) => d.name === name))
);
let activeHip3Dex = $state('__all__');
let hip3DexLoading = $state<Record<string, boolean>>({});
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

// Read metadata and the original DEX index together. Background prefetches must
// never pair another DEX's metadata with the currently selected DEX's asset IDs.
function getHip3Assets(dex: PerpDex | undefined): PerpAsset[] {
	if (!dex) return [];
	const cached = hip3DexCache[dex.name];
	if (!cached) return [];
	return cached.metas
		.map((meta, i) => ({
			meta,
			ctx: cached.ctxs[i] ?? {} as AssetCtx,
			assetId: 100000 + dex.perpDexIndex * 10000 + i,
			quoteCurrency: getQuoteCurrency(cached.collateralToken)
		}))
		.filter((a) => !a.meta.isDelisted)
		.sort(byVolume);
}

const hip3Quote = $derived(getQuoteCurrency(hip3DexCache[activeHip3Dex]?.collateralToken ?? 0));
const hip3Assets = $derived(getHip3Assets(hip3Dexes.find((d) => d.name === activeHip3Dex)));
const hip3AllAssets = $derived(hip3Dexes.flatMap(getHip3Assets).sort(byVolume));
const hip3Loading = $derived(
	activeHip3Dex === '__all__'
		? hip3Dexes.some((d) => hip3DexLoading[d.name])
		: !!hip3DexLoading[activeHip3Dex]
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
	if (!force && isFresh(perpDexsFetchedAt)) return;
	const result = await infoClient.perpDexs();
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const raw = result as any[];
	allHip3Dexes = raw
		.map((d, i) => d !== null ? { ...d, perpDexIndex: i } as PerpDex : null)
		.filter((d): d is PerpDex => d !== null);
	perpDexsFetchedAt = Date.now();
	if (activeHip3Dex !== '__all__' && !hip3Dexes.some((d) => d.name === activeHip3Dex)) {
		activeHip3Dex = '__all__';
	}
	// If user is already on HIP-3 while dexes are loading, warm data automatically.
	if (activeTab === 'hip3') {
		void (activeHip3Dex === '__all__' ? fetchAllHip3(force) : fetchHip3Meta(activeHip3Dex, force));
	}
}

// Fetch meta + ctxs for a specific HIP-3 DEX
async function fetchHip3Meta(dex: string, force = false) {
	const inFlight = hip3DexInFlight.get(dex);
	if (inFlight) return inFlight;
	const cached = hip3DexCache[dex];
	if (!force && cached && isFresh(cached.fetchedAt)) return;
	const task = (async () => {
		hip3DexLoading[dex] = true;
		try {
			const result = await infoClient.metaAndAssetCtxs({ dex });
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const [meta, ctxs] = result as any;
			const metas = meta?.universe ?? [];
			const contexts = ctxs ?? [];
			const collateralToken = meta?.collateralToken ?? 0;
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
			hip3DexLoading[dex] = false;
			hip3DexInFlight.delete(dex);
		}
	})();
	hip3DexInFlight.set(dex, task);
	return task;
}

// "All" fetches only visible DEXes and shares their per-DEX caches with detail
// pages, so looking up an archived coin cannot add it back to the market list.
async function fetchAllHip3(force = false) {
	await Promise.all(hip3Dexes.map((dex) => fetchHip3Meta(dex.name, force)));
}

// Select a visible HIP-3 DEX sub-tab (or "__all__" for the curated list).
async function selectHip3Dex(dex: string, force = false) {
	if (!isFresh(perpDexsFetchedAt)) await fetchPerpDexs();
	if (dex !== '__all__' && !hip3Dexes.some((d) => d.name === dex)) return;
	activeHip3Dex = dex;
	if (dex === '__all__') {
		await fetchAllHip3(force);
	} else {
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
	// Do not preload all HIP-3 assets here. The payload can be large and may cause
	// unnecessary work/jank when users never enter the HIP-3 tab.
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
		void selectHip3Dex(activeHip3Dex);
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
	hip3DexCache = {};
}

// --- Find helpers ---

// HIP-3 lookup via the per-dex cache, so coins resolve as soon as their dex
// meta was fetched (e.g. by prefetchHip3Meta) without visiting the HIP-3 tab.
function findHip3CachedAsset(coin: string): PerpAsset | undefined {
	if (!coin.includes(':')) return undefined;
	const dexName = coin.split(':')[0];
	const cached = hip3DexCache[dexName];
	const dexInfo = allHip3Dexes.find((d) => d.name === dexName);
	if (!cached || !dexInfo) return undefined;
	const idx = cached.metas.findIndex((m) => m.name === coin);
	if (idx < 0) return undefined;
	return {
		meta: cached.metas[idx],
		ctx: cached.ctxs[idx] ?? {} as AssetCtx,
		assetId: 100000 + dexInfo.perpDexIndex * 10000 + idx,
		quoteCurrency: getQuoteCurrency(cached.collateralToken)
	};
}

function findPerpAsset(coin: string): PerpAsset | undefined {
	return perpAssets.find((a) => a.meta.name === coin) ??
		findHip3CachedAsset(coin);
}

/** Warm the HIP-3 dex caches for any "dex:COIN" names (idempotent, cached). */
async function prefetchHip3Meta(coins: string[]) {
	const dexNames = [...new Set(
		coins.filter((c) => c.includes(':')).map((c) => c.split(':')[0])
	)];
	if (dexNames.length === 0) return;
	await fetchPerpDexs();
	await Promise.all(
		dexNames
			.filter((name) => allHip3Dexes.some((d) => d.name === name))
			.map((name) => fetchHip3Meta(name))
	);
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

/**
 * Like getAssetId, but fetches whatever metadata is missing first.
 * Order actions (place/cancel/modify) must use this instead of getAssetId:
 * cold-starting on /orders or acting on a HIP-3 coin ("dex:COIN") otherwise
 * fails with "Unknown asset" because the metadata was never loaded.
 */
async function resolveAssetId(coin: string): Promise<number | null> {
	const direct = getAssetId(coin);
	if (direct != null) return direct;

	if (coin.includes(':')) {
		await prefetchHip3Meta([coin]);
		return findHip3CachedAsset(coin)?.assetId ?? null;
	}

	await Promise.all([fetchPerpMeta(), fetchSpotMeta()]);
	return getAssetId(coin);
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
	resolveAssetId,
	prefetchHip3Meta,
	getSpotMidPrice,
	getCoinPriceParams,
	fetchPerpMeta,
	fetchSpotMeta,
	fetchPerpDexs
};
