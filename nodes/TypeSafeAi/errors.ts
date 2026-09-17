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
	// n8n's NodeApiError keeps the HTTP body under context.data; raw axios errors under response.data
	const body = asObject(asObject(obj.response)?.data) ?? asObject(asObject(obj.context)?.data);
	const fromBody = body?.detail ?? body?.error ?? body?.message;
	if (fromBody !== undefined && fromBody !== null) {
		return typeof fromBody === 'string' ? fromBody : JSON.stringify(fromBody);
	}
	const fromCause = obj.cause ? getApiErrorDetail(obj.cause) : undefined;
	if (fromCause !== undefined) return fromCause;
	return typeof obj.description === 'string' ? obj.description : undefined;
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
		// NodeApiError's constructor returns the original instance unchanged
		// when handed an existing NodeApiError (see n8n-workflow's
		// `errorResponse instanceof NodeApiError` short-circuit), so a friendlier
		// message/description must be applied by mutating the instance directly.
		if (friendly) {
			error.message = friendly.message;
			error.description = friendly.description;
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
