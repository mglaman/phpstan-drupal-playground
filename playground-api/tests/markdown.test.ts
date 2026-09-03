import {describe, expect, it} from 'vitest';
import {renderResultMarkdown} from '../src/markdown';

const versions = {phpstan: '2.2.7', 'phpstan-drupal': '2.1.1', drupal: '11.4.4'};
const error = {
	message: 'Function module_load_include not found.',
	line: 3,
	ignorable: true,
	identifier: 'function.notFound',
	tip: 'Learn more at https://phpstan.org/user-guide/discovering-symbols',
};

describe('renderResultMarkdown', () => {
	it('renders the share link, options, code, and current errors', () => {
		const markdown = renderResultMarkdown({
			id: 'abc',
			url: 'https://phpstan-drupal.mglaman.dev/r/abc',
			code: '<?php\n\nmodule_load_include(\'inc\', \'foo\');',
			level: '9',
			config: {strictRules: true, bleedingEdge: false, treatPhpDocTypesAsCertain: true},
			versions,
			tabs: [{title: 'PHP 8.3 – 8.4 (1 error)', errors: [error]}],
			upToDateTabs: [{title: 'PHP 8.3 – 8.4 (1 error)', errors: [error]}],
		});

		expect(markdown).toContain('# phpstan-drupal playground result');
		expect(markdown).toContain('- Share link: https://phpstan-drupal.mglaman.dev/r/abc');
		expect(markdown).toContain('- Level: 9');
		expect(markdown).toContain('- Strict rules: on');
		expect(markdown).toContain('- Bleeding edge: off');
		expect(markdown).toContain('- Treat PHPDoc types as certain: on');
		expect(markdown).toContain('```php\n<?php\n\nmodule_load_include(\'inc\', \'foo\');\n```');
		expect(markdown).toContain('## Current analysis');
		expect(markdown).toContain('PHPStan 2.2.7, phpstan-drupal 2.1.1, Drupal 11.4.4');
		expect(markdown).toContain('### PHP 8.3 – 8.4 (1 error)');
		expect(markdown).toContain('- Line 3: Function module_load_include not found.');
		expect(markdown).toContain('  - Code: `module_load_include(\'inc\', \'foo\');`');
		expect(markdown).toContain('  - Identifier: `function.notFound`');
		expect(markdown).toContain('  - Tip: Learn more at https://phpstan.org/user-guide/discovering-symbols');
		expect(markdown).toContain('  - Ignorable: yes');
		expect(markdown).toContain('The errors saved with this share link match the current analysis.');
	});

	it('shows the saved errors separately when they no longer match', () => {
		const markdown = renderResultMarkdown({
			id: 'abc',
			url: 'https://phpstan-drupal.mglaman.dev/r/abc',
			code: '<?php',
			level: '9',
			config: {strictRules: false, bleedingEdge: false, treatPhpDocTypesAsCertain: true},
			versions,
			tabs: [{title: 'PHP 8.3 – 8.4 (1 error)', errors: [error]}],
			upToDateTabs: [{title: 'PHP 8.3 – 8.4', errors: []}],
		});

		const current = markdown.indexOf('## Current analysis');
		const saved = markdown.indexOf('## Errors when this result was shared');
		expect(current).toBeGreaterThan(-1);
		expect(saved).toBeGreaterThan(current);
		expect(markdown.slice(current, saved)).toContain('### PHP 8.3 – 8.4\n\nNo errors.');
		expect(markdown.slice(saved)).toContain('- Line 3: Function module_load_include not found.');
		expect(markdown).not.toContain('match the current analysis');
	});

	it('escapes code fences inside the analysed code', () => {
		const markdown = renderResultMarkdown({
			id: 'abc',
			url: 'https://phpstan-drupal.mglaman.dev/r/abc',
			code: '<?php\n// ```\necho 1;',
			level: '0',
			config: {strictRules: false, bleedingEdge: false, treatPhpDocTypesAsCertain: true},
			versions,
			tabs: [{title: 'PHP 8.3 – 8.4', errors: []}],
			upToDateTabs: [{title: 'PHP 8.3 – 8.4', errors: []}],
		});

		expect(markdown).toContain('````php\n<?php\n// ```\necho 1;\n````');
	});

	it('omits the saved section for results stored without tabs', () => {
		const markdown = renderResultMarkdown({
			id: 'abc',
			url: 'https://phpstan-drupal.mglaman.dev/r/abc',
			code: '<?php',
			level: '9',
			config: {strictRules: false, bleedingEdge: false, treatPhpDocTypesAsCertain: true},
			versions: undefined,
			tabs: undefined,
			upToDateTabs: [{title: 'PHP 8.3 – 8.4', errors: []}],
		});

		expect(markdown).toContain('## Current analysis\n\n');
		expect(markdown).not.toContain('PHPStan undefined');
		expect(markdown).not.toContain('when this result was shared');
		expect(markdown).not.toContain('match the current analysis');
	});
});
