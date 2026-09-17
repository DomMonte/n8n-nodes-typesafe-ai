# n8n-nodes-typesafe-ai

An [n8n](https://n8n.io) community node for the [TypeSafe AI](https://typesafe.ai) System One API.

TypeSafe's System One models (Jev) answer small, typed questions about your data — yes/no probabilities, one-of-N choices, and scores against ordered levels — with calibrated probabilities your workflow can branch on directly. No prompt engineering, no free-text parsing.

- [Installation](#installation)
- [Credentials](#credentials)
- [Operations](#operations)
- [Output reference](#output-reference)
- [Rate limits and retries](#rate-limits-and-retries)
- [AI Agent tool](#ai-agent-tool)
- [Resources](#resources)

## Installation

The package is published on npm as `n8n-nodes-typesafe-ai`. Both methods below follow n8n's [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation-and-management/).

### Install from the n8n GUI (recommended)

Only users with an Owner or Admin role can install community nodes on a self-hosted instance.

1. Go to **Settings** > **Community Nodes**.
2. Select **Install**.
3. Enter `n8n-nodes-typesafe-ai` in **Enter npm package name**. To pin a version, append it, for example `n8n-nodes-typesafe-ai@0.1.0`.
4. Agree to the [risks](https://docs.n8n.io/integrations/community-nodes/risks/) of using community nodes: select **I understand the risks of installing unverified code from a public source**.
5. Select **Install**. n8n installs the node and returns to the **Community Nodes** list.

The **TypeSafe AI** node then appears in the node panel. Upgrades, downgrades and uninstalls are managed from the same **Settings** > **Community Nodes** page — see [GUI installation](https://docs.n8n.io/integrations/community-nodes/installation-and-management/gui-installation/).

### Manual installation (self-hosted)

Use this if your instance runs in queue mode or you prefer installing from the shell.

Access your n8n shell (for Docker):

```sh
docker exec -it n8n sh
```

Create `~/.n8n/nodes` if it doesn't already exist, navigate into it, and install the package:

```sh
mkdir -p ~/.n8n/nodes
cd ~/.n8n/nodes
npm i n8n-nodes-typesafe-ai
```

Then restart n8n. To upgrade later, run `npm update n8n-nodes-typesafe-ai` in the same directory and restart; to remove it, run `npm uninstall n8n-nodes-typesafe-ai`. Full details: [Manual installation](https://docs.n8n.io/integrations/community-nodes/installation-and-management/manual-installation/).

n8n Cloud users can install community nodes only after the package is verified by n8n; until then this package is available on self-hosted instances only.

## Credentials

Create a **TypeSafe AI API** credential with your API key from the [TypeSafe dashboard](https://typesafe.ai). The key is sent as an `Authorization: Bearer` header. Use the credential's **Test** button to confirm it works (it calls `GET /v1/models`).

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

- **Choices**: one row per choice (`Value` key + optional `Description` rubric).

Example — Instructions: `Which team should handle this?` Choices: `billing`, `technical`, `sales`

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

- **Levels**: at least two, each a short description, ordered from lowest to highest.

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

Asks several questions about the same state in **one** request — the cheapest and fastest way to use TypeSafe. Define questions with the form (each with an ID, type, instructions and criteria) or paste the `questions` map as JSON exactly as described in the [API reference](https://docs.typesafe.ai/api). For yes/no questions the optional **Criteria** collection holds *True Means* / *False Means*, exactly as in Ask Yes/No.

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
