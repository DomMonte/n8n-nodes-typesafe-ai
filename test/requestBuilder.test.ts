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
