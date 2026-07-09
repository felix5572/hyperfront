import { infoClient } from '$api/client';
import {
	subscribeAllDexsClearinghouseState,
	subscribeWebData3,
	unsubscribe
} from '$api/subscriptions';

// Types matching Hyperliquid clearinghouseState response
export interface MarginSummary {
	accountValue: string;
	totalNtlPos: string;
	totalRawUsd: string;
	totalMarginUsed: string;
}

export interface Position {
	coin: string;
	szi: string;
	entryPx: string | null;
	positionValue: string;
	returnOnEquity: string;
	unrealizedPnl: string;
	liquidationPx: string | null;
	marginUsed: string;
	leverage: { type: string; value: number };
}

export interface AssetPosition {
	type: string;
	position: Position;
}

export interface ClearinghouseState {
	assetPositions: AssetPosition[];
	marginSummary: MarginSummary;
	crossMarginSummary: MarginSummary;
	withdrawable: string;
}

export interface PerpDexPositionsGroup {
	dex: string;
	label: string;
	positions: Position[];
}

// Spot balance from spotClearinghouseState response
export interface SpotBalance {
	coin: string;
	token: number;
	hold: string;
	total: string;
	entryNtl: string;
}

// Reactive state
let viewAddress = $state<`0x${string}` | null>(null);
let clearinghouse = $state<ClearinghouseState | null>(null);
let spotBalances = $state<SpotBalance[]>([]);
let loading = $state(false);

// Full WS payloads: no omission (all DEXs + webData3 raw)
let allDexsClearinghouse = $state<[string, unknown][]>([]);
let webData3Raw = $state<unknown>(null);

// Raw REST response for spot (source of spot balances; structure may vary by asset)
let spotClearinghouseStateRaw = $state<unknown>(null);

// Per-dex clearinghouse states fetched via REST (HIP-3 margin display on
// direct entry, before the all-dexs WS snapshot arrives).
let dexClearinghouse = $state<Record<string, ClearinghouseState>>({});

const positions = $derived(
	clearinghouse?.assetPositions
		.map((ap) => ap.position)
		.filter((p) => parseFloat(p.szi) !== 0) ?? []
);

function extractPositions(state: unknown): Position[] {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const s = state as any;
	const arr = Array.isArray(s?.assetPositions) ? s.assetPositions : [];
	return arr
		.map((ap: { position?: Position }) => ap?.position)
		.filter((p: Position | undefined): p is Position => !!p && parseFloat(p.szi) !== 0);
}

const perpDexPositionGroups = $derived.by((): PerpDexPositionsGroup[] => {
	const fromWs = allDexsClearinghouse
		.map(([dex, state]) => ({
			dex,
			label: dex === '' ? 'Main' : dex,
			positions: extractPositions(state)
		}))
		.filter((g) => g.positions.length > 0)
		.sort((a, b) => {
			if (a.dex === '' && b.dex !== '') return -1;
			if (a.dex !== '' && b.dex === '') return 1;
			return a.label.localeCompare(b.label);
		});

	if (fromWs.length > 0) return fromWs;
	if (positions.length > 0) {
		return [{ dex: '', label: 'Main', positions }];
	}
	return [];
});

// Full margin summary (includes isolated positions). crossMarginSummary would
// systematically undercount account value for accounts with isolated margin.
const marginSummary = $derived(clearinghouse?.marginSummary ?? null);
const withdrawable = $derived(clearinghouse?.withdrawable ?? '0');

// Non-zero spot balances only
const activeSpotBalances = $derived(
	spotBalances.filter((b) => parseFloat(b.total) !== 0)
);

// Fetch perp account state
async function fetchAccountState(user: `0x${string}`) {
	// Explicitly pin to main perp dex (empty string) for deterministic semantics.
	const state = await infoClient.clearinghouseState({ user, dex: '' });
	clearinghouse = state as unknown as ClearinghouseState;
}

// Fetch clearinghouse state for a specific HIP-3 dex
async function fetchDexState(user: `0x${string}`, dex: string) {
	const state = await infoClient.clearinghouseState({ user, dex });
	dexClearinghouse = { ...dexClearinghouse, [dex]: state as unknown as ClearinghouseState };
}

// Fetch spot balances
async function fetchSpotState(user: `0x${string}`) {
	const result = await infoClient.spotClearinghouseState({ user });
	spotClearinghouseStateRaw = result;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const data = result as any;
	spotBalances = data?.balances ?? [];
}

// Unsubscribe WS for an address (so we can switch to another)
async function unsubscribeAccount(addr: `0x${string}`) {
	await unsubscribe(`allDexsClearinghouseState:${addr}`);
	await unsubscribe(`webData3:${addr}`);
}

// Shared: subscribe to allDexs + webData3 for a user (no wallet required)
async function subscribeWsForUser(user: `0x${string}`) {
	await subscribeAllDexsClearinghouseState(user, (data) => {
		const states = data.clearinghouseStates ?? [];
		allDexsClearinghouse = states;
		// Only apply WS override from main dex (""). Never guess/fallback by index.
		const mainTuple = states.find(([dex]) => dex === '');
		if (mainTuple) {
			const [, mainState] = mainTuple;
			clearinghouse = mainState as ClearinghouseState;
		}
	});
	await subscribeWebData3(user, (data) => {
		webData3Raw = data;
	});
}

// Load account for an address: REST + WS subscription (no wallet required)
async function loadAddress(user: `0x${string}`) {
	if (viewAddress) await unsubscribeAccount(viewAddress);
	viewAddress = user;
	loading = true;
	await Promise.all([
		fetchAccountState(user),
		fetchSpotState(user)
	]);
	loading = false;
	await subscribeWsForUser(user);
}

function reset() {
	viewAddress = null;
	clearinghouse = null;
	spotBalances = [];
	loading = false;
	allDexsClearinghouse = [];
	webData3Raw = null;
	spotClearinghouseStateRaw = null;
	dexClearinghouse = {};
}

export const accountStore = {
	get viewAddress() { return viewAddress; },
	get clearinghouse() { return clearinghouse; },
	get positions() { return positions; },
	get perpDexPositionGroups() { return perpDexPositionGroups; },
	get marginSummary() { return marginSummary; },
	get withdrawable() { return withdrawable; },
	get spotBalances() { return activeSpotBalances; },
	/** All spot balances from API (including zero); each has coin, token, total, hold, entryNtl */
	get spotBalancesFull() { return spotBalances; },
	get loading() { return loading; },
	get allDexsClearinghouse() { return allDexsClearinghouse; },
	get webData3Raw() { return webData3Raw; },
	get spotClearinghouseStateRaw() { return spotClearinghouseStateRaw; },
	get dexClearinghouse() { return dexClearinghouse; },
	loadAddress,
	fetchAccountState,
	fetchDexState,
	fetchSpotState,
	// Wallet-connect path is identical to viewing an address
	subscribeAccount: loadAddress,
	unsubscribeAccount,
	reset
};
