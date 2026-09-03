import {beforeEach, describe, expect, it} from 'vitest';
import {mockClient} from 'aws-sdk-client-mock';
import {InvokeCommand, LambdaClient} from '@aws-sdk/client-lambda';
import {GetObjectCommand, NoSuchKey, S3Client} from '@aws-sdk/client-s3';
import {retrieveLegacyResult, retrieveResult} from '../src/handlers';

const lambdaMock = mockClient(LambdaClient);
const s3Mock = mockClient(S3Client);

const runnerResponse = (result: object[]) => ({
	Payload: new TextEncoder().encode(JSON.stringify({
		result,
		versions: {phpstan: '2.2.7', 'phpstan-drupal': '2.1.1', drupal: '11.4.4'},
	})) as any,
});

const s3Object = (json: object) => ({
	Body: {
		transformToString: async () => JSON.stringify(json),
	} as any,
});

const sampleError = {
	message: 'Function module_load_include not found.',
	line: 3,
	ignorable: true,
	identifier: 'function.notFound',
};

beforeEach(() => {
	lambdaMock.reset();
	s3Mock.reset();
});

describe('retrieveResult', () => {
	it('re-analyses the stored versions plus the currently supported ones', async () => {
		s3Mock.on(GetObjectCommand).resolves(s3Object({
			code: '<?php',
			level: '9',
			version: 'N/A',
			config: {strictRules: true, bleedingEdge: false, treatPhpDocTypesAsCertain: true},
			versionedErrors: [{phpVersion: 80100, errors: [sampleError]}],
		}));
		lambdaMock.on(InvokeCommand).resolves(runnerResponse([sampleError]));

		const response = await retrieveResult({body: '', queryStringParameters: {id: 'abc'}});

		expect(response.statusCode).toBe(200);
		const payloads = lambdaMock.commandCalls(InvokeCommand)
			.map((call) => JSON.parse(call.args[0].input.Payload as string));
		expect(payloads.map((payload) => payload.phpVersion)).toEqual([80100, 80300, 80400]);
		expect(payloads[0].strictRules).toBe(true);

		const body = JSON.parse(response.body!);
		expect(body.tabs[0].title).toBe('PHP 8.1 (1 error)');
		expect(body.versionedErrors).toEqual([{phpVersion: 80100, errors: [sampleError]}]);
		expect(body.versions).toEqual({phpstan: '2.2.7', 'phpstan-drupal': '2.1.1', drupal: '11.4.4'});
	});

	it('collapses up-to-date tabs to the stored versions when results match', async () => {
		s3Mock.on(GetObjectCommand).resolves(s3Object({
			code: '<?php',
			level: '9',
			version: 'N/A',
			config: {},
			versionedErrors: [{phpVersion: 80100, errors: [sampleError]}],
		}));
		// The runner reports the same error on every version, so the newer
		// versions add nothing and the stored versions tell the whole story.
		lambdaMock.on(InvokeCommand).resolves(runnerResponse([sampleError]));

		const response = await retrieveResult({body: '', queryStringParameters: {id: 'abc'}});

		const body = JSON.parse(response.body!);
		expect(body.upToDateTabs).toHaveLength(1);
		expect(body.upToDateTabs[0].title).toBe('PHP 8.1 (1 error)');
		expect(body.upToDateVersionedErrors.map((errors: any) => errors.phpVersion)).toEqual([80100, 80300, 80400]);
	});

	it('keeps the full up-to-date tabs when newer versions differ', async () => {
		s3Mock.on(GetObjectCommand).resolves(s3Object({
			code: '<?php',
			level: '9',
			version: 'N/A',
			config: {},
			versionedErrors: [{phpVersion: 80100, errors: [sampleError]}],
		}));
		lambdaMock.on(InvokeCommand)
			.resolvesOnce(runnerResponse([sampleError]))
			.resolves(runnerResponse([]));

		const response = await retrieveResult({body: '', queryStringParameters: {id: 'abc'}});

		const body = JSON.parse(response.body!);
		expect(body.upToDateTabs).toHaveLength(2);
		expect(body.upToDateTabs[0].title).toBe('PHP 8.3 – 8.4');
		expect(body.upToDateTabs[1].title).toBe('PHP 8.1 (1 error)');
	});

	it('falls back for legacy results stored without versioned errors', async () => {
		s3Mock.on(GetObjectCommand).resolves(s3Object({
			code: '<?php',
			level: '5',
			version: '1.10.0',
			config: {},
			errors: [sampleError],
		}));
		lambdaMock.on(InvokeCommand).resolves(runnerResponse([]));

		const response = await retrieveResult({body: '', queryStringParameters: {id: 'abc'}});

		const payloads = lambdaMock.commandCalls(InvokeCommand)
			.map((call) => JSON.parse(call.args[0].input.Payload as string));
		expect(payloads.map((payload) => payload.phpVersion)).toEqual([80300, 80400]);

		const body = JSON.parse(response.body!);
		expect(body.versionedErrors).toEqual([{phpVersion: 70400, errors: [sampleError]}]);
		expect(body.tabs).toBeUndefined();
	});

	it('includes the share link so callers do not have to build it', async () => {
		s3Mock.on(GetObjectCommand).resolves(s3Object({
			code: '<?php',
			level: '9',
			version: 'N/A',
			config: {},
			versionedErrors: [{phpVersion: 80300, errors: []}],
		}));
		lambdaMock.on(InvokeCommand).resolves(runnerResponse([]));

		const response = await retrieveResult({body: '', queryStringParameters: {id: 'abc'}});

		const body = JSON.parse(response.body!);
		expect(body.id).toBe('abc');
		expect(body.url).toBe('https://phpstan-drupal.mglaman.dev/r/abc');
	});

	it('renders Markdown when asked for it', async () => {
		s3Mock.on(GetObjectCommand).resolves(s3Object({
			code: '<?php\n\nmodule_load_include(\'inc\', \'foo\');',
			level: '9',
			version: 'N/A',
			config: {strictRules: true},
			versionedErrors: [{phpVersion: 80300, errors: [sampleError]}, {phpVersion: 80400, errors: [sampleError]}],
		}));
		lambdaMock.on(InvokeCommand).resolves(runnerResponse([sampleError]));

		const response = await retrieveResult({body: '', queryStringParameters: {id: 'abc', format: 'markdown'}});

		expect(response.statusCode).toBe(200);
		expect(response.headers?.['Content-Type']).toBe('text/markdown; charset=utf-8');
		expect(response.body).toContain('- Share link: https://phpstan-drupal.mglaman.dev/r/abc');
		expect(response.body).toContain('- Strict rules: on');
		expect(response.body).toContain('```php\n<?php\n\nmodule_load_include(\'inc\', \'foo\');\n```');
		expect(response.body).toContain('### PHP 8.3 – 8.4 (1 error)');
		expect(response.body).toContain('- Line 3: Function module_load_include not found.');
	});

	it('returns 404 when the result does not exist', async () => {
		s3Mock.on(GetObjectCommand).rejects(new NoSuchKey({message: 'The specified key does not exist.', $metadata: {}}));

		const response = await retrieveResult({body: '', queryStringParameters: {id: 'missing'}});

		expect(response.statusCode).toBe(404);
		expect(JSON.parse(response.body!)).toEqual({error: 'No result with id "missing".'});
	});

	it('returns 400 without an id', async () => {
		const response = await retrieveResult({body: '', queryStringParameters: null});

		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body!)).toEqual({error: 'Missing id query parameter.'});
	});

	it('returns 500 on unexpected storage failures', async () => {
		s3Mock.on(GetObjectCommand).rejects(new Error('boom'));

		const response = await retrieveResult({body: '', queryStringParameters: {id: 'missing'}});

		expect(response.statusCode).toBe(500);
	});
});

describe('retrieveLegacyResult', () => {
	it('reads the sharded legacy layout and re-analyses the code', async () => {
		s3Mock.on(GetObjectCommand, {
			Bucket: 'phpstan-drupal-playground',
			Key: 'data/results/ab/abcdef/input.json',
		}).resolves(s3Object({
			phpCode: '<?php echo 1;',
			level: 7,
			phpStanVersion: '0.12.99',
		}));
		s3Mock.on(GetObjectCommand, {
			Bucket: 'phpstan-drupal-playground',
			Key: 'data/results/ab/abcdef/output.json',
		}).resolves(s3Object({
			output: '\u001b[31mFound 1 error\u001b[0m',
		}));
		lambdaMock.on(InvokeCommand).resolves(runnerResponse([sampleError]));

		const response = await retrieveLegacyResult({body: '', queryStringParameters: {id: 'abcdef'}});

		expect(response.statusCode).toBe(200);
		const body = JSON.parse(response.body!);
		expect(body.code).toBe('<?php echo 1;');
		expect(body.level).toBe('7');
		expect(body.version).toBe('0.12.99');
		expect(body.htmlErrors).toContain('Found 1 error');
		expect(body.htmlErrors).toContain('<span');
		expect(body.upToDateTabs[0].title).toBe('PHP 8.3 – 8.4 (1 error)');
		expect(body.versions).toEqual({phpstan: '2.2.7', 'phpstan-drupal': '2.1.1', drupal: '11.4.4'});

		const payloads = lambdaMock.commandCalls(InvokeCommand)
			.map((call) => JSON.parse(call.args[0].input.Payload as string));
		expect(payloads.map((payload) => payload.phpVersion)).toEqual([80300, 80400]);
		expect(payloads[0].level).toBe('7');
	});

	it('returns 404 when the legacy result does not exist', async () => {
		s3Mock.on(GetObjectCommand).rejects(new NoSuchKey({message: 'The specified key does not exist.', $metadata: {}}));

		const response = await retrieveLegacyResult({body: '', queryStringParameters: {id: 'missing'}});

		expect(response.statusCode).toBe(404);
	});
});
