import {RunnerVersions} from './handlers';
import {PHPStanError, Tab} from './tabs';

export interface ResultConfig {
	strictRules: boolean;
	bleedingEdge: boolean;
	treatPhpDocTypesAsCertain: boolean;
}

export interface MarkdownResult {
	id: string;
	url: string;
	code: string;
	level: string;
	config: ResultConfig;
	versions?: RunnerVersions;
	// Errors saved with the share link. Missing for results stored before
	// per-version errors existed.
	tabs?: Tab[];
	// Errors from analysing the saved code against the current runner.
	upToDateTabs: Tab[];
}

// Render a shared result as Markdown so an agent or a person can read the
// whole reproduction in one fetch: the options, the code, and every error
// next to the line it points at.
export function renderResultMarkdown(result: MarkdownResult): string {
	const onOff = (value: boolean): string => value ? 'on' : 'off';
	const codeLines = result.code.split('\n');

	const sections: string[] = [
		'# phpstan-drupal playground result',
		[
			`- Share link: ${result.url}`,
			`- Level: ${result.level}`,
			`- Strict rules: ${onOff(result.config.strictRules)}`,
			`- Bleeding edge: ${onOff(result.config.bleedingEdge)}`,
			`- Treat PHPDoc types as certain: ${onOff(result.config.treatPhpDocTypesAsCertain)}`,
		].join('\n'),
		'## Code',
		fencedCode(result.code, 'php'),
		'## Current analysis' + (result.versions ? '\n\n' + describeVersions(result.versions) : ''),
		renderTabs(result.upToDateTabs, codeLines),
	];

	if (result.tabs !== undefined) {
		if (JSON.stringify(result.tabs) === JSON.stringify(result.upToDateTabs)) {
			sections.push('The errors saved with this share link match the current analysis.');
		} else {
			sections.push('## Errors when this result was shared');
			sections.push('The current analysis above differs from what was saved with this share link. The runner has been updated since.');
			sections.push(renderTabs(result.tabs, codeLines));
		}
	}

	return sections.join('\n\n') + '\n';
}

function describeVersions(versions: RunnerVersions): string {
	return `Analysed with PHPStan ${versions.phpstan}, phpstan-drupal ${versions['phpstan-drupal']}, Drupal ${versions.drupal}.`;
}

function renderTabs(tabs: Tab[], codeLines: string[]): string {
	return tabs.map((tab) => {
		const body = tab.errors.length === 0
			? 'No errors.'
			: tab.errors.map((error) => renderError(error, codeLines)).join('\n');
		return `### ${tab.title}\n\n${body}`;
	}).join('\n\n');
}

function renderError(error: PHPStanError, codeLines: string[]): string {
	const lines = [`- Line ${error.line}: ${error.message}`];
	const source = codeLines[error.line - 1];
	if (source !== undefined && source.trim() !== '') {
		lines.push(`  - Code: ${inlineCode(source.trim())}`);
	}
	if (error.identifier) {
		lines.push(`  - Identifier: ${inlineCode(error.identifier)}`);
	}
	if (error.tip) {
		lines.push(`  - Tip: ${error.tip}`);
	}
	if (error.ignorable !== undefined) {
		lines.push(`  - Ignorable: ${error.ignorable ? 'yes' : 'no'}`);
	}
	return lines.join('\n');
}

// Use a fence one backtick longer than any run inside the code so the
// analysed code cannot close the block early.
function fencedCode(code: string, language: string): string {
	const longestRun = Math.max(2, ...(code.match(/`+/g) ?? []).map((run) => run.length));
	const fence = '`'.repeat(longestRun + 1);
	return `${fence}${language}\n${code}\n${fence}`;
}

function inlineCode(text: string): string {
	const longestRun = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
	const fence = '`'.repeat(longestRun + 1);
	return `${fence}${text}${fence}`;
}
