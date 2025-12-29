import { getEntitySetName } from "../utilities";
import type { ExtendedWindow } from "../types";

export interface EygaApiContext {
	regardingId?: string | null;
	regardingType?: string | null;
	userId?: string | null;
}

export interface EygaApiCall {
	displayName: string;
	apiType: string;
	apiMethod: string;
	httpMethod: "GET" | "POST" | "DELETE";
	contentType?: string | false;
	processData?: boolean;
	responseType?: "json" | "blob";
}

export const EygaApiType = {
	Documents: "eyfrcc_documentapiurl",
} as const;

export const ApiCall = {
	UploadDocument: {
		displayName: "Upload Document",
		apiType: EygaApiType.Documents,
		apiMethod: "/upload",
		httpMethod: "POST",
		contentType: false,
		processData: false,
	} satisfies EygaApiCall,
	GetDocumentsById: {
		displayName: "Get Documents By Id",
		apiType: EygaApiType.Documents,
		apiMethod: "/searchbytags",
		httpMethod: "POST",
	} satisfies EygaApiCall,
	DownloadDocument: {
		displayName: "Download Document",
		apiType: EygaApiType.Documents,
		apiMethod: "/download",
		httpMethod: "POST",
		responseType: "blob",
	} satisfies EygaApiCall,
	DeleteDocument: {
		displayName: "Delete Document",
		apiType: EygaApiType.Documents,
		apiMethod: "/delete",
		httpMethod: "DELETE",
	} satisfies EygaApiCall,
} as const;

const generateExpirationDate = () => {
	const date = new Date();
	date.setDate(date.getDate() + 1);
	return date;
};

const generateCurrentDatePlusOneMinute = () => {
	const date = new Date();
	const oneMinuteInMilliseconds = 60000;
	return new Date(date.getTime() + oneMinuteInMilliseconds);
};

const generateGuid = () => {
	return "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx".replace(/x/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
};

const handleApiError = async (response: Response, fallbackMessage: string) => {
	let message = fallbackMessage;
	try {
		const payload = await response.json();
		message = payload?.error?.message || payload?.message || message;
	} catch {
		// ignore JSON parse errors
	}
	throw new Error(message);
};

const getApiTokenFromApi = async () => {
	const response = await fetch(`/_api/eyfrcc_apitokens(${generateGuid()})?$select=eyfrcc_token,eyfrcc_expirationdate`, {
		method: "GET",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
		},
	});

	if (!response.ok) {
		await handleApiError(response, "ERROR: Unexpected error retrieving API token");
	}

	return response.json();
};

const getApiToken = async (): Promise<string> => {
	const apiTokenKey = "apiToken";
	const cached = sessionStorage.getItem(apiTokenKey);
	if (cached) {
		const cachedValue = JSON.parse(cached);
		if (cachedValue?.eyfrcc_expirationdate) {
			const expiry = new Date(cachedValue.eyfrcc_expirationdate);
			if (expiry > new Date()) {
				return cachedValue.eyfrcc_token;
			}
		} else if (cachedValue?.eyfrcc_token) {
			return cachedValue.eyfrcc_token;
		}
	}

	const tokenResponse = await getApiTokenFromApi();
	sessionStorage.setItem(apiTokenKey, JSON.stringify(tokenResponse));
	return tokenResponse.eyfrcc_token;
};

export const getEYGAConfigurationSetting = async (settingName: string): Promise<any> => {
	let refreshSetting = true;
	let configurationSetting: any = sessionStorage.getItem(settingName);

	if (configurationSetting) {
		configurationSetting = JSON.parse(configurationSetting);
		const currentDatePlusOneMinute = generateCurrentDatePlusOneMinute();
		if (currentDatePlusOneMinute.getTime() <= new Date(configurationSetting.expirationDate).getTime()) {
			refreshSetting = false;
		}
	}

	if (refreshSetting) {
		const response = await fetch(
			`/_api/eyfrcc_eygaconfigurations?$select=eyfrcc_eygaconfigurationid,eyfrcc_name,${settingName}`,
			{
				method: "GET",
				headers: {
					Accept: "application/json",
					"Content-Type": "application/json",
				},
			}
		);

		if (!response.ok) {
			await handleApiError(response, `ERROR: Could not retrieve EYGA configuration setting ${settingName}`);
		}

		const result = await response.json();
		if (!result?.value?.[0]?.[settingName]) {
			return null;
		}

		result.expirationDate = generateExpirationDate();
		sessionStorage.setItem(settingName, JSON.stringify(result));
	}

	configurationSetting = JSON.parse(sessionStorage.getItem(settingName) ?? "null");
	return configurationSetting?.value?.[0]?.[settingName] ?? null;
};

const createEvent = async (apiAction: string, apiContext: EygaApiContext): Promise<string | null> => {
	if (!apiContext?.regardingId || !apiContext?.regardingType || !apiContext?.userId) {
		return null;
	}

	const event: Record<string, any> = {};
	event[`eyfrcc_RegardingId_${apiContext.regardingType}@odata.bind`] = `/${getEntitySetName(apiContext.regardingType)}(${apiContext.regardingId})`;
	event["eyfrcc_PortalUser@odata.bind"] = `/contacts(${apiContext.userId})`;
	event["eyfrcc_name"] = apiAction;
	event["eyfrcc_source"] = 643260000;

	const response = await fetch("/_api/eyfrcc_events", {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
		},
		body: JSON.stringify(event),
	});

	if (!response.ok) {
		await handleApiError(response, "ERROR: Unable to create EYGA event");
	}

	return response.headers.get("entityid");
};

const buildHeaders = async (apiAction: string, apiContext: EygaApiContext): Promise<Record<string, string>> => {
	const apiKey = await getEYGAConfigurationSetting("eyfrcc_eygaapikey");
	if (!apiKey) {
		throw new Error("ERROR: Could not retrieve EYGA API Key; check configuration");
	}

	const apiToken = await getApiToken();
	if (!apiToken) {
		throw new Error("ERROR: Unexpected error retrieving API token");
	}

	const eventId = await createEvent(apiAction, apiContext);

	const headers: Record<string, string> = {
		"eyga-api-key": apiKey,
		"EYGA-Authorization": apiToken,
	};

	if (eventId) {
		headers["EYGA-EventId"] = eventId;
	}

	if (apiContext?.regardingId) {
		headers["EYGA-RecordId"] = apiContext.regardingId;
	}

	return headers;
};

export const callEygaApi = async <T>(
	apiCall: EygaApiCall,
	apiContext: EygaApiContext,
	payload?: any,
	queryParams: string | null = null
): Promise<T> => {
	const baseUrl = await getEYGAConfigurationSetting(apiCall.apiType);
	if (!baseUrl) {
		throw new Error(`ERROR: Missing EYGA API endpoint for ${apiCall.apiType}`);
	}

	const headers = await buildHeaders(apiCall.displayName, apiContext);
	const url = `${baseUrl}${apiCall.apiMethod}${queryParams ?? ""}`;

	const requestInit: RequestInit = {
		method: apiCall.httpMethod,
		headers,
	};

	if (payload !== undefined) {
		if (apiCall.contentType === false) {
			requestInit.body = payload as BodyInit;
		} else {
			requestInit.headers = {
				...headers,
				"Content-Type": apiCall.contentType ?? "application/json",
			};
			requestInit.body = apiCall.contentType === "application/json" ? JSON.stringify(payload) : (payload as BodyInit);
		}
	}

	const response = await fetch(url, requestInit);
	if (!response.ok) {
		await handleApiError(response, `ERROR: Failed EYGA API call: ${apiCall.displayName}`);
	}

	if (apiCall.responseType === "blob") {
		return (await response.blob()) as T;
	}

	return (await response.json()) as T;
};

export const buildEygaApiContext = (recordId?: string | null, recordType?: string | null): EygaApiContext => {
	if (typeof window === "undefined") {
		return { regardingId: recordId ?? null, regardingType: recordType ?? null, userId: null };
	}

	const extWindow = window as ExtendedWindow;
	return {
		regardingId: recordId ?? null,
		regardingType: recordType ?? null,
		userId: extWindow.Microsoft?.Dynamic365?.Portal?.User?.contactId ?? null,
	};
};
