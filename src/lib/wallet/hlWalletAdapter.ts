import { signTypedData as viemSignTypedData } from 'viem/actions';
import type { WalletClient } from 'viem';
import type { AbstractWallet } from '@nktkas/hyperliquid/signing';

/**
 * Builds an SDK-compatible AbstractWallet from a WalletClient.
 *
 * Uses viem's signTypedData action which properly routes through the transport
 * (WalletConnect, injected, etc.) without any chain validation — viem does not
 * check domain.chainId against the connected chain in signTypedData.
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
			return viemSignTypedData(walletClient, {
				account: address,
				domain: params.domain,
				types: params.types,
				primaryType: params.primaryType,
				message: params.message
			});
		}
	};
}
