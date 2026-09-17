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
