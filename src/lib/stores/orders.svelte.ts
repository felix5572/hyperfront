import { infoClient } from '$api/client';
import { subscribeOpenOrders, subscribeUserFills, unsubscribe } from '$api/subscriptions';
import { marketStore } from './market.svelte';
import { VISIBLE_HIP3_DEX_NAMES } from '$utils/constants';

export interface OpenOrder {
	coin: string;
	side: string;
	limitPx: string;
	sz: string;
	oid: number;
	timestamp: number;
	origSz: string;
	cloid?: string;
	orderType?: string;
	isTrigger?: boolean;
	triggerPx?: string;
	reduceOnly?: boolean;
}

export interface Fill {
	coin: string;
	px: string;
	sz: string;
	side: string;
	time: number;
	startPosition: string;
	dir: string;
	closedPnl: string;
	hash: string;
	oid: number;
	crossed: boolean;
	fee: string;
	tid: number;
	feeToken: string;
}

export interface HistoricalOrderEntry {
	order: OpenOrder;
	status: string;
	statusTimestamp: number;
}

// Keep as much fill history as the REST endpoint returns (userFills caps at 2000);
// a smaller cap here would silently truncate history on the first WS event.
const MAX_FILLS = 2000;

// Reactive state
let openOrders = $state<OpenOrder[]>([]);
let fills = $state<Fill[]>([]);
let historicalOrders = $state<HistoricalOrderEntry[]>([]);
let loading = $state(false);
let viewAddress = $state<`0x${string}` | null>(null);
let errors = $state<Record<string, string>>({});

type User = `0x${string}`;
interface OrdersSession {
	user: User;
	ordersByDex: Map<string, OpenOrder[]>;
	requestVersions: Map<string, number>;
	wsVersions: Map<string, number>;
	keys: Set<string>;
	dexNames?: Promise<string[]>;
	realtimeTask?: Promise<void>;
}
let session: OrdersSession | null = null;

function isCurrent(target: OrdersSession) {
	return session === target;
}

function report(target: OrdersSession, key: string, error?: unknown) {
	if (!isCurrent(target)) return;
	if (error == null) {
		delete errors[key];
	} else {
		errors[key] = `${key}: ${error instanceof Error ? error.message : String(error)}`;
	}
}

function nextRequest(target: OrdersSession, key: string) {
	const version = (target.requestVersions.get(key) ?? 0) + 1;
	target.requestVersions.set(key, version);
	return () => isCurrent(target) && target.requestVersions.get(key) === version;
}

async function cleanup(target: OrdersSession) {
	// Unsubscribe invalidates pending SDK handles too (see subscriptions.ts).
	await Promise.allSettled([...target.keys].map((key) => unsubscribe(key)));
	target.keys.clear();
}

function getSession(user: User, force = false): OrdersSession {
	if (!force && session?.user.toLowerCase() === user.toLowerCase()) return session;
	const previous = session;
	session = null;
	if (previous) void cleanup(previous);
	const target: OrdersSession = {
		user, ordersByDex: new Map(), requestVersions: new Map(), wsVersions: new Map(), keys: new Set()
	};
	session = target;
	viewAddress = user;
	// Never label the previous account's data as belonging to this address.
	openOrders = [];
	fills = [];
	historicalOrders = [];
	errors = {};
	loading = false;
	return target;
}

function orderDexNames(target: OrdersSession): Promise<string[]> {
	target.dexNames ??= (async () => {
		try {
			await marketStore.fetchPerpDexs();
			return [...new Set(['', ...marketStore.allHip3Dexes.map((d) => d.name)])];
		} catch (error) {
			report(target, 'DEX discovery (legacy orders may be missing)', error);
			return ['', ...VISIBLE_HIP3_DEX_NAMES];
		}
	})();
	return target.dexNames;
}

function applyOrders(target: OrdersSession, dex: string, orders: OpenOrder[]) {
	if (!isCurrent(target)) return;
	target.ordersByDex.set(dex, orders);
	openOrders = [...target.ordersByDex.values()].flat().sort((a, b) => b.timestamp - a.timestamp);
	prefetchHip3ForCurrentData();
}

// Warm HIP-3 dex metadata for "dex:COIN" names so szDecimals-correct display
// and asset resolution work even when the user never opened the HIP-3 tab.
function prefetchHip3ForCurrentData() {
	const coins = [
		...openOrders.map((o) => o.coin),
		...fills.map((f) => f.coin),
		...historicalOrders.map((e) => e.order.coin)
	];
	marketStore.prefetchHip3Meta(coins).catch((e) => console.error('HIP-3 meta prefetch failed:', e));
}

async function loadOpenOrders(target: OrdersSession, dex?: string) {
	const dexes = dex == null ? await orderDexNames(target) : [dex];
	if (!isCurrent(target)) return;
	await Promise.all(dexes.map(async (name) => {
		const key = `Orders (${name || 'Main'})`;
		const current = nextRequest(target, key);
		const wsVersion = target.wsVersions.get(name) ?? 0;
		try {
			const result = await infoClient.frontendOpenOrders({ user: target.user, dex: name });
			// A newer WS snapshot (or refresh) takes precedence over this REST response.
			if (!current() || (target.wsVersions.get(name) ?? 0) !== wsVersion) return;
			applyOrders(target, name, result as unknown as OpenOrder[]);
			report(target, key);
		} catch (error) {
			if (current() && (target.wsVersions.get(name) ?? 0) === wsVersion) report(target, key, error);
		}
	}));
}

function mergeFills(incoming: Fill[], preferIncoming = true) {
	const dedup = new Map<string, Fill>();
	// Include the side for self-cross fills. Most recent WS data wins over REST.
	for (const fill of preferIncoming ? [...fills, ...incoming] : [...incoming, ...fills]) {
		dedup.set(`${fill.coin}:${fill.tid}:${fill.side}`, fill);
	}
	fills = [...dedup.values()].sort((a, b) => b.time - a.time).slice(0, MAX_FILLS);
}

async function loadFills(target: OrdersSession) {
	const current = nextRequest(target, 'Fills');
	try {
		const result = await infoClient.userFills({ user: target.user });
		if (!current()) return;
		mergeFills(result as unknown as Fill[], false);
		report(target, 'Fills');
		prefetchHip3ForCurrentData();
	} catch (error) {
		if (current()) report(target, 'Fills', error);
	}
}

async function loadHistory(target: OrdersSession) {
	const current = nextRequest(target, 'Order history');
	try {
		const result = await infoClient.historicalOrders({ user: target.user });
		if (!current()) return;
		historicalOrders = result as unknown as HistoricalOrderEntry[];
		report(target, 'Order history');
		prefetchHip3ForCurrentData();
	} catch (error) {
		if (current()) report(target, 'Order history', error);
	}
}

// Omitting dex means all registered DEXes, not just the main one. Explicit
// per-DEX refreshes update only that bucket (including an empty snapshot).
async function fetchOpenOrders(user: User, dex?: string) {
	await loadOpenOrders(getSession(user), dex);
}

async function fetchUserFills(user: User) {
	await loadFills(getSession(user));
}

async function fetchHistoricalOrders(user: User) {
	await loadHistory(getSession(user));
}

async function loadData(target: OrdersSession) {
	const current = nextRequest(target, 'Load');
	loading = true;
	try {
		await Promise.all([loadOpenOrders(target), loadFills(target), loadHistory(target)]);
	} finally {
		if (current()) loading = false;
	}
}

async function loadByAddress(user: User) {
	await loadData(getSession(user));
}

async function subscribeOrders(user: User) {
	const target = getSession(user);
	if (target.realtimeTask) return target.realtimeTask;
	target.realtimeTask = (async () => {
		const dataTask = loadData(target);
		const dexes = await orderDexNames(target);
		if (!isCurrent(target)) return;
		const subscribeTasks = dexes.map(async (dex) => {
			target.keys.add(`openOrders:${user}:${dex}`);
			try {
				await subscribeOpenOrders(user, (data) => {
					if (!isCurrent(target) || data.user.toLowerCase() !== target.user.toLowerCase() || data.dex !== dex) return;
					target.wsVersions.set(dex, (target.wsVersions.get(dex) ?? 0) + 1);
					applyOrders(target, dex, data.orders as OpenOrder[]);
					report(target, `Orders (${dex || 'Main'})`);
					report(target, `Live orders (${dex || 'Main'})`);
				}, dex, (error) => report(target, `Live orders (${dex || 'Main'})`, error));
			} catch (error) {
				report(target, `Live orders (${dex || 'Main'})`, error);
			}
		});
		target.keys.add(`userFills:${user}`);
		subscribeTasks.push(subscribeUserFills(user, (data: unknown) => {
			if (!isCurrent(target)) return;
			const event = data as { user?: string; fills?: Fill[] } | Fill[];
			if (!Array.isArray(event) && event.user && event.user.toLowerCase() !== target.user.toLowerCase()) return;
			const incoming = Array.isArray(event) ? event : event.fills ?? [];
			mergeFills(incoming);
			report(target, 'Live fills');
			prefetchHip3ForCurrentData();
		}, (error) => report(target, 'Live fills', error)).catch((error) => report(target, 'Live fills', error)));
		await Promise.all([dataTask, ...subscribeTasks]);
	})();
	return target.realtimeTask;
}

// Manual retry re-discovers DEXes and reconnects failed streams as well as REST.
async function refresh(user: User) {
	getSession(user, true);
	await subscribeOrders(user);
}

async function unsubscribeOrders(user: User) {
	if (session?.user.toLowerCase() !== user.toLowerCase()) return;
	const previous = session;
	session = null;
	loading = false;
	await cleanup(previous);
}

function reset() {
	const previous = session;
	session = null;
	if (previous) void cleanup(previous);
	openOrders = [];
	fills = [];
	historicalOrders = [];
	loading = false;
	viewAddress = null;
	errors = {};
}

export const ordersStore = {
	get openOrders() { return openOrders; },
	get fills() { return fills; },
	get historicalOrders() { return historicalOrders; },
	get loading() { return loading; },
	get viewAddress() { return viewAddress; },
	get errors() { return Object.values(errors); },
	loadByAddress,
	fetchOpenOrders,
	fetchUserFills,
	fetchHistoricalOrders,
	subscribeOrders,
	refresh,
	unsubscribeOrders,
	reset
};
