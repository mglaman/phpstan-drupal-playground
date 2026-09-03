import {beforeEach, describe, expect, it} from 'vitest';
import {mockClient} from 'aws-sdk-client-mock';
import {InvokeCommand, LambdaClient} from '@aws-sdk/client-lambda';
import {GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client} from '@aws-sdk/client-s3';
import {analyseResult, analyseResultInternal, retrieveSample, withCors} from '../src/handlers';

const lambdaMock = mockClient(LambdaClient);
const s3Mock = mockClient(S3Client);

const runnerResponse = (result: object[]) => ({
	Payload: new TextEncoder().encode(JSON.stringify({
		result,
		versions: {phpstan: '2.2.7', 'phpstan-drupal': '2.1.1', drupal: '11.4.4'},
	})) as any,
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

describe('analyseResultInternal', () => {
	it('invokes the runner once per PHP version', async () => {
		lambdaMock.on(InvokeCommand).resolves(runnerResponse([sampleError]));

		const {versionedErrors, versions} = await analyseResultInternal('<?php', '9', false, false, true, [80300, 80400]);

		expect(versionedErrors).toEqual([
			{phpVersion: 80300, errors: [sampleError]},
			{phpVersion: 80400, errors: [sampleError]},
		]);
		expect(versions).toEqual({phpstan: '2.2.7', 'phpstan-drupal': '2.1.1', drupal: '11.4.4'});

		const calls = lambdaMock.commandCalls(InvokeCommand);
		expect(calls).toHaveLength(2);
		const payloads = calls.map((call) => JSON.parse(call.args[0].input.Payload as string));
		expect(payloads.map((payload) => payload.phpVersion)).toEqual([80300, 80400]);
		expect(payloads[0].code).toBe('<?php');
		expect(payloads[0].level).toBe('9');
	});
});

describe('analyseResult', () => {
	it('analyses, saves, and returns tabs with an id', async () => {
		lambdaMock.on(InvokeCommand).resolves(runnerResponse([sampleError]));
		s3Mock.on(PutObjectCommand).resolves({});

		const response = await analyseResult({
			body: JSON.stringify({code: '<?php', level: '9'}),
			queryStringParameters: {},
		});

		expect(response.statusCode).toBe(200);
		const body = JSON.parse(response.body!);
		expect(body.tabs).toHaveLength(1);
		expect(body.tabs[0].title).toBe('PHP 8.3 – 8.4 (1 error)');
		expect(body.versions).toEqual({phpstan: '2.2.7', 'phpstan-drupal': '2.1.1', drupal: '11.4.4'});
		expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
		expect(body.url).toBe('https://phpstan-drupal.mglaman.dev/r/' + body.id);

		const putCalls = s3Mock.commandCalls(PutObjectCommand);
		expect(putCalls).toHaveLength(1);
		expect(putCalls[0].args[0].input.Key).toBe('api/results/' + body.id + '.json');
		expect(JSON.parse(putCalls[0].args[0].input.Body as string).versions)
			.toEqual({phpstan: '2.2.7', 'phpstan-drupal': '2.1.1', drupal: '11.4.4'});
	});

	it('skips saving when saveResult is false', async () => {
		lambdaMock.on(InvokeCommand).resolves(runnerResponse([]));

		const response = await analyseResult({
			body: JSON.stringify({code: '<?php', level: '9', saveResult: false}),
			queryStringParameters: {},
		});

		expect(response.statusCode).toBe(200);
		expect(JSON.parse(response.body!).id).toBeUndefined();
		expect(JSON.parse(response.body!).url).toBeUndefined();
		expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(0);
	});

	it('returns 400 on malformed request bodies', async () => {
		const response = await analyseResult({body: 'not json', queryStringParameters: {}});

		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body!)).toEqual({error: 'Request body must be JSON.'});
	});

	it('returns 400 when code is missing', async () => {
		const response = await analyseResult({body: JSON.stringify({level: '9'}), queryStringParameters: {}});

		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body!)).toEqual({error: 'Request body must include a "code" string.'});
	});

	it('defaults the level to 9', async () => {
		lambdaMock.on(InvokeCommand).resolves(runnerResponse([]));

		const response = await analyseResult({
			body: JSON.stringify({code: '<?php', saveResult: false}),
			queryStringParameters: {},
		});

		expect(response.statusCode).toBe(200);
		const payloads = lambdaMock.commandCalls(InvokeCommand)
			.map((call) => JSON.parse(call.args[0].input.Payload as string));
		expect(payloads[0].level).toBe('9');
	});
});

describe('retrieveSample', () => {
	it('returns the stored result', async () => {
		s3Mock.on(GetObjectCommand).resolves({
			Body: {
				transformToString: async () => JSON.stringify({
					code: '<?php',
					level: '9',
					config: {strictRules: true, bleedingEdge: false, treatPhpDocTypesAsCertain: true},
					versionedErrors: [{phpVersion: 80300, errors: [sampleError]}],
				}),
			} as any,
		});

		const response = await retrieveSample({
			body: '',
			queryStringParameters: {id: 'abc'},
		});

		expect(response.statusCode).toBe(200);
		const body = JSON.parse(response.body!);
		expect(body.code).toBe('<?php');
		expect(body.config.strictRules).toBe(true);
		expect(body.versionedErrors).toEqual([{phpVersion: 80300, errors: [sampleError]}]);

		const getCalls = s3Mock.commandCalls(GetObjectCommand);
		expect(getCalls[0].args[0].input.Key).toBe('api/results/abc.json');
	});

	it('returns 404 when the result does not exist', async () => {
		s3Mock.on(GetObjectCommand).rejects(new NoSuchKey({message: 'The specified key does not exist.', $metadata: {}}));

		const response = await retrieveSample({body: '', queryStringParameters: {id: 'missing'}});

		expect(response.statusCode).toBe(404);
	});
});

describe('withCors', () => {
	it('adds the CORS header to responses', async () => {
		const wrapped = withCors(async () => ({statusCode: 200, body: 'ok'}));

		const response = await wrapped({body: '', queryStringParameters: {}});

		expect(response.headers).toEqual({'Access-Control-Allow-Origin': '*'});
		expect(response.body).toBe('ok');
	});
});
