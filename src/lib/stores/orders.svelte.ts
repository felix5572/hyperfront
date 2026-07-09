import { infoClient } from '$api/client';
import { subscribeOpenOrders, subscribeUserFills, unsubscribe } from '$api/subscriptions';
import { marketStore } from './market.svelte';

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

// Fetch open orders (frontendOpenOrders = with extra frontend info). No wallet required.
async function fetchOpenOrders(user: `0x${string}`, dex = '') {
	const result = await infoClient.frontendOpenOrders({ user, dex });
	openOrders = result as unknown as OpenOrder[];
}

// Fetch user fills (REST). No wallet required.
async function fetchUserFills(user: `0x${string}`) {
	const result = await infoClient.userFills({ user });
	fills = result as unknown as Fill[];
}

// Fetch historical orders (REST, up to 2000). No wallet required.
async function fetchHistoricalOrders(user: `0x${string}`) {
	const result = await infoClient.historicalOrders({ user });
	historicalOrders = result as unknown as HistoricalOrderEntry[];
}

// Load orders, fills, and historical orders by address (REST only). No wallet required.
async function loadByAddress(user: `0x${string}`) {
	loading = true;
	viewAddress = user;
	try {
		await Promise.all([
			fetchOpenOrders(user),
			fetchUserFills(user),
			fetchHistoricalOrders(user)
		]);
		prefetchHip3ForCurrentData();
	} finally {
		loading = false;
	}
}

// Subscribe to real-time open orders (full snapshot) and fills (when wallet connected or viewing address)
async function subscribeOrders(user: `0x${string}`) {
	if (viewAddress && viewAddress !== user) await unsubscribeOrders(viewAddress);

	loading = true;
	viewAddress = user;
	await Promise.all([fetchOpenOrders(user), fetchUserFills(user), fetchHistoricalOrders(user)]);
	prefetchHip3ForCurrentData();
	loading = false;

	await subscribeOpenOrders(user, (data: { dex: string; user: `0x${string}`; orders: unknown[] }) => {
		openOrders = data.orders as OpenOrder[];
		prefetchHip3ForCurrentData();
	});

	await subscribeUserFills(user, (data: unknown) => {
		// WS userFills event shape is { user, fills: Fill[], isSnapshot? }, not a raw array.
		const event = data as { fills?: Fill[] } | Fill[];
		const incoming = Array.isArray(event)
			? event
			: Array.isArray(event?.fills)
				? event.fills
				: [];
		if (incoming.length === 0) return;

		const merged = [...incoming, ...fills];
		// A self-cross produces two fills (one per side) sharing the same tid,
		// so the dedup key must include the side.
		const dedup = new Map<string, Fill>();
		for (const fill of merged) {
			dedup.set(`${fill.tid}:${fill.side}`, fill);
		}
		fills = Array.from(dedup.values())
			.sort((a, b) => b.time - a.time)
			.slice(0, MAX_FILLS);
	});
}

async function unsubscribeOrders(user: `0x${string}`) {
	await unsubscribe(`openOrders:${user}:`);
	await unsubscribe(`userFills:${user}`);
}

function reset() {
	openOrders = [];
	fills = [];
	historicalOrders = [];
	loading = false;
	viewAddress = null;
}

export const ordersStore = {
	get openOrders() { return openOrders; },
	get fills() { return fills; },
	get historicalOrders() { return historicalOrders; },
	get loading() { return loading; },
	get viewAddress() { return viewAddress; },
	loadByAddress,
	fetchOpenOrders,
	fetchUserFills,
	fetchHistoricalOrders,
	subscribeOrders,
	unsubscribeOrders,
	reset
};
