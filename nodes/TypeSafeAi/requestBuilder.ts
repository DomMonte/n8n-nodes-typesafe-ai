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
