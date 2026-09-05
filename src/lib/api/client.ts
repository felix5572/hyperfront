import { InfoClient, HttpTransport, WebSocketTransport, SubscriptionClient } from '@nktkas/hyperliquid';

// Singleton HTTP transport for REST requests
const httpTransport = new HttpTransport();

// Singleton WebSocket transport for subscriptions
const wsTransport = new WebSocketTransport();

// Read-only client for querying market data and user state
export const infoClient = new InfoClient({ transport: httpTransport });

// Real-time subscription client
export const subscriptionClient = new SubscriptionClient({ transport: wsTransport });

/** Observe actual socket lifecycle; a successful subscribe is not a heartbeat. */
export function observeConnection(callback: (connected: boolean) => void): () => void {
	const onOpen = () => callback(true);
	const onClose = () => callback(false);
	wsTransport.socket.addEventListener('open', onOpen);
	wsTransport.socket.addEventListener('close', onClose);
	wsTransport.socket.addEventListener('error', onClose);
	callback(wsTransport.socket.readyState === 1);
	return () => {
		wsTransport.socket.removeEventListener('open', onOpen);
		wsTransport.socket.removeEventListener('close', onClose);
		wsTransport.socket.removeEventListener('error', onClose);
	};
}
