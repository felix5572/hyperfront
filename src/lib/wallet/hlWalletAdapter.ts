import { signTypedData as viemSignTypedData } from 'viem/actions';
import type { WalletClient } from 'viem';
import type { AbstractWallet } from '@nktkas/hyperliquid/signing';

/**
 * Builds an SDK-compatible AbstractWallet from a WalletClient.
 *
 * Uses viem's signTypedData action which properly routes through the transport
 * (WalletConnect, injected, etc.). EIP712Domain must be stripped from types
 * because viem derives it from the domain object itself.
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
			// viem builds EIP712Domain from the domain object — passing it in
			// types causes a duplicate type error, so strip it first.
			const { EIP712Domain: _eip712Domain, ...restTypes } = params.types;
			return viemSignTypedData(walletClient, {
				account: address,
				domain: params.domain,
				types: restTypes,
				primaryType: params.primaryType,
				message: params.message
			});
		}
	};
}
