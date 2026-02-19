import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			manifest: false, // We provide our own static/manifest.json
			workbox: {
				globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
				runtimeCaching: [
					{
						// Cache Hyperliquid API responses (short-lived)
						urlPattern: /^https:\/\/api\.hyperliquid\.xyz\/info/,
						handler: 'NetworkFirst',
						options: {
							cacheName: 'hl-api-cache',
							expiration: {
								maxEntries: 50,
								maxAgeSeconds: 60
							}
						}
					}
				]
			}
		})
	]
});
