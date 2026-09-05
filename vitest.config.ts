import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
	plugins: [svelte({
		configFile: false,
		// Exercise real reactive store updates, not the SSR snapshot of $derived.
		dynamicCompileOptions: () => ({ generate: 'client' })
	})],
	resolve: {
		alias: {
			$lib: path.resolve('src/lib'),
			$api: path.resolve('src/lib/api'),
			$utils: path.resolve('src/lib/utils')
		}
	},
	test: {
		environment: 'node',
		include: ['src/**/*.test.ts']
	}
});
