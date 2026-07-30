import {analyseResult, retrieveLegacyResult, retrieveResult, retrieveSample, withCors} from './src/handlers';

module.exports = {
	analyseResult: withCors(analyseResult),
	retrieveResult: withCors(retrieveResult),
	retrieveSample: withCors(retrieveSample),
	retrieveLegacyResult: withCors(retrieveLegacyResult),
};
