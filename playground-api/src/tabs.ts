export interface PHPStanError {
	message: string,
	line: number,
	tip?: string,
	identifier?: string,
	ignorable?: boolean,
}

export interface VersionedErrors {
	phpVersion: number,
	errors: PHPStanError[],
}

export interface Tab {
	errors: PHPStanError[],
	title: string,
}

export function createTabs(versionedErrors: VersionedErrors[]): Tab[] {
	const versions: {versions: number[], errors: PHPStanError[]}[] = [];
	let last: {versions: number[], errors: PHPStanError[]} | null = null;
	for (const version of versionedErrors) {
		const phpVersion = version.phpVersion;
		const errors = version.errors;
		const current = {
			versions: [phpVersion],
			errors,
		};
		if (last === null) {
			last = current;
			continue;
		}

		if (errors.length !== last.errors.length) {
			versions.push(last);
			last = current;
			continue;
		}

		let merge = true;
		for (const i in errors) {
			if (!errors.hasOwnProperty(i)) {
				continue;
			}
			const error = errors[i];
			const lastError = last.errors[i];
			if (error.line !== lastError.line) {
				versions.push(last);
				last = current;
				merge = false;
				break;
			}
			if (error.message !== lastError.message) {
				versions.push(last);
				last = current;
				merge = false;
				break;
			}
			if (error.tip !== lastError.tip) {
				versions.push(last);
				last = current;
				merge = false;
				break;
			}
			if (error.identifier !== lastError.identifier) {
				versions.push(last);
				last = current;
				merge = false;
				break;
			}
			if (error.ignorable !== lastError.ignorable) {
				versions.push(last);
				last = current;
				merge = false;
				break;
			}
		}

		if (!merge) {
			continue;
		}

		last.versions.push(phpVersion);
	}

	if (last !== null) {
		versions.push(last);
	}

	versions.sort((a: {versions: number[], errors: PHPStanError[]}, b: {versions: number[], errors: PHPStanError[]}) => {
		const aVersion = a.versions[a.versions.length - 1];
		const bVersion = b.versions[b.versions.length - 1];

		return bVersion - aVersion;
	});

	const tabs: Tab[] = [];
	const versionNumberToString = (version: number): string => {
		const first = Math.floor(version / 10000);
		const second = Math.floor((version % 10000) / 100);
		const third = Math.floor(version % 100);

		return first + '.' + second + (third !== 0 ? '.' + third : '');
	}
	for (const version of versions) {
		let title = 'PHP ';
		if (version.versions.length > 1) {
			title += versionNumberToString(version.versions[0]);
			title += ' – ';
			title += versionNumberToString(version.versions[version.versions.length - 1]);
		} else {
			title += versionNumberToString(version.versions[0]);
		}

		if (version.errors.length === 1) {
			title += ' (1 error)';
		} else if (version.errors.length > 0) {
			title += ' (' + version.errors.length + ' errors)';
		}
		tabs.push({
			errors: version.errors,
			title: title,
		});
	}

	return tabs;
}
