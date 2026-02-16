import { signTypedData as viemSignTypedData } from 'viem/actions';
import type { WalletClient } from 'viem';
import type { AbstractWallet } from '@nktkas/hyperliquid/signing';

/**
 * Builds an SDK-compatible AbstractWallet (viem local account style) from a
 * WalletClient and the current account address. Use when calling signL1Action
 * or signUserSignedAction with the frontend wallet.
 */
export function createHlWalletAdapter(
	walletClient: WalletClient | null,
	address: `0x${string}` | null
): AbstractWallet | null {
	if (!walletClient || !address) return null;
	return {
		address,
		async signTypedData(params: {
			domain: { name: string; version: string; chainId: number; verifyingContract: `0x${string}` };
			types: Record<string, { name: string; type: string }[]>;
			primaryType: string;
			message: Record<string, unknown>;
		}) {
			const sig = await viemSignTypedData(walletClient, {
				account: address,
				domain: params.domain,
				types: params.types,
				primaryType: params.primaryType,
				message: params.message
			});
			return sig;
		}
	};
}
