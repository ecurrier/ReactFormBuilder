import { retrieveEygaConfiguration, resolveEntitySetName } from "@utilities";
import type { EygaConfiguration } from "@utilities";
import { createRecord, retrieveRecord } from "@api";

export interface EygaApiContext {
	RegardingId?: string;
	RegardingLogicalName?: string;
	UserId?: string;
	ApiAction?: string;
}

export enum EygaApi {
	Documents = "Documents",
	Address = "Address",
	SamGov = "SAMGov",
}

export enum EygaApiEndpoint {
	UploadDocument = "Upload Document",
	DownloadDocument = "Download Document",
	DeleteDocument = "Delete Document",
	GetSASUrl = "Get SAS Url",
	SearchByTags = "Search By Tags",
	ValidateAddress = "Validate Address",
	GetSAMGovEntity = "Get SAM.gov Entity",
	GetSAMGovExclusion = "Get SAM.gov Exclusion",
}

interface ApiEndpointConfig {
	ApiName: string;
	Method: "GET" | "POST" | "DELETE" | "PATCH";
	Path: string;
	ContentType?: string;
	ProcessData?: boolean;
	ResponseType?: "json" | "blob";
}

export interface UploadDocumentRequest {
	FileName: string;
	DocumentFolder: string;
	RecordFolder: string;
	Tags: Record<string, any>;
	File: File;
}

export interface SearchByTagsRequest {
	Id: string;
	Folder: string;
	Status: string;
	ChildId?: string;
}

// Case-sensitive keys as expected by the EYGA API
export interface DocumentMetadata {
	name: string;
	fullName: string;
	tags: Record<string, any>;
}

const ApiEndpoints: Record<EygaApiEndpoint, ApiEndpointConfig> = {
	[EygaApiEndpoint.UploadDocument]: {
		ApiName: "Documents",
		Method: "POST",
		Path: "/upload",
		ContentType: "multipart/form-data",
		ProcessData: false,
	},
	[EygaApiEndpoint.DownloadDocument]: {
		ApiName: "Documents",
		Method: "POST",
		Path: "/download",
		ResponseType: "blob",
	},
	[EygaApiEndpoint.DeleteDocument]: {
		ApiName: "Documents",
		Method: "DELETE",
		Path: "/delete",
	},
	[EygaApiEndpoint.GetSASUrl]: {
		ApiName: "Documents",
		Method: "GET",
		Path: "/getsasurl",
	},
	[EygaApiEndpoint.SearchByTags]: {
		ApiName: "Documents",
		Method: "POST",
		Path: "/searchbytags",
	},
	[EygaApiEndpoint.ValidateAddress]: {
		ApiName: "Address",
		Method: "POST",
		Path: "/validate",
	},
	[EygaApiEndpoint.GetSAMGovEntity]: {
		ApiName: "SAMGov",
		Method: "GET",
		Path: "/entities",
	},
	[EygaApiEndpoint.GetSAMGovExclusion]: {
		ApiName: "SAMGov",
		Method: "GET",
		Path: "/exclusions",
	},
};

export const EygaApiClient = {
	Documents: {
		Upload: async (request: UploadDocumentRequest, context: EygaApiContext): Promise<void> => {
			const formData = new FormData();
			formData.append(
				"json",
				JSON.stringify({
					Name: request.FileName,
					DocumentFolder: request.DocumentFolder,
					RecordFolder: request.RecordFolder,
					Tags: request.Tags,
				})
			);
			formData.append("file", request.File);

			return callEygaApi<FormData, void>(EygaApi.Documents, EygaApiEndpoint.UploadDocument, context, formData);
		},

		SearchByTags: async (request: SearchByTagsRequest, context: EygaApiContext): Promise<DocumentMetadata[]> => {
			return callEygaApi<SearchByTagsRequest, DocumentMetadata[]>(EygaApi.Documents, EygaApiEndpoint.SearchByTags, context, request);
		},

		Download: async (fullName: string, context: EygaApiContext): Promise<Blob> => {
			return callEygaApi<string, Blob>(EygaApi.Documents, EygaApiEndpoint.DownloadDocument, context, fullName);
		},

		Delete: async (fullName: string, context: EygaApiContext): Promise<void> => {
			return callEygaApi<string, void>(EygaApi.Documents, EygaApiEndpoint.DeleteDocument, context, fullName);
		},

		GetSASUrl: async (context: EygaApiContext): Promise<string> => {
			return callEygaApi<void, string>(EygaApi.Documents, EygaApiEndpoint.GetSASUrl, context);
		},
	},
	Address: {
		Validate: async (addressData: any, context: EygaApiContext): Promise<any> => {
			return callEygaApi(EygaApi.Address, EygaApiEndpoint.ValidateAddress, context, addressData);
		},
	},
	SamGov: {
		GetEntity: async (params: Record<string, string>, context: EygaApiContext): Promise<any> => {
			return callEygaApi(EygaApi.SamGov, EygaApiEndpoint.GetSAMGovEntity, context, params);
		},

		GetExclusion: async (params: Record<string, string>, context: EygaApiContext): Promise<any> => {
			return callEygaApi(EygaApi.SamGov, EygaApiEndpoint.GetSAMGovExclusion, context, params);
		},
	},
};

const TOKEN_CACHE_KEY = "eyga-api-token";

const getCachedApiToken = (): { token: string; expiresAt: number } | null => {
	if (typeof sessionStorage === "undefined") {
		return null;
	}

	try {
		const cachedValue = sessionStorage.getItem(TOKEN_CACHE_KEY);
		if (!cachedValue) {
			return null;
		}

		const cached = JSON.parse(cachedValue) as { token: string; expiresAt: number };
		if (!cached?.token || !cached.expiresAt) {
			sessionStorage.removeItem(TOKEN_CACHE_KEY);
			return null;
		}

		if (Date.now() > cached.expiresAt) {
			sessionStorage.removeItem(TOKEN_CACHE_KEY);
			return null;
		}

		return cached;
	} catch (error) {
		console.warn("Failed to read EYGA API token cache.", error);
		return null;
	}
};

const setCachedApiToken = (token: string, expiresAt: number | null): void => {
	if (typeof sessionStorage === "undefined" || !expiresAt) {
		return;
	}

	try {
		const payload = {
			token,
			expiresAt,
		};
		sessionStorage.setItem(TOKEN_CACHE_KEY, JSON.stringify(payload));
	} catch (error) {
		console.warn("Failed to cache EYGA API token.", error);
	}
};

export const retrieveApiToken = async (): Promise<string> => {
	const cachedToken = getCachedApiToken();
	if (cachedToken) {
		return cachedToken.token;
	}

	const fetchXml = `
        <fetch top="1">
            <entity name="eyfrcc_apitoken">
                <attribute name="eyfrcc_apitokenid" />
                <attribute name="eyfrcc_token" />
                <attribute name="eyfrcc_expirationdate" />
            </entity>
        </fetch>`;

	const response = await retrieveRecord("eyfrcc_apitoken", fetchXml);
	if (!response) {
		throw new Error("Failed to retrieve EYGA API token");
	}

	const token = response.eyfrcc_token as string;
	const expiration = response.eyfrcc_expirationdate ? new Date(response.eyfrcc_expirationdate).getTime() : null;

	if (expiration && !Number.isNaN(expiration)) {
		setCachedApiToken(token, expiration);
	}

	return token;
};

export const callEygaApi = async <TRequest, TResponse>(
	eygaApi: EygaApi,
	apiFunction: EygaApiEndpoint,
	apiContext: EygaApiContext,
	payload?: TRequest
): Promise<TResponse> => {
	const eygaConfiguration = await retrieveEygaConfiguration();
	if (!eygaConfiguration) {
		throw new Error("EYGA configuration not found");
	}

	const baseEndpoint = eygaConfiguration.ApiEndpoints[eygaApi];
	const endpointConfig = ApiEndpoints[apiFunction];
	if (!endpointConfig) {
		throw new Error(`API endpoint configuration not found for ${apiFunction}`);
	}

	const headers = await getApiHeaders(eygaConfiguration, apiContext);

	let url = `${baseEndpoint}${endpointConfig.Path}`;

	let body: any;
	let fetchHeaders: Record<string, string> = { ...headers };

	if (endpointConfig.ContentType === "multipart/form-data") {
		body = payload;
	} else if (endpointConfig.Method === "GET") {
		if (payload && typeof payload === "object") {
			const params = new URLSearchParams(payload as Record<string, string>);
			url += `?${params.toString()}`;
		}
	} else if (payload !== undefined) {
		fetchHeaders["Content-Type"] = "application/json";
		body = JSON.stringify(payload);
	}

	try {
		const response = await fetch(url, {
			method: endpointConfig.Method,
			headers: fetchHeaders,
			body: body,
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`API call failed: ${response.status} - ${errorText}`);
		}

		if (endpointConfig.ResponseType === "blob") {
			return (await response.blob()) as TResponse;
		}

		const data = await response.json();
		return data as TResponse;
	} catch (error) {
		console.error(`Error calling ${apiFunction}:`, error);
		throw error;
	}
};

export const getApiHeaders = async (eygaConfiguration: EygaConfiguration, apiContext: EygaApiContext): Promise<Record<string, string>> => {
	const apiKey = eygaConfiguration.ApiKey;
	if (!apiKey) {
		throw new Error("EYGA API Key not found in configuration");
	}

	const [apiTokenResult, eygaEventResult] = await Promise.allSettled([retrieveApiToken(), createEygaEvent(apiContext)]);
	if (apiTokenResult.status !== "fulfilled" || !apiTokenResult.value) {
		throw new Error("Failed to retrieve EYGA API token");
	}

	const headerResponse: Record<string, string> = {
		"eyga-api-key": apiKey,
		"EYGA-Authorization": apiTokenResult.value,
	};

	if (eygaEventResult.status === "fulfilled" && eygaEventResult.value) {
		headerResponse["EYGA-EventId"] = eygaEventResult.value;
	}

	if (apiContext.RegardingId) {
		headerResponse["EYGA-RecordId"] = apiContext.RegardingId;
	}

	return headerResponse;
};

export const createEygaEvent = async (apiContext: EygaApiContext): Promise<string | null> => {
	if (!apiContext.RegardingId || !apiContext.RegardingLogicalName || !apiContext.UserId) {
		return null;
	}

	const newEygaEvent = {
		[`eyfrcc_RegardingId_${apiContext.RegardingLogicalName}@odata.bind`]: `/${resolveEntitySetName(apiContext.RegardingLogicalName)}(${apiContext.RegardingId})`,
		["eyfrcc_PortalUser@odata.bind"]: `/contacts(${apiContext.UserId})`,
		["eyfrcc_name"]: apiContext.ApiAction ?? "",
		["eyfrcc_source"]: 643260000, // Portal TO-DO: enum
	};

	return await createRecord("eyfrcc_event", newEygaEvent);
};
