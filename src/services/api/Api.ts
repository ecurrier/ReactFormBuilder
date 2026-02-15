import { DOMParser, XMLSerializer } from "xmldom";
import { resolveEntitySetName, sanitizeGuid, serializeForApi } from "@utilities";
import type { ExtendedWindow } from "@app-types";
import type { Entity } from "@app-types";
import { ApiError, parseApiError } from "@/services/api";

export interface FilterOption {
	type: "and" | "or";
	conditions: FilterCondition[];
}

export interface FilterCondition {
	field: string;
	operator: "eq" | "ne" | "gt" | "lt" | "ge" | "le" | "like";
	value: string | number | boolean;
}

export interface PaginationOptions {
	page: number;
	pageSize: number;
}

export interface QueryOptions {
	select?: string[];
	filter?: FilterOption;
	orderBy?: string;
	entityAlias?: string;
	top?: number;
	expand?: string[];
	pagination?: PaginationOptions;
}

export interface RawApiResponse<T extends Entity> {
	value: T[];
	"@odata.count"?: number;
	"@Microsoft.Dynamics.CRM.totalrecordcount"?: number;
}

export interface ApiResponse<T extends Entity> {
	results: T[];
	recordCount?: number;
	totalRecordCount?: number;
}

const baseUrl = import.meta.env.MODE === "power-platform" ? "/api/data/v9.2/" : "/_api/";

export const retrieveRecord = async <T extends Entity>(entityName: string, fetchXmlTemplate: string, options?: QueryOptions): Promise<T | null> => {
	try {
		options = { ...options, top: 1 };
		const fetchXml = processFetchXml(fetchXmlTemplate, options);

		const url = `${baseUrl}${resolveEntitySetName(entityName)}?fetchXml=${fetchXml}`;
		const response = await fetch(url, {
			method: "GET",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			const apiError = await parseApiError(response);
			console.error(`API Error [${apiError.code}]: ${apiError.message}`);
			throw apiError;
		}

		const rawData = (await response.json()) as RawApiResponse<T>;
		if (!rawData.value || rawData.value.length === 0) {
			return null;
		}

		// Return raw API response data - entity-agnostic approach
		return rawData.value[0];
	} catch (error) {
		if (error instanceof ApiError) {
			throw error;
		}

		console.error("Error retrieving record:", error);
		throw error;
	}
};

export const retrieveMultipleRecords = async <T extends Entity>(
	entityName: string,
	fetchXmlTemplate: string,
	options?: QueryOptions
): Promise<ApiResponse<T>> => {
	try {
		const fetchXml = processFetchXml(fetchXmlTemplate, options);
		const url = `${baseUrl}${resolveEntitySetName(entityName)}?fetchXml=${fetchXml}`;
		const response = await fetch(url, {
			method: "GET",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			const apiError = await parseApiError(response);
			console.error(`API Error [${apiError.code}]: ${apiError.message}`);
			throw apiError;
		}

		const rawData = (await response.json()) as RawApiResponse<T>;

		// Return raw API response data - entity-agnostic approach
		return mapApiResponse(rawData);
	} catch (error) {
		if (error instanceof ApiError) {
			throw error;
		}

		console.error("Error retrieving multiple records with FetchXML:", error);
		throw error;
	}
};

const processFetchXml = (fetchXmlTemplate: string, options?: QueryOptions): string => {
	let fetchXml = fetchXmlTemplate;

	if (options?.orderBy) {
		const [field, direction = "asc"] = options.orderBy.split(" ");
		fetchXml = injectOrderTag(fetchXml, field, direction as "asc" | "desc", options.entityAlias);
	}

	if (options?.pagination) {
		fetchXml = injectPaginationAttributes(fetchXml, options.pagination);
	} else if (options?.top) {
		fetchXml = injectTopTag(fetchXml, options.top);
	}

	if (options?.filter) {
		fetchXml = injectFilterTag(fetchXml, options.filter);
	}

	fetchXml = minimizeFetchXml(fetchXml);

	return encodeURIComponent(fetchXml);
};

const injectOrderTag = (fetchXml: string, field: string, direction: "asc" | "desc", entityAlias?: string): string => {
	const domParser = new DOMParser();
	const xmlDoc = domParser.parseFromString(fetchXml, "text/xml");
	let orderTagInjected = false;

	// Check if the entityAlias is provided and find the corresponding link-entity
	if (entityAlias) {
		const linkEntities = Array.from(xmlDoc.getElementsByTagName("link-entity")) as Element[];
		for (const linkEntity of linkEntities.filter((element) => element.getAttribute("alias") === entityAlias)) {
			const orderNodes = Array.from(linkEntity.getElementsByTagName("order"));
			orderNodes.forEach((orderNode) => linkEntity.removeChild(orderNode));

			const orderElement = xmlDoc.createElement("order");
			orderElement.setAttribute("attribute", field);
			orderElement.setAttribute("descending", direction === "desc" ? "true" : "false");

			linkEntity.appendChild(orderElement);
			orderTagInjected = true;
			break;
		}
	}

	// If no entityAlias is provided or no link-entity was found, inject the order tag directly into the entity
	if (!orderTagInjected) {
		const entity = xmlDoc.getElementsByTagName("entity")?.[0];
		if (entity) {
			const orderNodes = Array.from(entity.getElementsByTagName("order"));
			orderNodes.forEach((orderNode) => entity.removeChild(orderNode));

			const orderElement = xmlDoc.createElement("order");
			orderElement.setAttribute("attribute", field);
			orderElement.setAttribute("descending", direction === "desc" ? "true" : "false");

			entity.appendChild(orderElement);
		}
	}

	const serializer = new XMLSerializer();
	return serializer.serializeToString(xmlDoc);
};

const injectPaginationAttributes = (fetchXml: string, pagination: PaginationOptions): string => {
	const domParser = new DOMParser();
	const xmlDoc = domParser.parseFromString(fetchXml, "text/xml");

	const fetchElement = xmlDoc.getElementsByTagName("fetch")?.[0];
	if (fetchElement) {
		fetchElement.setAttribute("count", pagination.pageSize.toString());
		fetchElement.setAttribute("page", pagination.page.toString());
		fetchElement.setAttribute("returntotalrecordcount", "true");
	}

	const serializer = new XMLSerializer();
	return serializer.serializeToString(xmlDoc);
};

const injectTopTag = (fetchXml: string, top: number): string => {
	const domParser = new DOMParser();
	const xmlDoc = domParser.parseFromString(fetchXml, "text/xml");

	const fetchElement = xmlDoc.getElementsByTagName("fetch")?.[0];
	if (fetchElement) {
		fetchElement.setAttribute("top", top.toString());
	}

	const serializer = new XMLSerializer();
	return serializer.serializeToString(xmlDoc);
};

const injectFilterTag = (fetchXml: string, filter: FilterOption): string => {
	const domParser = new DOMParser();
	const xmlDoc = domParser.parseFromString(fetchXml, "text/xml");

	const filterElement = xmlDoc.createElement("filter");
	filterElement.setAttribute("type", filter.type);

	filter.conditions.forEach((condition) => {
		const conditionElement = xmlDoc.createElement("condition");
		conditionElement.setAttribute("attribute", condition.field);
		conditionElement.setAttribute("operator", condition.operator);

		// Handle boolean values - Dataverse accepts "true"/"false" or 1/0
		let valueStr: string;
		if (typeof condition.value === "boolean") {
			valueStr = condition.value ? "1" : "0";
		} else {
			valueStr = String(condition.value);
		}

		conditionElement.setAttribute("value", valueStr);
		filterElement.appendChild(conditionElement);
	});

	const entity = xmlDoc.getElementsByTagName("entity")?.[0];
	if (entity) {
		entity.appendChild(filterElement);
	}

	const serializer = new XMLSerializer();
	return serializer.serializeToString(xmlDoc);
};

const minimizeFetchXml = (fetchXml: string): string => {
	fetchXml = fetchXml.trim();

	const domParser = new DOMParser();
	const xmlDoc = domParser.parseFromString(fetchXml, "text/xml");

	const serializer = new XMLSerializer();
	return serializer.serializeToString(xmlDoc).replace(/>\s+</g, "><").trim();
};

export const createRecord = async <T extends Entity>(entityName: string, data: Partial<T>): Promise<string | null> => {
	try {
		const apiData = serializeForApi(data, entityName);

		const authorizationToken = await getAuthorizationToken();
		const headers: HeadersInit = {
			Accept: "application/json",
			"Content-Type": "application/json",
		};

		if (authorizationToken) {
			headers.__RequestVerificationToken = authorizationToken;
		}

		const response = await fetch(`${baseUrl}${resolveEntitySetName(entityName)}`, {
			method: "POST",
			headers,
			body: JSON.stringify(apiData),
		});

		if (!response.ok) {
			const apiError = await parseApiError(response);
			console.error(`API Error [${apiError.code}]: ${apiError.message}`);
			throw apiError;
		}

		return response?.headers?.get("entityid");
	} catch (error) {
		if (error instanceof ApiError) {
			throw error;
		}

		console.error("Error creating record:", error);
		throw error;
	}
};

export const updateRecord = async <T extends Entity>(entityName: string, id: string, data: Partial<T>): Promise<void> => {
	try {
		const apiData = serializeForApi(data, entityName);
		const normalizedId = sanitizeGuid(id);

		const authorizationToken = await getAuthorizationToken();
		const headers: HeadersInit = {
			Accept: "application/json",
			"Content-Type": "application/json",
		};

		if (authorizationToken) {
			headers.__RequestVerificationToken = authorizationToken;
		}

		const response = await fetch(`${baseUrl}${resolveEntitySetName(entityName)}(${normalizedId})`, {
			method: "PATCH",
			headers,
			body: JSON.stringify(apiData),
		});

		if (!response.ok) {
			const apiError = await parseApiError(response);
			console.error(`API Error [${apiError.code}]: ${apiError.message}`);
			throw apiError;
		}
	} catch (error) {
		if (error instanceof ApiError) {
			throw error;
		}

		console.error("Error updating record:", error);
		throw error;
	}
};

export const deleteRecord = async (entityName: string, id: string): Promise<void> => {
	try {
		const normalizedId = sanitizeGuid(id);
		const response = await fetch(`${baseUrl}${resolveEntitySetName(entityName)}(${normalizedId})`, {
			method: "DELETE",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			const apiError = await parseApiError(response);
			console.error(`API Error [${apiError.code}]: ${apiError.message}`);
			throw apiError;
		}
	} catch (error) {
		if (error instanceof ApiError) {
			throw error;
		}

		console.error("Error deleting record:", error);
		throw error;
	}
};

const mapApiResponse = <T extends Entity>(rawResponse: RawApiResponse<T>): ApiResponse<T> => {
	return {
		results: rawResponse.value,
		recordCount: rawResponse["@odata.count"],
		totalRecordCount: rawResponse["@Microsoft.Dynamics.CRM.totalrecordcount"],
	};
};

const getAuthorizationToken = async () => {
	const extWindow = window as unknown as ExtendedWindow;

	try {
		if (typeof window !== "undefined" && extWindow.shell?.getTokenDeferred) {
			const token = await extWindow.shell.getTokenDeferred();
			return token;
		}
	} catch (error) {
		console.error("Error fetching token:", error);
		return null;
	}
};
