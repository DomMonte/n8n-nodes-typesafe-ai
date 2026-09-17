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
		expect(
			getApiErrorDetail({ response: { data: { detail: 'questions.x.type is invalid' } } }),
		).toBe('questions.x.type is invalid');
	});

	it('stringifies a structured detail', () => {
		expect(
			getApiErrorDetail({
				response: { data: { detail: [{ loc: ['body', 'state'], msg: 'required' }] } },
			}),
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
