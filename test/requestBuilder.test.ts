import { describe, expect, it } from 'vitest';

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
} from '../nodes/TypeSafeAi/requestBuilder';
import type { SystemOneResponse } from '../nodes/TypeSafeAi/types';

describe('parseState', () => {
	it('returns plain text unchanged in auto mode', () => {
		expect(parseState('Help! My payouts are failing.', 'auto')).toBe(
			'Help! My payouts are failing.',
		);
	});

	it('parses a JSON object string in auto mode', () => {
		expect(parseState('{"ticket":"hi"}', 'auto')).toEqual({ ticket: 'hi' });
	});

	it('parses a JSON array string in auto mode', () => {
		expect(parseState('[1,2]', 'auto')).toEqual([1, 2]);
	});

	it('keeps a JSON scalar string as text in auto mode', () => {
		expect(parseState('123', 'auto')).toBe('123');
	});

	it('never parses in text mode', () => {
		expect(parseState('{"a":1}', 'text')).toBe('{"a":1}');
	});

	it('parses in json mode', () => {
		expect(parseState('{"a":1}', 'json')).toEqual({ a: 1 });
	});

	it('throws on invalid JSON in json mode', () => {
		expect(() => parseState('{not json', 'json')).toThrow(
			"'State' is not valid JSON. Set 'State Format' to Text to send it as plain text",
		);
	});

	it('throws on a JSON scalar in json mode', () => {
		expect(() => parseState('"just a string"', 'json')).toThrow(
			"'State' must be a JSON object or array when 'State Format' is JSON",
		);
	});

	it('throws on empty state', () => {
		expect(() => parseState('   ', 'auto')).toThrow("'State' cannot be empty");
	});

	it('passes through a non-string value (expression resolved to an object)', () => {
		expect(parseState({ a: 1 }, 'auto')).toEqual({ a: 1 });
		expect(parseState([1], 'json')).toEqual([1]);
	});

	it('stringifies a non-string value in text mode', () => {
		expect(parseState({ a: 1 }, 'text')).toBe('{"a":1}');
	});

	it('throws on null or undefined state', () => {
		expect(() => parseState(undefined, 'auto')).toThrow("'State' cannot be empty");
		expect(() => parseState(null, 'auto')).toThrow("'State' cannot be empty");
	});
});

describe('buildQuestion', () => {
	it('builds a noul question without criteria', () => {
		expect(buildQuestion({ type: 'noul', instructions: 'Is it urgent?' })).toEqual({
			type: 'noul',
			instructions: 'Is it urgent?',
		});
	});

	it('builds a noul question with partial criteria', () => {
		expect(
			buildQuestion({ type: 'noul', instructions: 'Is it urgent?', trueMeans: 'Time-sensitive' }),
		).toEqual({
			type: 'noul',
			instructions: 'Is it urgent?',
			criteria: { true: 'Time-sensitive' },
		});
	});

	it('ignores blank noul criteria', () => {
		expect(
			buildQuestion({ type: 'noul', instructions: 'Q', trueMeans: '  ', falseMeans: '' }),
		).toEqual({ type: 'noul', instructions: 'Q' });
	});

	it('builds a choice question, mapping blank descriptions to null', () => {
		expect(
			buildQuestion({
				type: 'choice',
				instructions: 'Which team?',
				choiceOptions: [
					{ option: 'billing', description: 'Payments' },
					{ option: 'sales', description: '' },
					{ option: 'other' },
				],
			}),
		).toEqual({
			type: 'choice',
			instructions: 'Which team?',
			criteria: { billing: 'Payments', sales: null, other: null },
		});
	});

	it('builds a score question', () => {
		expect(
			buildQuestion({
				type: 'score',
				instructions: 'How angry?',
				scoreLevels: [{ level: 'Calm' }, { level: 'Frustrated' }, { level: 'Furious' }],
			}),
		).toEqual({
			type: 'score',
			instructions: 'How angry?',
			criteria: ['Calm', 'Frustrated', 'Furious'],
		});
	});

	it('rejects empty instructions', () => {
		expect(() => buildQuestion({ type: 'noul', instructions: ' ' })).toThrow(
			"'Instructions' cannot be empty",
		);
	});

	it('rejects a choice question with no options', () => {
		expect(() => buildQuestion({ type: 'choice', instructions: 'Q', choiceOptions: [] })).toThrow(
			"Add at least one entry to 'Choices' for a Choice question",
		);
	});

	it('rejects a choice option with an empty key', () => {
		expect(() =>
			buildQuestion({ type: 'choice', instructions: 'Q', choiceOptions: [{ option: ' ' }] }),
		).toThrow("Every entry in 'Choices' needs a non-empty 'Value'");
	});

	it('rejects duplicate choice options', () => {
		expect(() =>
			buildQuestion({
				type: 'choice',
				instructions: 'Q',
				choiceOptions: [{ option: 'a' }, { option: 'a' }],
			}),
		).toThrow("'Choices' contains the duplicate value 'a'");
	});

	it('rejects a score question with fewer than two levels', () => {
		expect(() =>
			buildQuestion({ type: 'score', instructions: 'Q', scoreLevels: [{ level: 'Only' }] }),
		).toThrow("Add at least two entries to 'Levels' for a Score question");
	});

	it('rejects a blank score level', () => {
		expect(() =>
			buildQuestion({
				type: 'score',
				instructions: 'Q',
				scoreLevels: [{ level: 'A' }, { level: '' }],
			}),
		).toThrow("Every entry in 'Levels' needs a non-empty value");
	});

	it('prefixes messages with the label when given', () => {
		expect(() => buildQuestion({ type: 'noul', instructions: '' }, "Question 'x': ")).toThrow(
			"Question 'x': 'Instructions' cannot be empty",
		);
	});
});

describe('fromFormEntry', () => {
	it('flattens nested fixedCollection values', () => {
		expect(
			fromFormEntry({
				id: 'dept',
				type: 'choice',
				instructions: 'Which?',
				choiceOptions: { values: [{ option: 'a', description: 'A' }] },
				scoreLevels: { values: [{ level: 'x' }] },
				noulCriteria: { trueMeans: 't', falseMeans: 'f' },
			}),
		).toEqual({
			id: 'dept',
			type: 'choice',
			instructions: 'Which?',
			choiceOptions: [{ option: 'a', description: 'A' }],
			scoreLevels: [{ level: 'x' }],
			trueMeans: 't',
			falseMeans: 'f',
		});
	});

	it('defaults missing collections to empty arrays', () => {
		expect(fromFormEntry({ id: 'q', type: 'noul', instructions: 'Q' })).toEqual({
			id: 'q',
			type: 'noul',
			instructions: 'Q',
			choiceOptions: [],
			scoreLevels: [],
			trueMeans: undefined,
			falseMeans: undefined,
		});
	});
});

describe('buildFormQuestions', () => {
	it('keys questions by id', () => {
		expect(
			buildFormQuestions([
				{ id: 'is_urgent', type: 'noul', instructions: 'Urgent?' },
				{
					id: 'mood',
					type: 'score',
					instructions: 'Mood?',
					scoreLevels: [{ level: 'Calm' }, { level: 'Angry' }],
				},
			]),
		).toEqual({
			is_urgent: { type: 'noul', instructions: 'Urgent?' },
			mood: { type: 'score', instructions: 'Mood?', criteria: ['Calm', 'Angry'] },
		});
	});

	it('rejects an empty list', () => {
		expect(() => buildFormQuestions([])).toThrow("Add at least one entry to 'Questions'");
	});

	it('rejects a blank id', () => {
		expect(() => buildFormQuestions([{ id: ' ', type: 'noul', instructions: 'Q' }])).toThrow(
			"Every entry in 'Questions' needs a 'Question ID'",
		);
	});

	it('rejects duplicate ids', () => {
		expect(() =>
			buildFormQuestions([
				{ id: 'a', type: 'noul', instructions: 'Q' },
				{ id: 'a', type: 'noul', instructions: 'Q' },
			]),
		).toThrow("'Questions' contains the duplicate Question ID 'a'");
	});

	it('prefixes per-question validation errors with the id', () => {
		expect(() =>
			buildFormQuestions([{ id: 'dept', type: 'choice', instructions: 'Q', choiceOptions: [] }]),
		).toThrow("Question 'dept': Add at least one entry to 'Choices' for a Choice question");
	});
});

describe('parseQuestionsJson', () => {
	const valid = {
		is_urgent: { type: 'noul', instructions: 'Urgent?' },
		dept: { type: 'choice', instructions: 'Which?', criteria: { a: null } },
	};

	it('accepts a JSON string', () => {
		expect(parseQuestionsJson(JSON.stringify(valid))).toEqual(valid);
	});

	it('accepts an already-parsed object', () => {
		expect(parseQuestionsJson(valid)).toEqual(valid);
	});

	it('rejects invalid JSON', () => {
		expect(() => parseQuestionsJson('{nope')).toThrow("'Questions (JSON)' is not valid JSON");
	});

	it('rejects non-object input', () => {
		expect(() => parseQuestionsJson('[1]')).toThrow(
			"'Questions (JSON)' must be a JSON object keyed by question ID",
		);
		expect(() => parseQuestionsJson('"x"')).toThrow(
			"'Questions (JSON)' must be a JSON object keyed by question ID",
		);
	});

	it('rejects an empty object', () => {
		expect(() => parseQuestionsJson('{}')).toThrow(
			"'Questions (JSON)' must contain at least one question",
		);
	});

	it('rejects an entry without a valid type or instructions', () => {
		expect(() => parseQuestionsJson({ q: { type: 'bogus', instructions: 'x' } })).toThrow(
			"Question 'q' in 'Questions (JSON)' must have a 'type' of noul, choice or score and an 'instructions' field",
		);
		expect(() => parseQuestionsJson({ q: { type: 'noul' } })).toThrow(
			"Question 'q' in 'Questions (JSON)' must have a 'type' of noul, choice or score and an 'instructions' field",
		);
		expect(() => parseQuestionsJson({ q: 'not an object' })).toThrow(
			"Question 'q' in 'Questions (JSON)' must have a 'type' of noul, choice or score and an 'instructions' field",
		);
	});
});

describe('resolveModel', () => {
	it('defaults blank or non-string values to jev-latest', () => {
		expect(resolveModel('')).toBe('jev-latest');
		expect(resolveModel('  ')).toBe('jev-latest');
		expect(resolveModel(undefined)).toBe('jev-latest');
	});

	it('trims a provided model', () => {
		expect(resolveModel(' jev-1.13.0 ')).toBe('jev-1.13.0');
	});
});

describe('shapeOutput', () => {
	const usage = { input_tokens: 10, output_tokens: 2 };

	it('hoists a noul answer when simplified', () => {
		const response: SystemOneResponse = {
			model: 'jev-1.13.0',
			answers: { [SINGLE_QUESTION_ID]: { type: 'noul', noul: 0.92 } },
			usage,
		};
		expect(shapeOutput('askNoul', response, true)).toEqual({
			noul: 0.92,
			model: 'jev-1.13.0',
			usage,
		});
	});

	it('hoists a choice answer when simplified', () => {
		const response: SystemOneResponse = {
			model: 'jev-1.13.0',
			answers: {
				[SINGLE_QUESTION_ID]: {
					type: 'choice',
					choice: 'technical',
					probabilities: { technical: 0.9, billing: 0.1 },
					confidence: 0.85,
				},
			},
			usage,
		};
		expect(shapeOutput('askChoice', response, true)).toEqual({
			choice: 'technical',
			probabilities: { technical: 0.9, billing: 0.1 },
			confidence: 0.85,
			model: 'jev-1.13.0',
			usage,
		});
	});

	it('hoists a score answer when simplified', () => {
		const response: SystemOneResponse = {
			model: 'jev-1.13.0',
			answers: {
				[SINGLE_QUESTION_ID]: {
					type: 'score',
					score: 1.6,
					legend: { '0': 'Calm', '1': 'Angry' },
					probabilities: { '0': 0.4, '1': 0.6 },
					confidence: 0.7,
				},
			},
			usage,
		};
		expect(shapeOutput('askScore', response, true)).toEqual({
			score: 1.6,
			legend: { '0': 'Calm', '1': 'Angry' },
			probabilities: { '0': 0.4, '1': 0.6 },
			confidence: 0.7,
			model: 'jev-1.13.0',
			usage,
		});
	});

	it('returns the raw body when simplify is off', () => {
		const response: SystemOneResponse = {
			model: 'jev-1.13.0',
			answers: { [SINGLE_QUESTION_ID]: { type: 'noul', noul: 0.5 } },
			usage,
		};
		expect(shapeOutput('askNoul', response, false)).toEqual(response);
	});

	it('returns answers keyed by id for evaluate', () => {
		const response: SystemOneResponse = {
			model: 'jev-1.13.0',
			answers: { a: { type: 'noul', noul: 0.5 }, b: { type: 'noul', noul: 0.1 } },
			usage,
		};
		expect(shapeOutput('evaluate', response, true)).toEqual({
			answers: response.answers,
			model: 'jev-1.13.0',
			usage,
		});
	});

	it('throws when the single answer is missing', () => {
		const response: SystemOneResponse = { model: 'jev-1.13.0', answers: {}, usage };
		expect(() => shapeOutput('askNoul', response, true)).toThrow(
			'TypeSafe AI returned no answer for the question',
		);
	});
});

describe('shapeModels', () => {
	it('returns one item per model', () => {
		expect(
			shapeModels({
				models: [
					{ name: 'jev-latest', description: 'Latest', release_date: '2026-01-01' },
					{ name: 'jev-preview', description: 'Preview', release_date: '2026-02-01' },
				],
			}),
		).toEqual([
			{ name: 'jev-latest', description: 'Latest', release_date: '2026-01-01' },
			{ name: 'jev-preview', description: 'Preview', release_date: '2026-02-01' },
		]);
	});

	it('returns an empty list when models are missing', () => {
		expect(shapeModels({} as never)).toEqual([]);
	});
});
