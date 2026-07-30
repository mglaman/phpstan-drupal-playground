import {describe, expect, it} from 'vitest';
import {createTabs, PHPStanError} from '../src/tabs';

const error = (overrides: Partial<PHPStanError> = {}): PHPStanError => ({
	message: 'Cannot call method label() on Drupal\\node\\Entity\\Node|null.',
	line: 4,
	ignorable: true,
	identifier: 'method.nonObject',
	...overrides,
});

describe('createTabs', () => {
	it('returns no tabs for no analysed versions', () => {
		expect(createTabs([])).toEqual([]);
	});

	it('merges versions with identical errors into a range tab', () => {
		const tabs = createTabs([
			{phpVersion: 80300, errors: [error()]},
			{phpVersion: 80400, errors: [error()]},
		]);

		expect(tabs).toHaveLength(1);
		expect(tabs[0].title).toBe('PHP 8.3 – 8.4 (1 error)');
		expect(tabs[0].errors).toEqual([error()]);
	});

	it('splits versions whose errors differ and sorts newest first', () => {
		const tabs = createTabs([
			{phpVersion: 80300, errors: [error(), error({line: 9, message: 'Syntax error', identifier: 'phpstan.parse'})]},
			{phpVersion: 80400, errors: [error()]},
		]);

		expect(tabs).toHaveLength(2);
		expect(tabs[0].title).toBe('PHP 8.4 (1 error)');
		expect(tabs[1].title).toBe('PHP 8.3 (2 errors)');
	});

	it('splits when messages differ on the same line', () => {
		const tabs = createTabs([
			{phpVersion: 80300, errors: [error({message: 'a'})]},
			{phpVersion: 80400, errors: [error({message: 'b'})]},
		]);

		expect(tabs).toHaveLength(2);
	});

	it('omits the error count for clean results', () => {
		const tabs = createTabs([
			{phpVersion: 80300, errors: []},
			{phpVersion: 80400, errors: []},
		]);

		expect(tabs).toHaveLength(1);
		expect(tabs[0].title).toBe('PHP 8.3 – 8.4');
	});

	it('renders patch versions in titles', () => {
		const tabs = createTabs([
			{phpVersion: 80301, errors: []},
		]);

		expect(tabs[0].title).toBe('PHP 8.3.1');
	});
});
