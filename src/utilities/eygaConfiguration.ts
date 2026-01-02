import { retrieveRecord } from "@api";

export interface EygaConfiguration {
	ApiKey: string;
	AllowedFileTypes: ValidFileType[];
	MaxFileSizeMB: number;
	Apis: EygaApi[];
}

export interface ValidFileType {
	MimeType: string;
	Extensions: string[];
}

export interface EygaApi {
	Name: string;
	Endpoint: string;
}

export const retrieveEygaConfiguration = async (): Promise<EygaConfiguration> => {
	// Placeholder for actual implementation to fetch configuration from EYGA service
	// This could involve making an HTTP request to a configuration endpoint
	// First, check cache (not implemented here for brevity)

	// If cache not initialized, retrieve via fetch
	const fetchXml = `
        <fetch top="1">
            <entity name="eyfrcc_eygaconfiguration">
                <attribute name="eyfrcc_eygaconfigurationid" />
                <attribute name="eyfrcc_eygaapikey" />
                <attribute name="eyfrcc_allowedextensions" />
                <attribute name="eyfrcc_maxfilesizemb" />
                <attribute name="eyfrcc_documentapiurl" />
                <attribute name="eyfrcc_addressapiurl" />
            </entity>
        </fetch>`;

	const response = await retrieveRecord("eyfrcc_eygaconfiguration", fetchXml);
	if (!response) {
		throw new Error("Failed to retrieve EYGA configuration");
	}

	const validFileTypes: ValidFileType[] = JSON.parse(response.eyfrcc_allowedextensions).map((item: any) => ({
		MimeType: item.m,
		Extensions: item.e.split(","),
	}));

	return {
		ApiKey: response.eyfrcc_eygaapikey,
		AllowedFileTypes: validFileTypes,
		MaxFileSizeMB: response.eyfrcc_maxfilesizemb || 10,
		Apis: [
			{ Name: "Documents", Endpoint: response.eyfrcc_documentapiurl },
			{ Name: "Address", Endpoint: response.eyfrcc_addressapiurl },
		],
	};
};

// Old methods below - need to refactor

var callEygaApi = async (apiCall, apiContext, payload, queryParams = null) => {
	var results = await Promise.all([getEYGAConfigurationSetting(apiCall.apiType), getHeaders(apiCall.displayName, apiContext)]);

	if (!results[0] || !results[1]) {
		return null; // Error messages for retrieval failure handled within respective calls
	}

	return new Promise(function (resolve, reject) {
		$.ajax({
			type: apiCall.httpMethod,
			url: results[0] + apiCall.apiMethod + (queryParams ? queryParams : ""),
			headers: results[1],
			data: apiCall.contentType == "application/json" ? JSON.stringify(payload) : payload,
			contentType: apiCall.contentType,
			processData: apiCall.processData,
			xhrFields: apiCall.xhrFields,
			success: function (response, status, request) {
				resolve(response);
			},
			error: function (request, status, error) {
				handleAjaxError(request, status, error);
				handleError(error, true);
				reject(error);
			},
		});
	});
};

var getHeaders = function (apiAction, apiContext, generateEventId = true) {
	return Promise.all([
		_getApiToken(),
		_createEvent(generateEventId, apiAction, apiContext.regardingId, apiContext.regardingType, apiContext.userId),
		getEYGAConfigurationSetting("eyfrcc_eygaapikey"),
	])
		.then((result) => {
			if (!result || result.length < 1) {
				throw new Error("ERROR: Unexpected error retrieving API call headers");
			}
			if (!result[0] || result[0] == "") {
				throw new Error("ERROR: Unexpected error retrieving API token");
			}
			if (!result[2] || result[2] == "") {
				throw new Error("ERROR: Could not retrieve EYGA API Key; check that a valid key has been entered in the configuration");
			}
			return _returnHeaders(result[2], result[1], apiContext.regardingId, result[0]);
		})
		.catch((error) => handleError(error));
};

var _returnHeaders = function (apiKey, eventId, regardingId, apiToken) {
	if (eventId) {
		return { "eyga-api-key": apiKey, "EYGA-EventId": eventId, "EYGA-RecordId": regardingId, "EYGA-Authorization": apiToken };
	}

	if (regardingId) {
		return { "eyga-api-key": apiKey, "EYGA-RecordId": regardingId, "EYGA-Authorization": apiToken };
	}

	if (!apiToken || apiToken == "") {
		handleError("ERROR: An error occured attempting to retrieve the API token", true);
		return null;
	}

	if (!apiKey || apiKey == "") {
		handleError("ERROR: An error occured attempting to retrieve the API key; check if key is present in the configuration settings", true);
		return null;
	}

	return { "eyga-api-key": apiKey, "EYGA-Authorization": apiToken };
};

var _createEvent = function (generateEventId, apiAction, regardingId, regardingType, userId) {
	if (generateEventId && regardingId && regardingType && userId) {
		var event = {};
		event["eyfrcc_RegardingId_" + regardingType + "@odata.bind"] = `/${getEntitySetName(regardingType)}(${regardingId})`;
		event["eyfrcc_PortalUser@odata.bind"] = `/contacts(${userId})`;
		event["eyfrcc_name"] = apiAction;
		event["eyfrcc_source"] = 643260000; // Portal

		return new Promise(function (resolve, reject) {
			_safeAjax({
				type: "POST",
				url: "/_api/eyfrcc_events",
				contentType: "application/json",
				data: JSON.stringify(event),
				success: function (res, status, xhr) {
					var eventId = xhr.getResponseHeader("entityid");
					resolve(eventId);
				},
				error: function (request, status, error) {
					console.log("ERROR: Event creation for " + apiAction + " failed");
					handleAjaxError(request, status, error);
					resolve(); // Return nothing if event creation fails, but continue API call
				},
			});
		});
	} else {
		Promise.resolve();
	}
};

var _getApiToken = function () {
	return new Promise(function (resolve, reject) {
		var apiTokenKey = "apiToken";
		_getApiTokenFromApi()
			.then((value) => {
				window.sessionStorage.setItem(apiTokenKey, JSON.stringify(value));
				resolve(value.eyfrcc_token);
			})
			.catch((reason) => reject(reason));
	});
};

var _getApiTokenFromApi = function () {
	return new Promise(function (resolve, reject) {
		_safeAjax({
			type: "GET",
			url: `/_api/eyfrcc_apitokens(${_generateGuid()})?$select=eyfrcc_token,eyfrcc_expirationdate`,
			contentType: "application/json",
			success: function (res, status, xhr) {
				resolve(res);
			},
			error: function (request, status, error) {
				handleAjaxError(request, status, error);
				reject(error);
			},
		});
	});
};
