# n8n Community Node for TypeSafe AI — Design

Date: 2026-09-17
Package: `n8n-nodes-typesafe-ai`
Status: approved design, pending implementation plan

## Goal

An n8n community node that lets workflows call the TypeSafe AI System One API
(`POST /v1/systemone`, `GET /v1/models`) with a native n8n UI, and that meets
n8n's verified-community-node requirements.

## Constraints (from n8n verification guidelines)

- No runtime dependencies. HTTP goes through `this.helpers.httpRequestWithAuthentication`.
  The `@typesafe-ai/sdk` package is NOT used.
- TypeScript, MIT licence, English UI/docs.
- No environment variable or filesystem access from node code. Base URL is a constant.
- Package name starts with `n8n-nodes-`; keyword `n8n-community-node-package`;
  `n8n.nodes` / `n8n.credentials` arrays in `package.json`.
- Published via GitHub Actions with provenance (`publish.yml` from n8n-nodes-starter).
- Must pass `npm run lint` and `npx @n8n/scan-community-package n8n-nodes-typesafe-ai`.
- Action node → programmatic style is permitted (chosen; see Approach).

## Approach

Programmatic node. A single `execute()` builds the request body from node
parameters using a small pure module (`requestBuilder.ts`) that is unit-tested
in isolation. Rationale over declarative routing: the transformations
(repeatable option/level lists → `criteria` maps, three primitives, form-vs-JSON
batch input, simplified output) would end up scattered across `preSend`/
`postReceive` hooks; one execute function is clearer and testable.

## Package layout

```
n8n-nodes-typesafe-ai/
├── credentials/TypeSafeAiApi.credentials.ts
├── nodes/TypeSafeAi/
│   ├── TypeSafeAi.node.ts          # INodeType: description + execute()
│   ├── TypeSafeAi.node.json        # codex metadata (categories, docs links)
│   ├── typesafe.svg                # node icon
│   ├── properties.ts               # INodeProperties[] (UI definition)
│   ├── requestBuilder.ts           # pure functions: params → body, response → output
│   ├── types.ts                    # Question / Answer / Response TS types
│   └── __tests__/requestBuilder.test.ts
├── .github/workflows/publish.yml   # provenance publish (from n8n-nodes-starter)
├── package.json
├── README.md
├── LICENSE (MIT)
├── tsconfig.json
└── eslint config (as shipped by the n8n-node template)
```

Scaffold with `npm create @n8n/node@latest` → programmatic template, then
replace the example node. Scripts: `build`, `dev` (Dockerised n8n on
localhost:5678), `lint`, `lint:fix`, `test`, `release`.

Constants: `BASE_URL = 'https://api.typesafe.ai'`, `DEFAULT_MODEL = 'jev-latest'`.

## Credential: `typeSafeAiApi`

- Display name: **TypeSafe AI API**
- Fields: `apiKey` (string, `typeOptions.password: true`, required)
- `authenticate`: generic, header `Authorization: Bearer {{$credentials.apiKey}}`
- `test`: `GET https://api.typesafe.ai/v1/models` (200 = valid)
- `documentationUrl`: `https://docs.typesafe.ai/api`

## Node: `typeSafeAi`

- Display name **TypeSafe AI**, `group: ['transform']`, `version: 1`,
  `usableAsAITool: true`, `subtitle: '={{ $parameter["operation"] + ": " + $parameter["resource"] }}'`,
  one input, one output, credential `typeSafeAiApi` required.
- Codex `.node.json`: categories `["AI", "Development"]`, subcategories `{ "AI": ["Miscellaneous", "Root Nodes"] }` (n8n's picker only lists AI-category nodes whose AI subcategories include "Root Nodes"), search aliases, docs links to
  `https://docs.typesafe.ai` and the package README.

### Resources and operations

| Resource | Operation value | Name | Action (sentence case) |
|---|---|---|---|
| `question` | `askNoul` | Ask Yes/No | Ask a yes/no (noul) question |
| `question` | `askChoice` | Ask Choice | Choose one option |
| `question` | `askScore` | Ask Score | Score against ordered levels |
| `question` | `evaluate` | Evaluate Questions | Evaluate many questions in one call |
| `model` | `getAll` | Get Many | List available models |

Default resource `question`, default operation `askChoice`.

### Parameters — Question resource (shared, in this order)

1. **State** (`state`, string, multiline, required, placeholder
   `e.g. {{ $json.message }}`). Description: "The content to evaluate. Plain
   text, or a JSON object/array for structured data such as chat logs or records."
2. **Instructions** (`instructions`, string, multiline, required). Hidden for
   `evaluate`. Description: "The question the model should answer about the state."
3. Primitive-specific criteria (below).
4. **Options** (`options`, collection, "Add option"):
   - **Model** (`model`, string, default `jev-latest`, placeholder `e.g. jev-1.13.0`).
     Description links the alias behaviour: "Model name or alias. Pin a versioned
     ID such as jev-1.13.0 if you have tuned thresholds against it."
   - **State Format** (`stateFormat`, options `auto` | `text` | `json`, default `auto`).
     `auto`: if the string parses as a JSON object or array it is sent as JSON,
     otherwise as text. `text`: always send the raw string. `json`: must parse;
     invalid JSON is a validation error.
   - **Simplify** (`simplify`, boolean, default `true`). "Whether to return a
     simplified version of the response instead of the raw API body."

### Ask Yes/No (`askNoul`)

- **Criteria** (`noulCriteria`, collection, optional): `trueMeans` ("True Means",
  string) and `falseMeans` ("False Means", string). Only included in the request
  when at least one is non-empty.

Request question: `{ type: 'noul', instructions, criteria? }`.

### Ask Choice (`askChoice`)

- **Options** (`choiceOptions`, fixedCollection, `multipleValues: true`, required,
  button "Add Option"): entries `option` (string, required, placeholder
  `e.g. billing`) and `description` (string, optional, placeholder
  `e.g. Payments, invoicing, refunds`).
- Validation: at least one option; option keys unique and non-empty.
- Blank description → `null` (per API).

Request question: `{ type: 'choice', instructions, criteria: { [option]: description|null } }`.

### Ask Score (`askScore`)

- **Levels** (`scoreLevels`, fixedCollection, `multipleValues: true`,
  `sortable: true`, required, button "Add Level"): entries `level` (string,
  required, placeholder `e.g. Calm`). Hint: "Ordered from lowest to highest."
- Validation: at least two non-empty levels.

Request question: `{ type: 'score', instructions, criteria: [level, ...] }`.

### Evaluate Questions (`evaluate`)

- **Questions Input** (`questionsInput`, options `form` | `json`, default `form`).
- Form mode: **Questions** (`questions`, fixedCollection, `multipleValues: true`,
  button "Add Question"). Each entry, in this order (`id`, `type`, `instructions`,
  `noulCriteria`, `choiceOptions`, `scoreLevels`):
  - `id` (Question ID, string, required, placeholder `e.g. is_urgent`)
  - `type` (options: Yes/No `noul`, Choice `choice`, Score `score`, default `noul`)
  - `instructions` (string, multiline, required)
  - `noulCriteria` (collection with `trueMeans` / `falseMeans`, shown when `type === noul`,
    optional — same shape as Ask Yes/No)
  - `choiceOptions` (fixedCollection as in Ask Choice; shown when `type === choice`)
  - `scoreLevels` (fixedCollection as in Ask Score; shown when `type === score`)
- JSON mode: **Questions (JSON)** (`questionsJson`, `type: 'json'`, required,
  default: a one-question noul example so the expected shape is visible). Must be a JSON object whose values are Question objects; passed
  through verbatim after a shallow check that each value has a `type` in
  {noul, choice, score} and an `instructions` field.
- Validation: at least one question; IDs unique and non-empty; per-type rules as above.

### Model › Get Many (`getAll`)

No parameters. `GET /v1/models`. Emits one item per model:
`{ name, description, release_date }`.

## Execution

- One API call per input item; `pairedItem: { item: i }` on every output.
- Single-question ops use the internal question id `answer`.
- Request: `httpRequestWithAuthentication.call(this, 'typeSafeAiApi', { method: 'POST',
  url: BASE_URL + '/v1/systemone', body: { state, model, questions }, json: true })`.
- `continueOnFail()` honoured: on error emit `{ json: { error: message }, pairedItem }`
  and continue; otherwise rethrow.
- No custom retry loop. README instructs users to enable n8n's built-in
  *Retry On Fail* for 429/529.

### `requestBuilder.ts` (pure, unit-tested)

```ts
parseState(raw: string, format: 'auto'|'text'|'json'): string | object | unknown[]
buildSingleQuestion(op: 'askNoul'|'askChoice'|'askScore', params): Question
buildQuestions(op, params): Record<string, Question>   // 'answer' for single ops
buildRequestBody(op, params): SystemOneRequest          // { state, model, questions }
shapeOutput(op, response, simplify): IDataObject
```

Validation failures throw a plain `Error` with a message that names the parameter
display name; `execute()` wraps it in `NodeOperationError` with `itemIndex`.

## Output shape

Simplify **on** (default):

| Operation | Output item |
|---|---|
| Ask Yes/No | `{ noul, model, usage }` |
| Ask Choice | `{ choice, probabilities, confidence, model, usage }` |
| Ask Score | `{ score, legend, probabilities, confidence, model, usage }` |
| Evaluate Questions | `{ answers, model, usage }` (answers keyed by question ID, each with its `type`) |
| Model › Get Many | one item per model: `{ name, description, release_date }` |

Simplify **off**: the raw API body verbatim (`{ model, answers: { answer: {...} }, usage }`).

## Error handling

- Validation → `NodeOperationError(this.getNode(), message, { itemIndex })`.
  Messages say what happened and how to fix it, naming the parameter, e.g.
  "Add at least two entries to 'Levels' for a Score question."
- HTTP → `NodeApiError(this.getNode(), error, { itemIndex, message, description })`
  with friendlier text per status:
  - 401: "TypeSafe AI rejected the API key. Check the credential."
  - 422: pass through the API's field detail from the response body.
  - 429 / 529: "TypeSafe AI is rate limiting or overloaded. Enable 'Retry On Fail'
    in the node settings with a wait of at least 1 second."
  - other: default n8n handling.

## Testing & verification

1. Unit tests (`requestBuilder.test.ts`, TDD): state parsing (auto/text/json,
   invalid JSON), each primitive's question building, blank choice description →
   null, validation errors (no options, <2 levels, duplicate IDs, bad JSON mode
   input), output shaping with simplify on/off for every op, model list shaping.
2. `npm run build`, `npm run lint`, `npx @n8n/scan-community-package`.
3. Live smoke script (scratchpad, not committed) against api.typesafe.ai using the
   user's key: all four question ops + list models.
4. `npm run dev` → verify UI, credential test button, and AI-tool exposure in a
   real n8n instance.

## README contents

Install (community nodes UI + npm), credential setup, one example per operation
with the resulting output, output reference table, rate-limit / Retry On Fail
note, model alias note, links to https://docs.typesafe.ai.

## Out of scope

- Trigger node (API has no events).
- Client-side retry/backoff (n8n Retry On Fail covers it).
- Bundling the official SDK (verification forbids runtime deps).
