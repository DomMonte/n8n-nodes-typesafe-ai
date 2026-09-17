import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { BASE_URL } from './constants';
import { toNodeError } from './errors';
import { typeSafeAiProperties } from './properties';
import {
	buildFormQuestions,
	buildQuestion,
	fromFormEntry,
	parseQuestionsJson,
	parseState,
	resolveModel,
	shapeModels,
	shapeOutput,
	SINGLE_QUESTION_ID,
} from './requestBuilder';
import type {
	ChoiceOptionEntry,
	ModelsResponse,
	Question,
	QuestionOperation,
	RawFormQuestion,
	ScoreLevelEntry,
	StateFormat,
	SystemOneRequest,
	SystemOneResponse,
} from './types';

const CREDENTIAL_NAME = 'typeSafeAiApi';

interface QuestionOptions {
	model?: string;
	simplify?: boolean;
	stateFormat?: StateFormat;
}

export class TypeSafeAi implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'TypeSafe AI',
		name: 'typeSafeAi',
		icon: { light: 'file:typesafe.svg', dark: 'file:typesafe.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{ $parameter["operation"] + ": " + $parameter["resource"] }}',
		description: 'Ask typed yes/no, choice and score questions with the TypeSafe AI System One API',
		defaults: {
			name: 'TypeSafe AI',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: CREDENTIAL_NAME,
				required: true,
			},
		],
		properties: typeSafeAiProperties,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;

				if (resource === 'model' && operation === 'getAll') {
					const response = (await this.helpers.httpRequestWithAuthentication.call(
						this,
						CREDENTIAL_NAME,
						{ method: 'GET', url: `${BASE_URL}/v1/models`, json: true },
					)) as ModelsResponse;
					for (const model of shapeModels(response)) {
						returnData.push({ json: model, pairedItem: { item: i } });
					}
					continue;
				}

				const questionOperation = operation as QuestionOperation;
				const options = this.getNodeParameter('options', i, {}) as QuestionOptions;

				const body: SystemOneRequest = {
					state: parseState(this.getNodeParameter('state', i), options.stateFormat ?? 'auto'),
					model: resolveModel(options.model),
					questions: buildQuestionsForOperation(this, questionOperation, i),
				};

				const response = (await this.helpers.httpRequestWithAuthentication.call(
					this,
					CREDENTIAL_NAME,
					{ method: 'POST', url: `${BASE_URL}/v1/systemone`, body, json: true },
				)) as SystemOneResponse;

				returnData.push({
					json: shapeOutput(questionOperation, response, options.simplify ?? true),
					pairedItem: { item: i },
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message } as IDataObject,
						pairedItem: { item: i },
					});
					continue;
				}
				throw toNodeError(this.getNode(), error, i);
			}
		}

		return [returnData];
	}
}

function buildQuestionsForOperation(
	ctx: IExecuteFunctions,
	operation: QuestionOperation,
	i: number,
): Record<string, Question> {
	if (operation === 'evaluate') {
		const mode = ctx.getNodeParameter('questionsInput', i, 'form') as 'form' | 'json';
		if (mode === 'json') {
			return parseQuestionsJson(ctx.getNodeParameter('questionsJson', i));
		}
		const raw = ctx.getNodeParameter('questions', i, {}) as { values?: RawFormQuestion[] };
		return buildFormQuestions((raw.values ?? []).map(fromFormEntry));
	}

	const instructions = ctx.getNodeParameter('instructions', i, '') as string;

	if (operation === 'askNoul') {
		const criteria = ctx.getNodeParameter('noulCriteria', i, {}) as {
			trueMeans?: string;
			falseMeans?: string;
		};
		return {
			[SINGLE_QUESTION_ID]: buildQuestion({
				type: 'noul',
				instructions,
				trueMeans: criteria.trueMeans,
				falseMeans: criteria.falseMeans,
			}),
		};
	}

	if (operation === 'askChoice') {
		const raw = ctx.getNodeParameter('choiceOptions', i, {}) as { values?: ChoiceOptionEntry[] };
		return {
			[SINGLE_QUESTION_ID]: buildQuestion({
				type: 'choice',
				instructions,
				choiceOptions: raw.values ?? [],
			}),
		};
	}

	const raw = ctx.getNodeParameter('scoreLevels', i, {}) as { values?: ScoreLevelEntry[] };
	return {
		[SINGLE_QUESTION_ID]: buildQuestion({
			type: 'score',
			instructions,
			scoreLevels: raw.values ?? [],
		}),
	};
}
