// Analyse the default sample against the live API and store the response as
// the preloaded result rendered on page load. Runs before every build so the
// preview and its version line track what production actually reports.
import { writeFile } from 'node:fs/promises';
import { apiUrl, sampleRequest } from '../src/sample.js';

const target = new URL('../src/sample-result.json', import.meta.url);

try {
    const response = await fetch(`${apiUrl}/analyse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sampleRequest),
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    const json = await response.json();
    if (!Array.isArray(json.tabs) || !json.versions) {
        throw new Error('unexpected response shape');
    }
    await writeFile(target, JSON.stringify(json, null, 2) + '\n');
    console.log(`Captured sample result: PHPStan ${json.versions.phpstan}, phpstan-drupal ${json.versions['phpstan-drupal']}, Drupal ${json.versions.drupal}`);
} catch (error) {
    // A dead API should not block a website deploy; the committed capture
    // keeps working, it just goes stale.
    console.warn(`Sample capture failed (${error.message}); keeping committed sample-result.json`);
}
