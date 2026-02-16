import { InfoClient, HttpTransport, WebSocketTransport, SubscriptionClient } from '@nktkas/hyperliquid';

// Singleton HTTP transport for REST requests
const httpTransport = new HttpTransport();

// Singleton WebSocket transport for subscriptions
const wsTransport = new WebSocketTransport();

// Read-only client for querying market data and user state
export const infoClient = new InfoClient({ transport: httpTransport });

// Real-time subscription client
export const subscriptionClient = new SubscriptionClient({ transport: wsTransport });
