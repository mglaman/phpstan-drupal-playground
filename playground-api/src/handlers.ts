import {InvokeCommandOutput, Lambda} from '@aws-sdk/client-lambda';
import {S3} from '@aws-sdk/client-s3';
import { v4 as uuid } from 'uuid';
import * as Sentry from "@sentry/node";
import {createTabs, PHPStanError, VersionedErrors} from './tabs';

Sentry.init({
  dsn: "https://eb2a3a58974934df33e68af214e70607@o4505060230627328.ingest.sentry.io/4506276580818944",

  // We recommend adjusting this value in production, or using tracesSampler
  // for finer control
  tracesSampleRate: 1.0,
});

export interface HttpRequest {
	body: string;
	queryStringParameters: any;
}

export interface HttpResponse {
	statusCode: number;
	body?: string;
	headers?: Record<string, string>;
}

const lambda = new Lambda({});
const s3 = new S3({});

export async function analyseResultInternal(
	code: string,
	level: string,
	runStrictRules: boolean,
	runBleedingEdge: boolean,
	treatPhpDocTypesAsCertain: boolean,
	phpVersions: number[],
): Promise<VersionedErrors[]> {
	const lambdaPromises: [Promise<InvokeCommandOutput>, number][] = [];
	for (const phpVersion of phpVersions) {
		lambdaPromises.push([lambda.invoke({
			// arn:aws:lambda:us-east-1:994345088675:function:phpstan-drupal-runner-prod-analyze
			FunctionName: 'phpstan-drupal-runner-prod-analyze',
			Payload: JSON.stringify({
				code: code,
				level: level,
				strictRules: runStrictRules,
				bleedingEdge: runBleedingEdge,
				treatPhpDocTypesAsCertain: treatPhpDocTypesAsCertain,
				phpVersion: phpVersion,
			}),
		}), phpVersion]);
	}

	const versionedErrors: VersionedErrors[] = [];
	for (const tuple of lambdaPromises) {
		const promise = tuple[0];
		const phpVersion = tuple[1];
		const lambdaResult = await promise;

		const jsonResponse = JSON.parse(new TextDecoder().decode(lambdaResult.Payload));
		versionedErrors.push({
			phpVersion: phpVersion,
			errors: jsonResponse.result.map((error: any): PHPStanError => {
				const obj: PHPStanError = {
					line: error.line,
					message: error.message,
					ignorable: error.ignorable,
				};
				if (error.tip) {
					obj.tip = error.tip;
				}

				if (error.identifier) {
					obj.identifier = error.identifier;
				}

				return obj;
			}),
		});
	}

	return versionedErrors;
}

export async function analyseResult(request: HttpRequest): Promise<HttpResponse> {
	try {
		const json = JSON.parse(request.body);
		const runStrictRules = typeof json.strictRules !== 'undefined' ? json.strictRules : false;
		const runBleedingEdge = typeof json.bleedingEdge !== 'undefined' ? json.bleedingEdge : false;
		const treatPhpDocTypesAsCertain = typeof json.treatPhpDocTypesAsCertain !== 'undefined' ? json.treatPhpDocTypesAsCertain : true;
		const saveResult: boolean = typeof json.saveResult !== 'undefined' ? json.saveResult : true;

		const versionedErrors = await analyseResultInternal(
			json.code,
			json.level,
			runStrictRules,
			runBleedingEdge,
			treatPhpDocTypesAsCertain,
			[80300, 80400],
		);
		const response: any = {
			tabs: createTabs(versionedErrors),
			versionedErrors,
		};

		if (saveResult) {
			const id: string = uuid() as string;
			await s3.putObject({
				Bucket: 'phpstan-drupal-playground',
				Key: 'api/results/' + id + '.json',
				ContentType: 'application/json',
				Body: JSON.stringify({
					code: json.code,
					versionedErrors: versionedErrors,
					version: 'N/A',
					level: json.level,
					config: {
						strictRules: runStrictRules,
						bleedingEdge: runBleedingEdge,
						treatPhpDocTypesAsCertain: treatPhpDocTypesAsCertain,
					},
				}),
			});

			response.id = id;
		}

		return Promise.resolve({
			statusCode: 200,
			body: JSON.stringify(response),
		});
	} catch (e) {
		console.error(e);
		Sentry.captureException(e);
		return Promise.resolve({statusCode: 500});
	}
}

export async function retrieveResult(request: HttpRequest): Promise<HttpResponse> {
	try {
		const id = request.queryStringParameters.id;
		const object = await s3.getObject({
			Bucket: 'phpstan-drupal-playground',
			Key: 'api/results/' + id + '.json',
		});
		const json = JSON.parse(await object.Body!.transformToString());
		const strictRules = typeof json.config.strictRules !== 'undefined' ? json.config.strictRules : false;
		const bleedingEdge = typeof json.config.bleedingEdge !== 'undefined' ? json.config.bleedingEdge : false;
		const treatPhpDocTypesAsCertain = typeof json.config.treatPhpDocTypesAsCertain !== 'undefined' ? json.config.treatPhpDocTypesAsCertain : true;

		let phpVersionsToAnalyse: number[] = [];
		if (typeof json.versionedErrors !== 'undefined') {
			phpVersionsToAnalyse = json.versionedErrors.map((errors: VersionedErrors) => {
				return errors.phpVersion;
			});
		}

		if (!phpVersionsToAnalyse.includes(80300)) {
			phpVersionsToAnalyse.push(80300);
		}
		if (!phpVersionsToAnalyse.includes(80400)) {
			phpVersionsToAnalyse.push(80400);
		}

		const newResult = await analyseResultInternal(
			json.code,
			json.level,
			strictRules,
			bleedingEdge,
			treatPhpDocTypesAsCertain,
			phpVersionsToAnalyse,
		);
		const newTabs = createTabs(newResult);

		const bodyJson: any = {
			code: json.code,
			errors: json.errors,
			version: json.version,
			level: json.level,
			config: {
				strictRules,
				bleedingEdge,
				treatPhpDocTypesAsCertain,
			},
			upToDateTabs: newTabs,
			upToDateVersionedErrors: newResult,
		};

		if (typeof json.versionedErrors !== 'undefined') {
			bodyJson.versionedErrors = json.versionedErrors;
		} else {
			bodyJson.versionedErrors = [{phpVersion: 70400, errors: json.errors}];
		}
		if (typeof json.versionedErrors !== 'undefined') {
			bodyJson.tabs = createTabs(json.versionedErrors);

			const originalPhpVersions: number[] = json.versionedErrors.map((errors: VersionedErrors) => {
				return errors.phpVersion;
			});
			const filteredNewResult = newResult.filter((errors) => {
				return originalPhpVersions.indexOf(errors.phpVersion) !== -1;
			});
			const filteredNewTabs = createTabs(filteredNewResult);
			if (filteredNewTabs.length === newTabs.length) {
				const firstFilteredNewTab = filteredNewTabs[0];
				const firstNewTab = newTabs[0];
				if (firstFilteredNewTab.errors.length === firstNewTab.errors.length) {
					let isSame = true;
					for (let i = 0; i < firstFilteredNewTab.errors.length; i++) {
						const error = firstFilteredNewTab.errors[i];
						const otherError = firstNewTab.errors[i];

						if (error.line !== otherError.line) {
							isSame = false;
							break;
						}

						if (error.message !== otherError.message) {
							isSame = false;
							break;
						}

						if (error.tip !== otherError.tip) {
							isSame = false;
							break;
						}

						if (error.identifier !== otherError.identifier) {
							isSame = false;
							break;
						}

						if (error.ignorable !== otherError.ignorable) {
							isSame = false;
							break;
						}
					}

					if (isSame) {
						bodyJson.upToDateTabs = filteredNewTabs;
					}
				}
			}
		}
		return Promise.resolve({
			statusCode: 200,
			body: JSON.stringify(bodyJson),
		});
	} catch (e) {
		console.error(e);
		Sentry.captureException(e);
		return Promise.resolve({statusCode: 500});
	}
}

export async function retrieveSample(request: HttpRequest): Promise<HttpResponse> {
	try {
		const id = request.queryStringParameters.id;
		const object = await s3.getObject({
			Bucket: 'phpstan-drupal-playground',
			Key: 'api/results/' + id + '.json',
		});
		const json = JSON.parse(await object.Body!.transformToString());
		const strictRules = typeof json.config.strictRules !== 'undefined' ? json.config.strictRules : false;
		const bleedingEdge = typeof json.config.bleedingEdge !== 'undefined' ? json.config.bleedingEdge : false;
		const treatPhpDocTypesAsCertain = typeof json.config.treatPhpDocTypesAsCertain !== 'undefined' ? json.config.treatPhpDocTypesAsCertain : true;

		const bodyJson: any = {
			code: json.code,
			errors: json.errors,
			version: json.version,
			level: json.level,
			config: {
				strictRules,
				bleedingEdge,
				treatPhpDocTypesAsCertain,
			},
		};
		if (typeof json.versionedErrors !== 'undefined') {
			bodyJson.versionedErrors = json.versionedErrors;
		} else {
			bodyJson.versionedErrors = [{phpVersion: 70400, errors: json.errors}];
		}
		return Promise.resolve({
			statusCode: 200,
			body: JSON.stringify(bodyJson),
		});
	} catch (e) {
		console.error(e);
		Sentry.captureException(e);
		return Promise.resolve({statusCode: 500});
	}
}

export async function retrieveLegacyResult(request: HttpRequest): Promise<HttpResponse> {
	try {
		const id = request.queryStringParameters.id;
		const firstTwoChars = id.substr(0, 2);
		const path = 'data/results/' + firstTwoChars + '/' + id;
		const inputObject = await s3.getObject({
			Bucket: 'phpstan-drupal-playground',
			Key: path + '/input.json',
		});
		const outputObject = await s3.getObject({
			Bucket: 'phpstan-drupal-playground',
			Key: path + '/output.json',
		});
		const inputJson = JSON.parse(await inputObject.Body!.transformToString());
		const AnsiToHtml = require('ansi-to-html');
		const convert = new AnsiToHtml();
		const result = await analyseResultInternal(
			inputJson.phpCode,
			inputJson.level.toString(),
			false,
			false,
			true,
			[80300, 80400],
		);

		return Promise.resolve({
			statusCode: 200,
			body: JSON.stringify({
				code: inputJson.phpCode,
				htmlErrors: convert.toHtml(JSON.parse(await outputObject.Body!.transformToString()).output),
				upToDateTabs: createTabs(result),
				upToDateVersionedErrors: result,
				version: inputJson.phpStanVersion,
				level: inputJson.level.toString(),
				config: {
					strictRules: false,
					bleedingEdge: false,
					treatPhpDocTypesAsCertain: true,
				},
			}),
		});
	} catch (e) {
		console.error(e);
		Sentry.captureException(e);
		return Promise.resolve({statusCode: 500});
	}
}

export const withCors = (handler: (request: HttpRequest) => Promise<HttpResponse>) => {
	return async (request: HttpRequest): Promise<HttpResponse> => {
		const response = await handler(request);
		return {
			...response,
			headers: {
				...response.headers,
				'Access-Control-Allow-Origin': '*',
			},
		};
	};
};
