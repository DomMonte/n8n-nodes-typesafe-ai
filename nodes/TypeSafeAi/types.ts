export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type StateFormat = 'auto' | 'text' | 'json';

export type QuestionType = 'noul' | 'choice' | 'score';

export type QuestionOperation = 'askNoul' | 'askChoice' | 'askScore' | 'evaluate';

// ---- Request shapes (mirror https://docs.typesafe.ai/api) ----

export interface NoulQuestion {
	type: 'noul';
	instructions: string;
	criteria?: { true?: string; false?: string };
}

export interface ChoiceQuestion {
	type: 'choice';
	instructions: string;
	criteria: Record<string, string | null>;
}

export interface ScoreQuestion {
	type: 'score';
	instructions: string;
	criteria: string[];
}

export type Question = NoulQuestion | ChoiceQuestion | ScoreQuestion;

export interface SystemOneRequest {
	state: JsonValue;
	model: string;
	questions: Record<string, Question>;
}

// ---- Response shapes ----

export interface NoulAnswer {
	type: 'noul';
	noul: number;
}

export interface ChoiceAnswer {
	type: 'choice';
	choice: string;
	probabilities: Record<string, number>;
	confidence: number;
}

export interface ScoreAnswer {
	type: 'score';
	score: number;
	legend: Record<string, string>;
	probabilities: Record<string, number>;
	confidence: number;
}

export type Answer = NoulAnswer | ChoiceAnswer | ScoreAnswer;

export interface Usage {
	input_tokens: number;
	output_tokens: number;
}

export interface SystemOneResponse {
	model: string;
	answers: Record<string, Answer>;
	usage: Usage;
}

export interface ModelCard {
	name: string;
	description: string;
	release_date: string;
}

export interface ModelsResponse {
	models: ModelCard[];
}

// ---- Normalised parameter shapes (what the node passes to requestBuilder) ----

export interface ChoiceOptionEntry {
	option: string;
	description?: string;
}

export interface ScoreLevelEntry {
	level: string;
}

/** One question as authored in the UI, independent of which operation it came from. */
export interface QuestionSpec {
	type: QuestionType;
	instructions: string;
	trueMeans?: string;
	falseMeans?: string;
	choiceOptions?: ChoiceOptionEntry[];
	scoreLevels?: ScoreLevelEntry[];
}

/** Raw value of one entry of the `questions` fixedCollection, as n8n returns it. */
export interface RawFormQuestion {
	id: string;
	type: QuestionType;
	instructions: string;
	trueMeans?: string;
	falseMeans?: string;
	choiceOptions?: { values?: ChoiceOptionEntry[] };
	scoreLevels?: { values?: ScoreLevelEntry[] };
}
