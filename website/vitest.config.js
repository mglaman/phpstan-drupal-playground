import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
    plugins: [svelte()],
    resolve: {
        // Without this, tests resolve Svelte's server build and mount() fails.
        conditions: ['browser'],
    },
    test: {
        include: ['tests/**/*.test.js'],
    },
});
