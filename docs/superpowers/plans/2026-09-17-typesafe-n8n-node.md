# TypeSafe AI n8n Community Node Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `n8n-nodes-typesafe-ai`, a verified-eligible n8n community node that calls the TypeSafe AI System One API (Noul / Choice / Score questions, batch evaluation, model listing) with a native n8n UI.

**Architecture:** One programmatic node (`TypeSafeAi`) plus one credential (`typeSafeAiApi`). All parameter→request and response→output logic lives in pure, unit-tested helper modules (`requestBuilder.ts`, `errors.ts`); `TypeSafeAi.node.ts` only reads parameters, calls `this.helpers.httpRequestWithAuthentication`, and maps errors. UI definition lives in `properties.ts`.

**Tech Stack:** TypeScript 5.9, `n8n-workflow` (peer, resolves to 2.39.x), `@n8n/node-cli` (build/lint/dev/release), vitest (devDependency, tests only), GitHub Actions publish with npm provenance. **No runtime dependencies.**

**Spec:** `docs/superpowers/specs/2026-09-17-typesafe-n8n-node-design.md`

## Global Constraints

- Package name `n8n-nodes-typesafe-ai`; keyword `n8n-community-node-package`; licence MIT; `n8n.strict: true`.
- **No runtime dependencies** (`dependencies` must stay absent). Only `devDependencies` and the `n8n-workflow` peer. Do not import `@typesafe-ai/sdk`.
- Do **not** modify `eslint.config.mjs` (strict mode compares it byte-for-byte to the template; changing it disables cloud eligibility).
- No `process`, `setTimeout`, `__dirname`, env vars, or filesystem access in `nodes/` or `credentials/` (lint rule `no-restricted-globals`).
- Inside any `catch` block, only `throw new NodeApiError(...)` / `throw new NodeOperationError(...)` are allowed (lint rule `require-node-api-error`). Helper modules must not `throw` inside `catch` at all — parse in `try`, throw *after* the `try/catch`.
- Node description must include `icon` (themed `{ light, dark }`), `subtitle`, and `usableAsTool: true`. Credential class must include a themed `icon`, `documentationUrl` (a full URL), and `test`.
- Every output item must carry `pairedItem: { item: i }`.
- Descriptions: sentence case, single sentence, **no trailing period**. Boolean descriptions start with "Whether". Display names Title Case. Option lists and `collection` items sorted alphabetically by name (lint enforces).
- API constants: `BASE_URL = 'https://api.typesafe.ai'`, `DEFAULT_MODEL = 'jev-latest'`. Endpoints: `POST /v1/systemone`, `GET /v1/models`.
- Formatting: tabs, single quotes, trailing commas, printWidth 100 (`.prettierrc.js` from template). Run `npm run lint:fix` before `npm run lint` in every task.
- Commit messages end with: `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
- Repository URL assumption: `https://github.com/DomMonte/n8n-nodes-typesafe-ai` (GitHub user inferred from `git config user.name`; confirm with the user before publishing).

## File Structure

| Path | Responsibility |
|---|---|
| `package.json` | Package metadata, `n8n.nodes`/`n8n.credentials` registration, scripts, devDependencies |
| `.github/workflows/ci.yml`, `publish.yml` | CI (lint/test/build) and provenance publish |
| `credentials/TypeSafeAiApi.credentials.ts` | Bearer API-key credential + credential test request |
| `nodes/TypeSafeAi/constants.ts` | `BASE_URL`, `DEFAULT_MODEL` |
| `nodes/TypeSafeAi/types.ts` | TS types mirroring the TypeSafe HTTP API and the normalised parameter shapes |
| `nodes/TypeSafeAi/requestBuilder.ts` | Pure functions: state parsing, question building (single/form/JSON), output shaping |
| `nodes/TypeSafeAi/errors.ts` | Pure functions: extract HTTP status + API detail from thrown errors, build friendly `NodeApiError`/`NodeOperationError` |
| `nodes/TypeSafeAi/properties.ts` | `INodeProperties[]` — the complete UI definition |
| `nodes/TypeSafeAi/TypeSafeAi.node.ts` | `INodeType` class: description + `execute()` |
| `nodes/TypeSafeAi/TypeSafeAi.node.json` | Codex metadata (categories, documentation links) |
| `nodes/TypeSafeAi/typesafe.svg`, `typesafe.dark.svg` | Node/credential icons |
| `test/requestBuilder.test.ts`, `test/errors.test.ts` | Vitest unit tests (outside `nodes/` so they are neither compiled into `dist` nor published) |
| `README.md` | Install, credentials, operations with examples, output reference, rate-limit note |

---

### Task 1: Scaffold the package from the n8n template

**Files:**
- Create: everything from the `programmatic/example` template, merged into the repo root
- Modify: `package.json`, `.github/workflows/ci.yml`, `.github/workflows/publish.yml`, `.gitignore`

**Interfaces:**
- Produces: a building, linting package skeleton with scripts `build`, `dev`, `lint`, `lint:fix`, `test`, `release`.

- [ ] **Step 1: Generate the template into a temp dir and merge it into the repo root**

```bash
cd /Users/domenic/Developer/Typesafe-n8n
TMP=$(mktemp -d)
(cd "$TMP" && npx --yes @n8n/node-cli@latest new n8n-nodes-typesafe-ai --template programmatic/example --skip-install --force)
rsync -a --exclude .git "$TMP/n8n-nodes-typesafe-ai/" ./
rm -rf "$TMP"
ls -la
```

Expected: repo root now contains `.agents/`, `.github/`, `.vscode/`, `nodes/Example/`, `AGENTS.md`, `CLAUDE.md`, `CHANGELOG.md`, `README.md`, `eslint.config.mjs`, `.prettierrc.js`, `package.json`, `tsconfig.json`, and the pre-existing `docs/`.

- [ ] **Step 2: Fix package.json metadata**

Replace the whole file with:

```json
{
	"name": "n8n-nodes-typesafe-ai",
	"version": "0.1.0",
	"description": "n8n community node for the TypeSafe AI System One API: ask typed yes/no, choice and score questions about your data and get calibrated probabilities back",
	"license": "MIT",
	"homepage": "https://github.com/DomMonte/n8n-nodes-typesafe-ai",
	"keywords": [
		"n8n-community-node-package",
		"typesafe",
		"typesafe-ai",
		"ai",
		"classification"
	],
	"author": {
		"name": "DomMonte",
		"email": "monte351@gmail.com"
	},
	"repository": {
		"type": "git",
		"url": "https://github.com/DomMonte/n8n-nodes-typesafe-ai.git"
	},
	"scripts": {
		"build": "n8n-node build",
		"build:watch": "tsc --watch",
		"dev": "n8n-node dev",
		"lint": "n8n-node lint",
		"lint:fix": "n8n-node lint --fix",
		"test": "vitest run",
		"test:watch": "vitest",
		"release": "n8n-node release",
		"prepublishOnly": "n8n-node prerelease"
	},
	"files": [
		"dist"
	],
	"n8n": {
		"n8nNodesApiVersion": 1,
		"strict": true,
		"credentials": [],
		"nodes": [
			"dist/nodes/Example/Example.node.js"
		]
	},
	"devDependencies": {
		"@n8n/node-cli": "*",
		"eslint": "9.32.0",
		"prettier": "3.6.2",
		"release-it": "^19.0.4",
		"typescript": "5.9.2",
		"vitest": "^3.2.4"
	},
	"peerDependencies": {
		"n8n-workflow": "*"
	}
}
```

(The Example node stays registered for now so lint/build pass; Task 6 replaces it.)

- [ ] **Step 3: Fix the templating bug in the generated workflows and add a test step to CI**

In `.github/workflows/publish.yml` the last line reads `NPM_TOKEN: $`. Change it to:

```yaml
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

In `.github/workflows/ci.yml`, change `group: ci-$` to:

```yaml
  group: ci-${{ github.ref }}
```

and add a test step between "Run lint" and "Run build":

```yaml
      - name: Run tests
        run: 'npm test'
```

Verify:

```bash
grep -n 'secrets.NPM_TOKEN' .github/workflows/publish.yml
grep -n 'github.ref' .github/workflows/ci.yml
grep -n 'npm test' .github/workflows/ci.yml
```

Expected: one match each.

- [ ] **Step 4: Extend .gitignore**

Append to `.gitignore`:

```
coverage
*.tsbuildinfo
.DS_Store
```

- [ ] **Step 5: Install and verify the skeleton builds, lints and tests**

```bash
npm install
npm run lint
npm run build
npx vitest run --passWithNoTests
```

Expected: lint reports no errors (the template Example node is lint-clean), build prints `✓ Build successful`, vitest exits 0 with "No test files found".

If `npm run lint` reports errors from `package.json` (e.g. `no-template-placeholders`, `require-homepage`), fix the offending field and re-run — do not touch `eslint.config.mjs`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold n8n-nodes-typesafe-ai from n8n programmatic template

Fix stripped \${{ }} expressions in generated workflows, add vitest.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Credential `typeSafeAiApi` and icons

**Files:**
- Create: `credentials/TypeSafeAiApi.credentials.ts`
- Create: `nodes/TypeSafeAi/typesafe.svg`, `nodes/TypeSafeAi/typesafe.dark.svg`
- Modify: `package.json` (`n8n.credentials`)

**Interfaces:**
- Produces: credential type name `'typeSafeAiApi'` (used by `httpRequestWithAuthentication` in Task 6). Icon files referenced by both the credential and the node.

- [ ] **Step 1: Create the icons**

`nodes/TypeSafeAi/typesafe.svg` (light theme):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect x="4" y="4" width="56" height="56" rx="14" fill="#1F2937"/>
  <path d="M18 24h28M32 24v20" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round"/>
  <circle cx="46" cy="44" r="6" fill="#34D399"/>
</svg>
```

`nodes/TypeSafeAi/typesafe.dark.svg` (dark theme):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect x="4" y="4" width="56" height="56" rx="14" fill="#F3F4F6"/>
  <path d="M18 24h28M32 24v20" stroke="#111827" stroke-width="6" stroke-linecap="round"/>
  <circle cx="46" cy="44" r="6" fill="#059669"/>
</svg>
```

- [ ] **Step 2: Write the credential**

`credentials/TypeSafeAiApi.credentials.ts`:

```ts
import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

export class TypeSafeAiApi implements ICredentialType {
	name = 'typeSafeAiApi';

	displayName = 'TypeSafe AI API';

	documentationUrl = 'https://docs.typesafe.ai/api';

	icon: Icon = {
		light: 'file:../nodes/TypeSafeAi/typesafe.svg',
		dark: 'file:../nodes/TypeSafeAi/typesafe.dark.svg',
	};

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Your TypeSafe AI API key',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.typesafe.ai',
			url: '/v1/models',
			method: 'GET',
		},
	};
}
```

- [ ] **Step 3: Register the credential in package.json**

In `package.json`, set:

```json
		"credentials": [
			"dist/credentials/TypeSafeAiApi.credentials.js"
		],
```

- [ ] **Step 4: Lint and build**

```bash
npm run lint:fix && npm run lint && npm run build
ls dist/credentials dist/nodes/TypeSafeAi
```

Expected: no lint errors; `dist/credentials/TypeSafeAiApi.credentials.js` exists; both SVGs copied to `dist/nodes/TypeSafeAi/`.

- [ ] **Step 5: Commit**

```bash
git add credentials nodes/TypeSafeAi/typesafe.svg nodes/TypeSafeAi/typesafe.dark.svg package.json
git commit -m "feat: add TypeSafe AI API credential and icons

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Types, constants, and `parseState`

**Files:**
- Create: `nodes/TypeSafeAi/constants.ts`
- Create: `nodes/TypeSafeAi/types.ts`
- Create: `nodes/TypeSafeAi/requestBuilder.ts` (partial — `parseState` only)
- Create: `test/requestBuilder.test.ts`

**Interfaces:**
- Produces:
  - `constants.ts`: `export const BASE_URL = 'https://api.typesafe.ai'; export const DEFAULT_MODEL = 'jev-latest';`
  - `types.ts`: everything below (used by Tasks 4–6).
  - `requestBuilder.ts`: `parseState(raw: unknown, format: StateFormat): JsonValue`

- [ ] **Step 1: Write constants and types**

`nodes/TypeSafeAi/constants.ts`:

```ts
export const BASE_URL = 'https://api.typesafe.ai';
export const DEFAULT_MODEL = 'jev-latest';
```

`nodes/TypeSafeAi/types.ts`:

```ts
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
```

- [ ] **Step 2: Write the failing tests for `parseState`**

`test/requestBuilder.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { parseState } from '../nodes/TypeSafeAi/requestBuilder';

describe('parseState', () => {
	it('returns plain text unchanged in auto mode', () => {
		expect(parseState('Help! My payouts are failing.', 'auto')).toBe('Help! My payouts are failing.');
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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run test/requestBuilder.test.ts`
Expected: FAIL — cannot resolve `../nodes/TypeSafeAi/requestBuilder`.

- [ ] **Step 4: Implement `parseState`**

`nodes/TypeSafeAi/requestBuilder.ts`:

```ts
import type { JsonValue, StateFormat } from './types';

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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run test/requestBuilder.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 6: Lint and commit**

```bash
npm run lint:fix && npm run lint
git add nodes/TypeSafeAi/constants.ts nodes/TypeSafeAi/types.ts nodes/TypeSafeAi/requestBuilder.ts test/requestBuilder.test.ts
git commit -m "feat: add API types and state parsing

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Question building and output shaping

**Files:**
- Modify: `nodes/TypeSafeAi/requestBuilder.ts`
- Modify: `test/requestBuilder.test.ts`

**Interfaces:**
- Consumes: `types.ts` from Task 3.
- Produces (all exported from `requestBuilder.ts`):
  - `buildQuestion(spec: QuestionSpec, label?: string): Question`
  - `fromFormEntry(raw: RawFormQuestion): QuestionSpec & { id: string }`
  - `buildFormQuestions(entries: Array<QuestionSpec & { id: string }>): Record<string, Question>`
  - `parseQuestionsJson(raw: unknown): Record<string, Question>`
  - `resolveModel(model: unknown): string`
  - `SINGLE_QUESTION_ID = 'answer'`
  - `shapeOutput(operation: QuestionOperation, response: SystemOneResponse, simplify: boolean): IDataObject`
  - `shapeModels(response: ModelsResponse): IDataObject[]`

- [ ] **Step 1: Append failing tests**

Append to `test/requestBuilder.test.ts` (extend the import line to include the new names):

```ts
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
			"Add at least one entry to 'Options' for a Choice question",
		);
	});

	it('rejects a choice option with an empty key', () => {
		expect(() =>
			buildQuestion({ type: 'choice', instructions: 'Q', choiceOptions: [{ option: ' ' }] }),
		).toThrow("Every entry in 'Options' needs a non-empty 'Option' value");
	});

	it('rejects duplicate choice options', () => {
		expect(() =>
			buildQuestion({
				type: 'choice',
				instructions: 'Q',
				choiceOptions: [{ option: 'a' }, { option: 'a' }],
			}),
		).toThrow("'Options' contains the duplicate option 'a'");
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
				trueMeans: 't',
				falseMeans: 'f',
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
		).toThrow("Question 'dept': Add at least one entry to 'Options' for a Choice question");
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/requestBuilder.test.ts`
Expected: FAIL — `buildQuestion` etc. are not exported.

- [ ] **Step 3: Implement the builders and shapers**

Replace the import at the top of `nodes/TypeSafeAi/requestBuilder.ts` and append the following (keep `parseState` and its helpers from Task 3):

```ts
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
		throw new Error(`${label}Add at least one entry to 'Options' for a Choice question`);
	}
	const criteria: Record<string, string | null> = {};
	for (const entry of entries) {
		if (!nonBlank(entry.option)) {
			throw new Error(`${label}Every entry in 'Options' needs a non-empty 'Option' value`);
		}
		const key = entry.option.trim();
		if (key in criteria) {
			throw new Error(`${label}'Options' contains the duplicate option '${key}'`);
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
		trueMeans: raw.trueMeans,
		falseMeans: raw.falseMeans,
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
```

Note: `parseState` (Task 3) must keep using `JsonValue`/`StateFormat` from the merged import above — delete the old import line.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run`
Expected: PASS, all tests green.

- [ ] **Step 5: Lint**

```bash
npm run lint:fix && npm run lint
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add nodes/TypeSafeAi/requestBuilder.ts test/requestBuilder.test.ts
git commit -m "feat: build TypeSafe questions from node parameters and shape output

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Error mapping helpers

**Files:**
- Create: `nodes/TypeSafeAi/errors.ts`
- Create: `test/errors.test.ts`

**Interfaces:**
- Consumes: `n8n-workflow` `NodeApiError`, `NodeOperationError`, `INode`, `JsonObject`.
- Produces:
  - `getHttpStatus(error: unknown): number | undefined`
  - `getApiErrorDetail(error: unknown): string | undefined`
  - `describeApiError(status: number | undefined, detail: string | undefined): { message: string; description?: string } | undefined`
  - `toNodeError(node: INode, error: unknown, itemIndex: number): NodeApiError | NodeOperationError`

- [ ] **Step 1: Write the failing tests**

`test/errors.test.ts`:

```ts
import type { INode } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import {
	describeApiError,
	getApiErrorDetail,
	getHttpStatus,
	toNodeError,
} from '../nodes/TypeSafeAi/errors';

const node: INode = {
	id: '1',
	name: 'TypeSafe AI',
	type: 'n8n-nodes-typesafe-ai.typeSafeAi',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};

describe('getHttpStatus', () => {
	it('reads httpCode from a NodeApiError-like object', () => {
		expect(getHttpStatus({ httpCode: '429' })).toBe(429);
	});

	it('reads response.status from an axios-like error', () => {
		expect(getHttpStatus({ response: { status: 422 } })).toBe(422);
	});

	it('reads statusCode', () => {
		expect(getHttpStatus({ statusCode: 401 })).toBe(401);
	});

	it('reads a nested cause', () => {
		expect(getHttpStatus({ cause: { response: { status: 529 } } })).toBe(529);
	});

	it('returns undefined when nothing matches', () => {
		expect(getHttpStatus(new Error('boom'))).toBeUndefined();
		expect(getHttpStatus(null)).toBeUndefined();
	});
});

describe('getApiErrorDetail', () => {
	it('reads a string detail from the response body', () => {
		expect(getApiErrorDetail({ response: { data: { detail: 'questions.x.type is invalid' } } })).toBe(
			'questions.x.type is invalid',
		);
	});

	it('stringifies a structured detail', () => {
		expect(
			getApiErrorDetail({ response: { data: { detail: [{ loc: ['body', 'state'], msg: 'required' }] } } }),
		).toBe('[{"loc":["body","state"],"msg":"required"}]');
	});

	it('falls back to error/message fields and the NodeApiError description', () => {
		expect(getApiErrorDetail({ response: { data: { error: 'bad' } } })).toBe('bad');
		expect(getApiErrorDetail({ response: { data: { message: 'worse' } } })).toBe('worse');
		expect(getApiErrorDetail({ description: 'from n8n' })).toBe('from n8n');
	});

	it('returns undefined when there is no body', () => {
		expect(getApiErrorDetail(new Error('x'))).toBeUndefined();
	});
});

describe('describeApiError', () => {
	it('explains 401', () => {
		expect(describeApiError(401, undefined)).toEqual({
			message: 'TypeSafe AI rejected the API key',
			description: "Check the API key in the 'TypeSafe AI API' credential",
		});
	});

	it('passes the API detail through for 422', () => {
		expect(describeApiError(422, 'state is required')).toEqual({
			message: 'TypeSafe AI could not validate the request',
			description: 'state is required',
		});
	});

	it('explains 429 and 529 with the retry hint', () => {
		const hint = "Enable 'Retry On Fail' in the node settings with a wait of at least 1 second";
		expect(describeApiError(429, undefined)).toEqual({
			message: 'TypeSafe AI is rate limiting requests',
			description: hint,
		});
		expect(describeApiError(529, undefined)).toEqual({
			message: 'TypeSafe AI is temporarily overloaded',
			description: hint,
		});
	});

	it('returns undefined for other statuses', () => {
		expect(describeApiError(500, undefined)).toBeUndefined();
		expect(describeApiError(undefined, undefined)).toBeUndefined();
	});
});

describe('toNodeError', () => {
	it('wraps HTTP errors in NodeApiError with the friendly message and item index', () => {
		const error = toNodeError(node, { response: { status: 401, data: {} } }, 3);
		expect(error).toBeInstanceOf(NodeApiError);
		expect(error.message).toBe('TypeSafe AI rejected the API key');
		expect(error.context.itemIndex).toBe(3);
	});

	it('keeps an existing NodeApiError but sets the item index', () => {
		const original = new NodeApiError(node, { message: 'x' }, { httpCode: '500' });
		const error = toNodeError(node, original, 2);
		expect(error).toBe(original);
		expect(error.context.itemIndex).toBe(2);
	});

	it('re-describes an existing NodeApiError with a known status', () => {
		const original = new NodeApiError(node, { message: 'x' }, { httpCode: '429' });
		const error = toNodeError(node, original, 0);
		expect(error).toBeInstanceOf(NodeApiError);
		expect(error.message).toBe('TypeSafe AI is rate limiting requests');
	});

	it('wraps plain errors in NodeOperationError', () => {
		const error = toNodeError(node, new Error("'State' cannot be empty"), 1);
		expect(error).toBeInstanceOf(NodeOperationError);
		expect(error.message).toBe("'State' cannot be empty");
		expect(error.context.itemIndex).toBe(1);
	});

	it('keeps an existing NodeOperationError', () => {
		const original = new NodeOperationError(node, 'already wrapped');
		expect(toNodeError(node, original, 4)).toBe(original);
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/errors.test.ts`
Expected: FAIL — module `../nodes/TypeSafeAi/errors` not found.

- [ ] **Step 3: Implement `errors.ts`**

`nodes/TypeSafeAi/errors.ts`:

```ts
import type { INode, JsonObject } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

type Loose = Record<string, unknown>;

function asObject(value: unknown): Loose | undefined {
	return typeof value === 'object' && value !== null ? (value as Loose) : undefined;
}

function toStatus(value: unknown): number | undefined {
	const n = typeof value === 'string' ? Number(value) : value;
	return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Best-effort HTTP status from NodeApiError, axios errors, or wrapped causes. */
export function getHttpStatus(error: unknown): number | undefined {
	const obj = asObject(error);
	if (!obj) return undefined;
	return (
		toStatus(obj.httpCode) ??
		toStatus(asObject(obj.response)?.status) ??
		toStatus(obj.statusCode) ??
		(obj.cause ? getHttpStatus(obj.cause) : undefined)
	);
}

/** Best-effort human-readable detail from the API error body. */
export function getApiErrorDetail(error: unknown): string | undefined {
	const obj = asObject(error);
	if (!obj) return undefined;
	const body = asObject(asObject(obj.response)?.data);
	const candidate = body?.detail ?? body?.error ?? body?.message ?? obj.description;
	if (candidate === undefined || candidate === null) {
		return obj.cause ? getApiErrorDetail(obj.cause) : undefined;
	}
	return typeof candidate === 'string' ? candidate : JSON.stringify(candidate);
}

const RETRY_HINT = "Enable 'Retry On Fail' in the node settings with a wait of at least 1 second";

export function describeApiError(
	status: number | undefined,
	detail: string | undefined,
): { message: string; description?: string } | undefined {
	switch (status) {
		case 401:
			return {
				message: 'TypeSafe AI rejected the API key',
				description: "Check the API key in the 'TypeSafe AI API' credential",
			};
		case 422:
			return {
				message: 'TypeSafe AI could not validate the request',
				description: detail ?? 'The request body failed validation',
			};
		case 429:
			return { message: 'TypeSafe AI is rate limiting requests', description: RETRY_HINT };
		case 529:
			return { message: 'TypeSafe AI is temporarily overloaded', description: RETRY_HINT };
		default:
			return undefined;
	}
}

/**
 * Convert whatever `execute()` caught into the error n8n should surface.
 * HTTP failures become NodeApiError (with friendlier text for known statuses);
 * validation/other failures become NodeOperationError.
 */
export function toNodeError(
	node: INode,
	error: unknown,
	itemIndex: number,
): NodeApiError | NodeOperationError {
	const status = getHttpStatus(error);
	const friendly = describeApiError(status, getApiErrorDetail(error));

	if (error instanceof NodeApiError) {
		if (friendly) {
			return new NodeApiError(node, error as unknown as JsonObject, {
				...friendly,
				httpCode: status !== undefined ? String(status) : undefined,
				itemIndex,
			});
		}
		error.context.itemIndex = itemIndex;
		return error;
	}

	if (error instanceof NodeOperationError) {
		error.context.itemIndex = itemIndex;
		return error;
	}

	if (status !== undefined) {
		return new NodeApiError(node, error as JsonObject, {
			...friendly,
			httpCode: String(status),
			itemIndex,
		});
	}

	return new NodeOperationError(node, error as Error, { itemIndex });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run test/errors.test.ts`
Expected: PASS. If `error.context` is typed as possibly undefined and TypeScript in vitest complains, it is runtime-fine (NodeError always initialises `context`); for the assertions use `expect(error.context?.itemIndex)`.

- [ ] **Step 5: Lint and commit**

```bash
npm run lint:fix && npm run lint
git add nodes/TypeSafeAi/errors.ts test/errors.test.ts
git commit -m "feat: map TypeSafe API failures to friendly n8n errors

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Node properties, node class, and registration

**Files:**
- Create: `nodes/TypeSafeAi/properties.ts`
- Create: `nodes/TypeSafeAi/TypeSafeAi.node.ts`
- Create: `nodes/TypeSafeAi/TypeSafeAi.node.json`
- Delete: `nodes/Example/` (all four files)
- Modify: `package.json` (`n8n.nodes`)

**Interfaces:**
- Consumes: `requestBuilder.ts` (`parseState`, `buildQuestion`, `fromFormEntry`, `buildFormQuestions`, `parseQuestionsJson`, `resolveModel`, `shapeOutput`, `shapeModels`, `SINGLE_QUESTION_ID`), `errors.ts` (`toNodeError`), `constants.ts`, `types.ts`, credential `typeSafeAiApi`.
- Produces: node type `n8n-nodes-typesafe-ai.typeSafeAi`.

Parameter names used by `execute()` (must match `properties.ts` exactly): `resource`, `operation`, `state`, `instructions`, `noulCriteria` (collection: `trueMeans`, `falseMeans`), `choiceOptions` (fixedCollection group `values`: `option`, `description`), `scoreLevels` (fixedCollection group `values`: `level`), `questionsInput` (`form`|`json`), `questions` (fixedCollection group `values`), `questionsJson`, `options` (collection: `model`, `simplify`, `stateFormat`).

- [ ] **Step 1: Write `properties.ts`**

```ts
import type { INodeProperties } from 'n8n-workflow';

import { DEFAULT_MODEL } from './constants';

const QUESTION_OPS = ['askChoice', 'askNoul', 'askScore', 'evaluate'];

const choiceOptionsProperty = (displayOptions: INodeProperties['displayOptions']): INodeProperties => ({
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

const scoreLevelsProperty = (displayOptions: INodeProperties['displayOptions']): INodeProperties => ({
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
				description: 'Pick one option from a set you define and get the full probability distribution',
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
				action: 'Ask a yes/no (noul) question',
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
			{ name: 'JSON', value: 'json', description: 'Provide the questions map exactly as the API expects it' },
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
						displayName: 'True Means',
						name: 'trueMeans',
						type: 'string',
						default: '',
						description: 'What a yes (value near 1) means',
						displayOptions: { show: { type: ['noul'] } },
					},
					{
						displayName: 'False Means',
						name: 'falseMeans',
						type: 'string',
						default: '',
						description: 'What a no (value near 0) means',
						displayOptions: { show: { type: ['noul'] } },
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
		default: '{\n  "is_urgent": {\n    "type": "noul",\n    "instructions": "Does this convey urgency?"\n  }\n}',
		required: true,
		description: 'A JSON object mapping question IDs to question objects, as documented at docs.typesafe.ai/api',
		displayOptions: {
			show: { resource: ['question'], operation: ['evaluate'], questionsInput: ['json'] },
		},
	},

	// ---- Options (all question operations) ----
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add option',
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
					'Model name or alias, pin a versioned ID such as jev-1.13.0 if you have tuned thresholds against it',
			},
			{
				displayName: 'Simplify',
				name: 'simplify',
				type: 'boolean',
				default: true,
				description: 'Whether to return a simplified version of the response instead of the raw data',
			},
			{
				displayName: 'State Format',
				name: 'stateFormat',
				type: 'options',
				options: [
					{ name: 'Auto', value: 'auto', description: 'Send as JSON if the state parses as a JSON object or array, otherwise as text' },
					{ name: 'JSON', value: 'json', description: 'Always parse the state as JSON and fail if it is invalid' },
					{ name: 'Text', value: 'text', description: 'Always send the state as plain text' },
				],
				default: 'auto',
				description: 'How to interpret the State field',
			},
		],
	},
];
```

- [ ] **Step 2: Write the node class**

`nodes/TypeSafeAi/TypeSafeAi.node.ts`:

```ts
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
```

- [ ] **Step 3: Write the codex file**

`nodes/TypeSafeAi/TypeSafeAi.node.json`:

```json
{
	"node": "n8n-nodes-typesafe-ai.typeSafeAi",
	"nodeVersion": "1.0",
	"codexVersion": "1.0",
	"categories": ["AI"],
	"resources": {
		"credentialDocumentation": [
			{
				"url": "https://github.com/DomMonte/n8n-nodes-typesafe-ai#credentials"
			}
		],
		"primaryDocumentation": [
			{
				"url": "https://docs.typesafe.ai"
			}
		]
	}
}
```

- [ ] **Step 4: Remove the Example node and register TypeSafeAi**

```bash
git rm -r -q nodes/Example
```

In `package.json`, set:

```json
		"nodes": [
			"dist/nodes/TypeSafeAi/TypeSafeAi.node.js"
		]
```

- [ ] **Step 5: Lint, fix, build, test**

```bash
npm run lint:fix
npm run lint
npm run build
npm test
ls dist/nodes/TypeSafeAi
```

Expected: lint clean, build `✓ Build successful`, all tests pass, `dist/nodes/TypeSafeAi/` contains `TypeSafeAi.node.js`, `TypeSafeAi.node.json`, both SVGs, and the helper `.js` files.

Likely lint findings and their fixes (do **not** edit `eslint.config.mjs`):
- `node-param-options-type-unsorted-items` / `node-param-collection-type-unsorted-items`: reorder the flagged `options` array alphabetically by `name`.
- `node-param-description-excess-final-period` / `-lowercase-first-char` / `-untrimmed`: adjust the flagged string.
- `node-param-display-name-wrong-for-simplify` or `-description-wrong-for-simplify`: the Simplify parameter must be exactly `displayName: 'Simplify'` with description `'Whether to return a simplified version of the response instead of the raw data'`.
- `node-param-operation-option-action-wrong-for-get-many`: action must be `'Get many models'`.
- `no-unused-vars` for an unused import: remove it.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add TypeSafe AI node with question and model operations

Replaces the template Example node.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: README, changelog, and housekeeping

**Files:**
- Modify: `README.md` (replace template content)
- Modify: `CHANGELOG.md`
- Keep: `.agents/`, `AGENTS.md`, `CLAUDE.md` from the template (not published because `files` is `["dist"]`; useful guidance for future edits).

- [ ] **Step 1: Write README.md**

```markdown
# n8n-nodes-typesafe-ai

An [n8n](https://n8n.io) community node for the [TypeSafe AI](https://typesafe.ai) System One API.

TypeSafe's System One models (Jev) answer small, typed questions about your data — yes/no probabilities, one-of-N choices, and scores against ordered levels — with calibrated probabilities your workflow can branch on directly. No prompt engineering, no free-text parsing.

- [Installation](#installation)
- [Credentials](#credentials)
- [Operations](#operations)
- [Output reference](#output-reference)
- [Rate limits and retries](#rate-limits-and-retries)
- [Resources](#resources)

## Installation

Follow the [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) and install `n8n-nodes-typesafe-ai`.

## Credentials

Create a **TypeSafe AI API** credential with your API key from the [TypeSafe dashboard](https://typesafe.ai). The key is sent as a `Authorization: Bearer` header. Use the credential's **Test** button to confirm it works (it calls `GET /v1/models`).

## Operations

All question operations share these fields:

| Field | Description |
|---|---|
| **State** | The content to evaluate. Plain text, or a JSON object/array (a chat log, a record, your app's current state). Expressions such as `{{ $json }}` that resolve to an object are sent as JSON. |
| **Instructions** | The question the model should answer about the state. |
| **Options → Model** | `jev-latest` by default. Pin a versioned ID such as `jev-1.13.0` if you have tuned thresholds against it. |
| **Options → State Format** | `Auto` (default) sends JSON when the state parses as an object/array, otherwise text. `Text` and `JSON` force one behaviour. |
| **Options → Simplify** | On by default. Turn off to receive the raw API response body. |

### Question → Ask Yes/No

Returns the probability that the answer is yes (a *noul*).

- **Criteria** (optional): *True Means* / *False Means* descriptions.

Example — State: `Help! My payouts have been failing for 3 days.` Instructions: `Does this convey urgency?`

```json
{ "noul": 0.92, "model": "jev-1.13.0", "usage": { "input_tokens": 312, "output_tokens": 48 } }
```

### Question → Ask Choice

Picks one option from a set you define and returns the full probability distribution plus a confidence value.

- **Options**: one row per option (`Option` key + optional `Description` rubric).

Example — Instructions: `Which team should handle this?` Options: `billing`, `technical`, `sales`

```json
{
  "choice": "technical",
  "probabilities": { "billing": 0.08, "technical": 0.85, "sales": 0.07 },
  "confidence": 0.82,
  "model": "jev-1.13.0",
  "usage": { "input_tokens": 312, "output_tokens": 48 }
}
```

### Question → Ask Score

Rates the state against ordered levels (lowest first) and returns a probability-weighted score that can land between levels.

- **Levels**: at least two, ordered from lowest to highest.

Example — Instructions: `How frustrated is the customer?` Levels: `Calm`, `Frustrated`, `Very angry`

```json
{
  "score": 1.6,
  "legend": { "0": "Calm", "1": "Frustrated", "2": "Very angry" },
  "probabilities": { "0": 0.05, "1": 0.3, "2": 0.65 },
  "confidence": 0.78,
  "model": "jev-1.13.0",
  "usage": { "input_tokens": 312, "output_tokens": 48 }
}
```

### Question → Evaluate Questions

Asks several questions about the same state in **one** request — the cheapest and fastest way to use TypeSafe. Define questions with the form (each with an ID, type, instructions and criteria) or paste the `questions` map as JSON exactly as described in the [API reference](https://docs.typesafe.ai/api).

```json
{
  "answers": {
    "is_urgent": { "type": "noul", "noul": 0.92 },
    "department": { "type": "choice", "choice": "technical", "probabilities": { "...": 0 }, "confidence": 0.82 }
  },
  "model": "jev-1.13.0",
  "usage": { "input_tokens": 340, "output_tokens": 96 }
}
```

### Model → Get Many

Lists the model names and aliases your account can use. One item per model: `{ name, description, release_date }`.

## Output reference

| Operation | Simplified output |
|---|---|
| Ask Yes/No | `noul`, `model`, `usage` |
| Ask Choice | `choice`, `probabilities`, `confidence`, `model`, `usage` |
| Ask Score | `score`, `legend`, `probabilities`, `confidence`, `model`, `usage` |
| Evaluate Questions | `answers` (keyed by question ID, each with its `type`), `model`, `usage` |
| Model → Get Many | `name`, `description`, `release_date` |

With **Simplify** off, every question operation returns the raw body: `{ "model", "answers": { "answer": { ... } }, "usage" }`.

`confidence` (Choice and Score) summarises how concentrated the probability distribution is; see [Confidence](https://docs.typesafe.ai/confidence). A noul near 0.5 means yes and no are about equally likely.

## Rate limits and retries

TypeSafe returns `429 Too Many Requests` or `529 Overloaded` when you exceed your limits or the service is busy. This node does not retry on its own. Enable **Retry On Fail** in the node's settings (with a wait of at least 1 second) so n8n backs off and retries.

## AI Agent tool

The node is marked usable as a tool, so an AI Agent can call it directly. Mark any field with *Let the model define this parameter* to have the agent fill it in.

## Resources

- [TypeSafe documentation](https://docs.typesafe.ai)
- [HTTP API reference](https://docs.typesafe.ai/api)
- [Question primitives](https://docs.typesafe.ai/primitives)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)

## License

[MIT](LICENSE.md)
```

- [ ] **Step 2: Update CHANGELOG.md**

Replace its contents with:

```markdown
# Changelog

## 0.1.0

- Initial release: TypeSafe AI credential; Question operations Ask Yes/No, Ask Choice, Ask Score, Evaluate Questions; Model → Get Many.
```

- [ ] **Step 3: Ensure a LICENSE file exists**

```bash
ls LICENSE* 2>/dev/null || cat > LICENSE.md <<'EOF'
MIT License

Copyright (c) 2026 DomMonte

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF
```

If the file that exists is named `LICENSE` (no extension), change the README link to `LICENSE`.

- [ ] **Step 4: Lint and commit**

```bash
npm run lint
git add README.md CHANGELOG.md LICENSE*
git commit -m "docs: write README and changelog for 0.1.0

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Verification — package scan, live smoke test, dev instance

**Files:**
- Create (scratchpad only, not committed): `<scratchpad>/smoke.mjs`

**Interfaces:**
- Consumes: `dist/nodes/TypeSafeAi/TypeSafeAi.node.js` from Task 6, the user's API key.

- [ ] **Step 1: Run the community package scanner**

```bash
npm run build
npx --yes @n8n/scan-community-package n8n-nodes-typesafe-ai || true
```

The scanner expects a published package; if it reports "not found on npm", instead confirm the local equivalent passes: `npm run lint` and `npm pack --dry-run` (the tarball must contain only `dist/**`, `README.md`, `LICENSE*`, `package.json`, `CHANGELOG.md`).

- [ ] **Step 2: Ask the user for the API key and run the live smoke test**

Ask the user to write their API key, on one line, to `<scratchpad>/.key` (the session scratchpad directory named in the system prompt). The file lives outside the repo and is deleted in Step 3; never copy the key into the repo or a commit.

Create `<scratchpad>/smoke.mjs`:

```js
// Throwaway end-to-end check: drives the compiled node with a fake n8n context.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const repo = '/Users/domenic/Developer/Typesafe-n8n';
const { TypeSafeAi } = require(path.join(repo, 'dist/nodes/TypeSafeAi/TypeSafeAi.node.js'));
const apiKey = readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), '.key'), 'utf8').trim();

function makeContext(params) {
	return {
		getInputData: () => [{ json: {} }],
		getNodeParameter: (name, _i, fallback) => (name in params ? params[name] : fallback),
		getNode: () => ({ name: 'TypeSafe AI', type: 'n8n-nodes-typesafe-ai.typeSafeAi', typeVersion: 1, id: '1', position: [0, 0], parameters: {} }),
		continueOnFail: () => false,
		helpers: {
			async httpRequestWithAuthentication(_cred, opts) {
				const res = await fetch(opts.url, {
					method: opts.method,
					headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
					body: opts.body ? JSON.stringify(opts.body) : undefined,
				});
				const data = await res.json().catch(() => ({}));
				if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { response: { status: res.status, data } });
				return data;
			},
		},
	};
}

const node = new TypeSafeAi();
const state = 'Help! My payouts have been failing for 3 days.';

const cases = {
	askNoul: { resource: 'question', operation: 'askNoul', state, instructions: 'Does this convey urgency?', noulCriteria: { trueMeans: 'Explicitly time-sensitive' }, options: {} },
	askChoice: { resource: 'question', operation: 'askChoice', state, instructions: 'Which team should handle this?', choiceOptions: { values: [{ option: 'billing', description: 'Payments, invoicing, refunds' }, { option: 'technical', description: 'Bugs, outages' }, { option: 'sales' }] }, options: {} },
	askScore: { resource: 'question', operation: 'askScore', state, instructions: 'How frustrated is the customer?', scoreLevels: { values: [{ level: 'Calm' }, { level: 'Frustrated' }, { level: 'Very angry' }] }, options: {} },
	evaluateForm: { resource: 'question', operation: 'evaluate', state, questionsInput: 'form', questions: { values: [{ id: 'is_urgent', type: 'noul', instructions: 'Is this urgent?' }, { id: 'mood', type: 'score', instructions: 'How angry?', scoreLevels: { values: [{ level: 'Calm' }, { level: 'Angry' }] } }] }, options: {} },
	evaluateJson: { resource: 'question', operation: 'evaluate', state: '{"ticket":"' + state + '"}', questionsInput: 'json', questionsJson: JSON.stringify({ dept: { type: 'choice', instructions: 'Which team?', criteria: { billing: null, technical: null } } }), options: { simplify: false } },
	models: { resource: 'model', operation: 'getAll' },
	badKey: null,
};

for (const [name, params] of Object.entries(cases)) {
	try {
		if (name === 'badKey') {
			const ctx = makeContext(cases.askNoul);
			// simulate 401 by sending an invalid key
			ctx.helpers.httpRequestWithAuthentication = async (_c, o) => {
				const res = await fetch(o.url, { method: o.method, headers: { Authorization: 'Bearer invalid', 'Content-Type': 'application/json' }, body: JSON.stringify(o.body) });
				const data = await res.json().catch(() => ({}));
				if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { response: { status: res.status, data } });
				return data;
			};
			await node.execute.call(ctx);
			console.log(name, 'UNEXPECTED SUCCESS');
			continue;
		}
		const out = await node.execute.call(makeContext(params));
		console.log(name, JSON.stringify(out[0].map((x) => x.json), null, 2));
	} catch (err) {
		console.log(name, 'ERROR', err.constructor?.name, err.message, err.description ?? '');
	}
}
```

Run:

```bash
cd /Users/domenic/Developer/Typesafe-n8n && npm run build && node "<scratchpad>/smoke.mjs"
```

Expected:
- `askNoul` → `{ noul: <0..1>, model: 'jev-1.13.0' (or similar), usage }`
- `askChoice` → `choice` is one of billing/technical/sales, probabilities sum ≈ 1, `confidence` present
- `askScore` → `score` between 0 and 2, `legend` has 3 entries
- `evaluateForm` → `answers.is_urgent.type === 'noul'`, `answers.mood.type === 'score'`
- `evaluateJson` → raw body with `answers.dept`
- `models` → at least one item with `name`
- `badKey` → `ERROR NodeApiError TypeSafe AI rejected the API key Check the API key in the 'TypeSafe AI API' credential`

Paste the actual output into the task report. If any case fails, fix the code, add a unit test that reproduces the failure, and re-run both `npm test` and the smoke script.

- [ ] **Step 3: Delete the key file**

```bash
rm -f "<scratchpad>/.key"
```

- [ ] **Step 4: Verify in a real n8n instance**

Requires Docker or Podman running.

```bash
npm run dev
```

Ask the user to open http://localhost:5678, add a **TypeSafe AI** node, create the credential and press **Test** (expect success), run **Ask Choice** with the README example, and confirm the node appears in the AI Agent tool picker. Stop the dev server afterwards.

If Docker is unavailable, report that this step was skipped and why.

- [ ] **Step 5: Final commit of any fixes**

```bash
npm run lint && npm test && npm run build
git status --short
git add -A
git commit -m "fix: address issues found during live verification

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>" || echo "nothing to commit"
```

---

### Task 9: Publishing prerequisites (documentation only — no publish)

**Files:**
- None created. This task produces a checklist for the user.

- [ ] **Step 1: Report the publishing steps to the user**

Tell the user, in the final report:

1. Create the GitHub repo `DomMonte/n8n-nodes-typesafe-ai` (confirm the owner name), `git remote add origin ...`, `git push -u origin main`.
2. On npmjs.com, either configure a Trusted Publisher (repo owner, repo name, workflow `publish.yml`) or add an `NPM_TOKEN` repository secret — see the comments at the top of `.github/workflows/publish.yml`.
3. Run `npm run release` locally; it lints, builds, bumps the version, tags, and pushes — the tag triggers the provenance publish.
4. Submit at https://creators.n8n.io/nodes for verification once the package is on npm.
