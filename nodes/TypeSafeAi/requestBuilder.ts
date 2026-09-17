import type { IDataObject } from 'n8n-workflow';

import { DEFAULT_MODEL } from './constants';
import type {
	Answer,
	ChoiceQuestion,
	JsonValue,
	ModelsResponse,
	NoulQuestion,
	Question,
	QuestionOperation,
	QuestionSpec,
	QuestionType,
	RawFormQuestion,
	ScoreQuestion,
	StateFormat,
	SystemOneResponse,
} from './types';

function tryParseJson(text: string): { ok: true; value: JsonValue } | { ok: false } {
	let value: JsonValue | undefined;
	let ok = true;
	try {
		value = JSON.parse(text) as JsonValue;
	} catch {
		ok = false;
	}
	return ok ? { ok: true, value: value as JsonValue } : { ok: false };
}

function isObjectOrArray(value: unknown): value is Record<string, JsonValue> | JsonValue[] {
	return typeof value === 'object' && value !== null;
}

/**
 * Turn the raw `State` parameter into the value sent as `state`.
 * Non-string input (an expression that resolved to an object/array) is passed through,
 * except in text mode where it is stringified.
 */
export function parseState(raw: unknown, format: StateFormat): JsonValue {
	if (raw === undefined || raw === null) {
		throw new Error("'State' cannot be empty");
	}
	if (typeof raw !== 'string') {
		return format === 'text' ? JSON.stringify(raw) : (raw as JsonValue);
	}
	if (raw.trim() === '') {
		throw new Error("'State' cannot be empty");
	}
	if (format === 'text') {
		return raw;
	}

	const parsed = tryParseJson(raw);

	if (format === 'json') {
		if (!parsed.ok) {
			throw new Error(
				"'State' is not valid JSON. Set 'State Format' to Text to send it as plain text",
			);
		}
		if (!isObjectOrArray(parsed.value)) {
			throw new Error("'State' must be a JSON object or array when 'State Format' is JSON");
		}
		return parsed.value;
	}

	// auto
	if (parsed.ok && isObjectOrArray(parsed.value)) {
		return parsed.value;
	}
	return raw;
}

export const SINGLE_QUESTION_ID = 'answer';

const QUESTION_TYPES: QuestionType[] = ['noul', 'choice', 'score'];

function nonBlank(value: unknown): value is string {
	return typeof value === 'string' && value.trim() !== '';
}

function buildNoul(spec: QuestionSpec): NoulQuestion {
	const question: NoulQuestion = { type: 'noul', instructions: spec.instructions.trim() };
	const criteria: NoulQuestion['criteria'] = {};
	if (nonBlank(spec.trueMeans)) criteria.true = spec.trueMeans.trim();
	if (nonBlank(spec.falseMeans)) criteria.false = spec.falseMeans.trim();
	if (Object.keys(criteria).length > 0) question.criteria = criteria;
	return question;
}

function buildChoice(spec: QuestionSpec, label: string): ChoiceQuestion {
	const entries = spec.choiceOptions ?? [];
	if (entries.length === 0) {
		throw new Error(`${label}Add at least one entry to 'Choices' for a Choice question`);
	}
	const criteria: Record<string, string | null> = {};
	for (const entry of entries) {
		if (!nonBlank(entry.option)) {
			throw new Error(`${label}Every entry in 'Choices' needs a non-empty 'Value'`);
		}
		const key = entry.option.trim();
		if (key in criteria) {
			throw new Error(`${label}'Choices' contains the duplicate value '${key}'`);
		}
		criteria[key] = nonBlank(entry.description) ? entry.description.trim() : null;
	}
	return { type: 'choice', instructions: spec.instructions.trim(), criteria };
}

function buildScore(spec: QuestionSpec, label: string): ScoreQuestion {
	const entries = spec.scoreLevels ?? [];
	if (entries.length < 2) {
		throw new Error(`${label}Add at least two entries to 'Levels' for a Score question`);
	}
	const criteria = entries.map((entry) => {
		if (!nonBlank(entry.level)) {
			throw new Error(`${label}Every entry in 'Levels' needs a non-empty value`);
		}
		return entry.level.trim();
	});
	return { type: 'score', instructions: spec.instructions.trim(), criteria };
}

/**
 * Build one API question from UI values. `label` is prepended to every validation
 * message (e.g. "Question 'dept': ") so batch errors name the offending entry.
 */
export function buildQuestion(spec: QuestionSpec, label = ''): Question {
	if (!nonBlank(spec.instructions)) {
		throw new Error(`${label}'Instructions' cannot be empty`);
	}
	switch (spec.type) {
		case 'noul':
			return buildNoul(spec);
		case 'choice':
			return buildChoice(spec, label);
		case 'score':
			return buildScore(spec, label);
		default:
			throw new Error(`${label}Unknown question type '${String(spec.type)}'`);
	}
}

/** Flatten one `questions` fixedCollection entry (nested `{ values: [] }`) into a QuestionSpec. */
export function fromFormEntry(raw: RawFormQuestion): QuestionSpec & { id: string } {
	return {
		id: raw.id,
		type: raw.type,
		instructions: raw.instructions,
		trueMeans: raw.noulCriteria?.trueMeans,
		falseMeans: raw.noulCriteria?.falseMeans,
		choiceOptions: raw.choiceOptions?.values ?? [],
		scoreLevels: raw.scoreLevels?.values ?? [],
	};
}

export function buildFormQuestions(
	entries: Array<QuestionSpec & { id: string }>,
): Record<string, Question> {
	if (entries.length === 0) {
		throw new Error("Add at least one entry to 'Questions'");
	}
	const questions: Record<string, Question> = {};
	for (const entry of entries) {
		if (!nonBlank(entry.id)) {
			throw new Error("Every entry in 'Questions' needs a 'Question ID'");
		}
		const id = entry.id.trim();
		if (id in questions) {
			throw new Error(`'Questions' contains the duplicate Question ID '${id}'`);
		}
		questions[id] = buildQuestion(entry, `Question '${id}': `);
	}
	return questions;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validate the raw `Questions (JSON)` parameter (string or already-parsed object). */
export function parseQuestionsJson(raw: unknown): Record<string, Question> {
	let value: unknown = raw;
	if (typeof raw === 'string') {
		const parsed = tryParseJson(raw);
		if (!parsed.ok) {
			throw new Error("'Questions (JSON)' is not valid JSON");
		}
		value = parsed.value;
	}
	if (!isPlainObject(value)) {
		throw new Error("'Questions (JSON)' must be a JSON object keyed by question ID");
	}
	const ids = Object.keys(value);
	if (ids.length === 0) {
		throw new Error("'Questions (JSON)' must contain at least one question");
	}
	for (const id of ids) {
		const question = value[id];
		const valid =
			isPlainObject(question) &&
			QUESTION_TYPES.includes(question.type as QuestionType) &&
			question.instructions !== undefined &&
			question.instructions !== null &&
			question.instructions !== '';
		if (!valid) {
			throw new Error(
				`Question '${id}' in 'Questions (JSON)' must have a 'type' of noul, choice or score and an 'instructions' field`,
			);
		}
	}
	return value as Record<string, Question>;
}

export function resolveModel(model: unknown): string {
	return nonBlank(model) ? model.trim() : DEFAULT_MODEL;
}

export function shapeOutput(
	operation: QuestionOperation,
	response: SystemOneResponse,
	simplify: boolean,
): IDataObject {
	if (!simplify) {
		return response as unknown as IDataObject;
	}
	if (operation === 'evaluate') {
		return {
			answers: response.answers as unknown as IDataObject,
			model: response.model,
			usage: response.usage as unknown as IDataObject,
		};
	}
	const answer: Answer | undefined = response.answers?.[SINGLE_QUESTION_ID];
	if (!answer) {
		throw new Error('TypeSafe AI returned no answer for the question');
	}
	const fields: IDataObject = { ...(answer as unknown as IDataObject) };
	delete fields.type;
	return { ...fields, model: response.model, usage: response.usage as unknown as IDataObject };
}

export function shapeModels(response: ModelsResponse): IDataObject[] {
	return (response.models ?? []).map((model) => ({
		name: model.name,
		description: model.description,
		release_date: model.release_date,
	}));
}
