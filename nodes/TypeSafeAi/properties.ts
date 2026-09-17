import type { INodeProperties } from 'n8n-workflow';

import { DEFAULT_MODEL } from './constants';

const QUESTION_OPS = ['askChoice', 'askNoul', 'askScore', 'evaluate'];

const choiceOptionsProperty = (
	displayOptions: INodeProperties['displayOptions'],
): INodeProperties => ({
	displayName: 'Options',
	name: 'choiceOptions',
	type: 'fixedCollection',
	typeOptions: { multipleValues: true, sortable: true },
	placeholder: 'Add Option',
	default: {},
	required: true,
	description: 'The set of options the model chooses from',
	displayOptions,
	options: [
		{
			displayName: 'Values',
			name: 'values',
			values: [
				{
					displayName: 'Option',
					name: 'option',
					type: 'string',
					default: '',
					required: true,
					placeholder: 'e.g. billing',
					description: 'The option key returned in the answer',
				},
				{
					displayName: 'Description',
					name: 'description',
					type: 'string',
					default: '',
					placeholder: 'e.g. Payments, invoicing, refunds',
					description: 'Optional rubric describing when this option applies',
				},
			],
		},
	],
});

const scoreLevelsProperty = (
	displayOptions: INodeProperties['displayOptions'],
): INodeProperties => ({
	displayName: 'Levels',
	name: 'scoreLevels',
	type: 'fixedCollection',
	typeOptions: { multipleValues: true, sortable: true },
	placeholder: 'Add Level',
	default: {},
	required: true,
	description: 'Ordered level descriptions from lowest to highest, at least two',
	hint: 'Order matters: the first level is the lowest',
	displayOptions,
	options: [
		{
			displayName: 'Values',
			name: 'values',
			values: [
				{
					displayName: 'Level',
					name: 'level',
					type: 'string',
					default: '',
					required: true,
					placeholder: 'e.g. Calm',
					description: 'A concrete description of this level',
				},
			],
		},
	],
});

export const typeSafeAiProperties: INodeProperties[] = [
	{
		displayName: 'Resource',
		name: 'resource',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'Model', value: 'model' },
			{ name: 'Question', value: 'question' },
		],
		default: 'question',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['question'] } },
		options: [
			{
				name: 'Ask Choice',
				value: 'askChoice',
				description:
					'Pick one option from a set you define and get the full probability distribution',
				action: 'Choose one option',
			},
			{
				name: 'Ask Score',
				value: 'askScore',
				description: 'Rate the state against ordered levels and get a probability-weighted score',
				action: 'Score against ordered levels',
			},
			{
				name: 'Ask Yes/No',
				value: 'askNoul',
				description: 'Ask a yes/no question and get the probability that the answer is yes',
				action: 'Ask a yes or no question',
			},
			{
				name: 'Evaluate Questions',
				value: 'evaluate',
				description: 'Ask several questions about the same state in a single request',
				action: 'Evaluate many questions in one call',
			},
		],
		default: 'askChoice',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['model'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List the models available to your account',
				action: 'Get many models',
			},
		],
		default: 'getAll',
	},

	// ---- Shared question fields ----
	{
		displayName: 'State',
		name: 'state',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		required: true,
		placeholder: 'e.g. {{ $json.message }}',
		description:
			'The content to evaluate: plain text, or a JSON object or array for structured data such as chat logs or records',
		displayOptions: { show: { resource: ['question'], operation: QUESTION_OPS } },
	},
	{
		displayName: 'Instructions',
		name: 'instructions',
		type: 'string',
		typeOptions: { rows: 2 },
		default: '',
		required: true,
		placeholder: 'e.g. Which team should handle this ticket?',
		description: 'The question the model should answer about the state',
		displayOptions: {
			show: { resource: ['question'], operation: ['askChoice', 'askNoul', 'askScore'] },
		},
	},

	// ---- Ask Yes/No ----
	{
		displayName: 'Criteria',
		name: 'noulCriteria',
		type: 'collection',
		placeholder: 'Add Criterion',
		default: {},
		description: 'Optional descriptions of what a yes and a no mean',
		displayOptions: { show: { resource: ['question'], operation: ['askNoul'] } },
		options: [
			{
				displayName: 'False Means',
				name: 'falseMeans',
				type: 'string',
				default: '',
				placeholder: 'e.g. No urgency expressed',
				description: 'What a no (value near 0) means',
			},
			{
				displayName: 'True Means',
				name: 'trueMeans',
				type: 'string',
				default: '',
				placeholder: 'e.g. Explicitly time-sensitive',
				description: 'What a yes (value near 1) means',
			},
		],
	},

	// ---- Ask Choice ----
	choiceOptionsProperty({ show: { resource: ['question'], operation: ['askChoice'] } }),

	// ---- Ask Score ----
	scoreLevelsProperty({ show: { resource: ['question'], operation: ['askScore'] } }),

	// ---- Evaluate Questions ----
	{
		displayName: 'Questions Input',
		name: 'questionsInput',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'Form', value: 'form', description: 'Define each question with the fields below' },
			{
				name: 'JSON',
				value: 'json',
				description: 'Provide the questions map exactly as the API expects it',
			},
		],
		default: 'form',
		description: 'How to define the questions',
		displayOptions: { show: { resource: ['question'], operation: ['evaluate'] } },
	},
	{
		displayName: 'Questions',
		name: 'questions',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true, sortable: true },
		placeholder: 'Add Question',
		default: {},
		required: true,
		description: 'The questions to ask about the state',
		displayOptions: {
			show: { resource: ['question'], operation: ['evaluate'], questionsInput: ['form'] },
		},
		options: [
			{
				displayName: 'Values',
				name: 'values',
				values: [
					{
						displayName: 'Question ID',
						name: 'id',
						type: 'string',
						default: '',
						required: true,
						placeholder: 'e.g. is_urgent',
						description: 'Key under which the answer is returned',
					},
					{
						displayName: 'Type',
						name: 'type',
						type: 'options',
						options: [
							{ name: 'Choice', value: 'choice' },
							{ name: 'Score', value: 'score' },
							{ name: 'Yes/No', value: 'noul' },
						],
						default: 'noul',
						description: 'The kind of judgment to ask for',
					},
					{
						displayName: 'Instructions',
						name: 'instructions',
						type: 'string',
						typeOptions: { rows: 2 },
						default: '',
						required: true,
						description: 'The question the model should answer about the state',
					},
					{
						displayName: 'Criteria',
						name: 'noulCriteria',
						type: 'collection',
						placeholder: 'Add Criterion',
						default: {},
						description: 'Optional descriptions of what a yes and a no mean',
						displayOptions: { show: { type: ['noul'] } },
						options: [
							{
								displayName: 'False Means',
								name: 'falseMeans',
								type: 'string',
								default: '',
								placeholder: 'e.g. No urgency expressed',
								description: 'What a no (value near 0) means',
							},
							{
								displayName: 'True Means',
								name: 'trueMeans',
								type: 'string',
								default: '',
								placeholder: 'e.g. Explicitly time-sensitive',
								description: 'What a yes (value near 1) means',
							},
						],
					},
					choiceOptionsProperty({ show: { type: ['choice'] } }),
					scoreLevelsProperty({ show: { type: ['score'] } }),
				],
			},
		],
	},
	{
		displayName: 'Questions (JSON)',
		name: 'questionsJson',
		type: 'json',
		default:
			'{\n  "is_urgent": {\n    "type": "noul",\n    "instructions": "Does this convey urgency?"\n  }\n}',
		required: true,
		description:
			'A JSON object mapping question IDs to question objects, as documented at docs.typesafe.ai/api',
		displayOptions: {
			show: { resource: ['question'], operation: ['evaluate'], questionsInput: ['json'] },
		},
	},

	// ---- Options (all question operations) ----
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['question'], operation: QUESTION_OPS } },
		options: [
			{
				displayName: 'Model',
				name: 'model',
				type: 'string',
				default: DEFAULT_MODEL,
				placeholder: 'e.g. jev-1.13.0',
				description:
					'Model name or alias; pin a versioned ID such as jev-1.13.0 if you have tuned thresholds against it',
			},
			{
				displayName: 'Simplify',
				name: 'simplify',
				type: 'boolean',
				default: true,
				description:
					'Whether to return a simplified version of the response instead of the raw data',
			},
			{
				displayName: 'State Format',
				name: 'stateFormat',
				type: 'options',
				options: [
					{
						name: 'Auto',
						value: 'auto',
						description:
							'Send as JSON if the state parses as a JSON object or array, otherwise as text',
					},
					{
						name: 'JSON',
						value: 'json',
						description: 'Always parse the state as JSON and fail if it is invalid',
					},
					{ name: 'Text', value: 'text', description: 'Always send the state as plain text' },
				],
				default: 'auto',
				description: 'How to interpret the State field',
			},
		],
	},
];
