import { infoClient } from '$api/client';
import { subscribeOpenOrders, subscribeUserFills, unsubscribe } from '$api/subscriptions';

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

// Reactive state
let openOrders = $state<OpenOrder[]>([]);
let fills = $state<Fill[]>([]);
let historicalOrders = $state<HistoricalOrderEntry[]>([]);
let loading = $state(false);
let viewAddress = $state<`0x${string}` | null>(null);

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
	loading = false;

	await subscribeOpenOrders(user, (data: { dex: string; user: `0x${string}`; orders: unknown[] }) => {
		openOrders = data.orders as OpenOrder[];
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
		const dedup = new Map<number, Fill>();
		for (const fill of merged) {
			dedup.set(fill.tid, fill);
		}
		fills = Array.from(dedup.values())
			.sort((a, b) => b.time - a.time)
			.slice(0, 200);
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
