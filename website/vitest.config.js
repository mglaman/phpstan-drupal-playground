import { defineConfig } from 'vitest/config';

// Standalone config: vite.config.js loads the Svelte plugin, which is pinned
// to Vite 3 and incompatible with the Vite bundled by Vitest. The tests only
// exercise plain modules, so no plugins are needed.
export default defineConfig({
    test: {
        include: ['tests/**/*.test.js'],
    },
});
