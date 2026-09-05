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

type User = `0x${string}`;
interface AccountData {
	dexStates: Record<string, ClearinghouseState>;
	hasAllDexs: boolean;
	spotBalances: SpotBalance[];
	spotRaw: unknown;
	webData3Raw: unknown;
	errors: Record<string, string>;
}
interface AccountRecord {
	user: User;
	data: AccountData;
	requests: Map<string, number>;
	wsVersion: number;
}
interface ViewSession {
	record: AccountRecord;
	keys: Set<string>;
}

// Viewing B must never change the data consumed by a trading wallet A.
let viewAddress = $state<User | null>(null);
let loading = $state(false);
let snapshots = $state<Record<string, AccountData>>({});
const records = new Map<string, AccountRecord>();
let viewSession: ViewSession | null = null;

function accountKey(user: User) { return user.toLowerCase(); }
function emptyData(): AccountData {
	return { dexStates: {}, hasAllDexs: false, spotBalances: [], spotRaw: null, webData3Raw: null, errors: {} };
}

function recordFor(user: User, fresh = false): AccountRecord {
	const key = accountKey(user);
	const existing = records.get(key);
	if (!fresh && existing) return existing;
	snapshots[key] = emptyData();
	const requests = new Map<string, number>();
	const record: AccountRecord = { user: key as User, data: snapshots[key], requests, wsVersion: 0 };
	records.set(key, record);
	return record;
}

function nextRequest(record: AccountRecord, key: string) {
	const version = (record.requests.get(key) ?? 0) + 1;
	record.requests.set(key, version);
	return () => records.get(record.user) === record && record.requests.get(key) === version;
}

function report(record: AccountRecord, key: string, error?: unknown) {
	if (records.get(record.user) !== record) return;
	if (error == null) delete record.data.errors[key];
	else record.data.errors[key] = `${key}: ${error instanceof Error ? error.message : String(error)}`;
}

/** Read-only snapshot selector. It never changes viewAddress or starts requests. */
function forAddress(user: User | null) {
	const data = (user && snapshots[accountKey(user)]) || emptyData();
	const clearinghouse = data.dexStates[''] ?? null;
	const groups: PerpDexPositionsGroup[] = Object.entries(data.dexStates).map(([dex, state]) => ({
		dex, label: dex || 'Main',
		positions: (state.assetPositions ?? []).map((ap) => ap.position).filter((p) => Number(p.szi) !== 0)
	})).filter((group) => group.positions.length > 0).sort((a, b) => {
		if (!a.dex) return -1;
		if (!b.dex) return 1;
		return a.dex.localeCompare(b.dex);
	});
	return {
		clearinghouse,
		positions: groups.flatMap((group) => group.positions),
		perpDexPositionGroups: groups,
		marginSummary: clearinghouse?.marginSummary ?? null,
		withdrawable: clearinghouse?.withdrawable ?? '0',
		spotBalances: data.spotBalances.filter((balance) => Number(balance.total) !== 0),
		spotBalancesFull: data.spotBalances,
		allDexsClearinghouse: data.hasAllDexs ? Object.entries(data.dexStates) : [],
		dexClearinghouse: data.dexStates,
		webData3Raw: data.webData3Raw,
		spotClearinghouseStateRaw: data.spotRaw,
		errors: Object.values(data.errors)
	};
}

const viewed = $derived(forAddress(viewAddress));

async function loadDex(record: AccountRecord, dex: string, active = () => true) {
	const key = `Margin (${dex || 'Main'})`;
	const current = nextRequest(record, key);
	const wsVersion = record.wsVersion;
	try {
		const state = await infoClient.clearinghouseState({ user: record.user, dex });
		if (!active() || !current() || record.wsVersion !== wsVersion) return;
		record.data.dexStates[dex] = state as unknown as ClearinghouseState;
		report(record, key);
	} catch (error) {
		if (active() && current() && record.wsVersion === wsVersion) report(record, key, error);
	}
}

async function loadSpot(record: AccountRecord, active = () => true) {
	const current = nextRequest(record, 'Spot balances');
	try {
		const result = await infoClient.spotClearinghouseState({ user: record.user });
		if (!active() || !current()) return;
		record.data.spotRaw = result;
		record.data.spotBalances = result.balances as SpotBalance[];
		report(record, 'Spot balances');
	} catch (error) {
		if (active() && current()) report(record, 'Spot balances', error);
	}
}

async function fetchAccountState(user: User) { await loadDex(recordFor(user), ''); }
async function fetchDexState(user: User, dex: string) { await loadDex(recordFor(user), dex); }
async function fetchSpotState(user: User) { await loadSpot(recordFor(user)); }

async function cleanup(target: ViewSession) {
	await Promise.allSettled([...target.keys].map((key) => unsubscribe(key)));
}

async function unsubscribeAccount(user: User) {
	if (viewSession?.record.user !== accountKey(user)) return;
	const previous = viewSession;
	viewSession = null;
	loading = false;
	await cleanup(previous);
}

// Only this explicit view action changes the selected address. Wallet data
// fetches use the address-indexed cache above and cannot steal this selection.
async function loadAddress(user: User) {
	const previous = viewSession;
	viewSession = null;
	if (previous) void cleanup(previous);
	const record = recordFor(user, true);
	const target: ViewSession = { record, keys: new Set() };
	viewSession = target;
	viewAddress = record.user;
	loading = true;
	const active = () => viewSession === target && records.get(record.user) === record;
	const rest = Promise.all([loadDex(record, '', active), loadSpot(record, active)]).finally(() => {
		if (active()) loading = false;
	});
	target.keys.add(`allDexsClearinghouseState:${record.user}`);
	target.keys.add(`webData3:${record.user}`);
	const live = subscribeAllDexsClearinghouseState(record.user, (event) => {
		if (!active() || event.user.toLowerCase() !== record.user) return;
		++record.wsVersion;
		// Full snapshot: missing/empty DEXes must not resurrect old REST positions.
		record.data.dexStates = Object.fromEntries(event.clearinghouseStates ?? []) as Record<string, ClearinghouseState>;
		record.data.hasAllDexs = true;
		for (const key of Object.keys(record.data.errors)) {
			if (key.startsWith('Margin (')) report(record, key);
		}
		report(record, 'Live account');
	}, (error) => { if (active()) report(record, 'Live account', error); })
		.catch((error) => { if (active()) report(record, 'Live account', error); });
	const web = subscribeWebData3(record.user, (event) => {
		if (!active()) return;
		const owner = (event as { userState?: { user?: string } })?.userState?.user;
		if (owner?.toLowerCase() !== record.user) return;
		record.data.webData3Raw = event;
		report(record, 'Account details');
	}, (error) => { if (active()) report(record, 'Account details', error); })
		.catch((error) => { if (active()) report(record, 'Account details', error); });
	await Promise.all([rest, live, web]);
}

function reset() {
	const previous = viewSession;
	viewSession = null;
	if (previous) void cleanup(previous);
	viewAddress = null;
	loading = false;
	records.clear();
	snapshots = {};
}

export const accountStore = {
	get viewAddress() { return viewAddress; },
	get loading() { return loading; },
	get clearinghouse() { return viewed.clearinghouse; },
	get positions() { return viewed.positions; },
	get perpDexPositionGroups() { return viewed.perpDexPositionGroups; },
	get marginSummary() { return viewed.marginSummary; },
	get withdrawable() { return viewed.withdrawable; },
	get spotBalances() { return viewed.spotBalances; },
	get spotBalancesFull() { return viewed.spotBalancesFull; },
	get allDexsClearinghouse() { return viewed.allDexsClearinghouse; },
	get webData3Raw() { return viewed.webData3Raw; },
	get spotClearinghouseStateRaw() { return viewed.spotClearinghouseStateRaw; },
	get dexClearinghouse() { return viewed.dexClearinghouse; },
	get errors() { return viewed.errors; },
	forAddress, loadAddress, fetchAccountState, fetchDexState, fetchSpotState,
	subscribeAccount: loadAddress,
	unsubscribeAccount, reset
};
