import { HttpResponse } from "msw";
import { getStore, upsertRecord, type LatencyMode } from "./mockStore";

/**
 * Map of entity set names (plural, used in API URLs) to their primary ID attribute.
 * Dataverse convention: singular logical name + "id".
 */
const primaryIdMap: Record<string, string> = {
	eyfrcc_subrecipients: "eyfrcc_subrecipientid",
	eyfrcc_projects: "eyfrcc_projectid",
	eyfrcc_expenditures: "eyfrcc_expenditureid",
	eyfrcc_childapplicationtests: "eyfrcc_childapplicationtestid",
	eyfrcc_standardform424s: "eyfrcc_standardform424id",
	eyfrcc_standardform424as: "eyfrcc_standardform424aid",
	eyfrcc_standardform425s: "eyfrcc_standardform425id",
	eyfrcc_forminstances: "eyfrcc_forminstanceid",
	eyfrcc_userformsessions: "eyfrcc_userformsessionid",
	eyfrcc_indirectcostratelineses: "eyfrcc_indirectcostrateid",
	eyfrcc_eygaconfigurations: "eyfrcc_eygaconfigurationid",
	eyfrcc_apitokens: "eyfrcc_apitokenid",
};

/** Get the primary ID attribute name for an entity set, with fallback. */
export function getPrimaryIdAttribute(entitySetName: string): string {
	return primaryIdMap[entitySetName] ?? entitySetName.replace(/s$/, "") + "id";
}

/**
 * Persist a new record into the mock store from a POST request body.
 * Returns the new record ID.
 */
export function insertRecord(entitySetName: string, body: Record<string, any>): string {
	const id = newGuid();
	const idAttr = getPrimaryIdAttribute(entitySetName);
	const record = { ...body, [idAttr]: id };
	upsertRecord(entitySetName, id, record);
	console.log(`[MSW] Inserted record into ${entitySetName}:`, { id, record });
	return id;
}

/**
 * Update an existing record in the mock store from a PATCH request.
 * Returns true if a record was found and updated.
 */
export function updateRecord(entitySetName: string, recordId: string, body: Record<string, any>): boolean {
	const entityData = getStore().data[entitySetName];
	if (!entityData?.[recordId]) {
		console.warn(`[MSW] PATCH: record ${recordId} not found in ${entitySetName}, inserting as new`);
		upsertRecord(entitySetName, recordId, { ...body, [getPrimaryIdAttribute(entitySetName)]: recordId });
		return false;
	}
	upsertRecord(entitySetName, recordId, body);
	console.log(`[MSW] Updated record in ${entitySetName}:`, { id: recordId, fields: body });
	return true;
}

/** Returns appropriate delay in ms based on current latency mode */
export function getMockDelay(): number {
	const delays: Record<LatencyMode, () => number> = {
		instant: () => 0,
		realistic: () => 500 + Math.random() * 1000,
		slow: () => 2000 + Math.random() * 2000,
	};
	return delays[getStore().latencyMode]();
}

/** If forceErrors is on, returns a 500 error response. Otherwise null. */
export function maybeErrorResponse(): ReturnType<typeof HttpResponse.json> | null {
	if (getStore().forceErrors) {
		return HttpResponse.json(
			{
				error: {
					code: "MockError",
					message: "Forced error from dev console",
					innererror: {
						code: "MockError",
						message: "Forced error from dev console",
						type: "DevConsoleForceError",
					},
				},
			},
			{ status: 500 }
		);
	}
	return null;
}

/**
 * Parse a record GUID from a FetchXML condition.
 * Matches: <condition attribute="eyfrcc_subrecipientid" operator="eq" value="GUID" />
 */
export function extractIdFromFetchXml(fetchXml: string, idAttribute: string): string | null {
	const regex = new RegExp(`<condition\\s[^>]*attribute=["']${idAttribute}["'][^>]*value=["']([^"']+)["']`, "i");
	const match = fetchXml.match(regex);
	if (match) return match[1];

	// Also try reversed attribute order (value before attribute)
	const regexReversed = new RegExp(`<condition\\s[^>]*value=["']([^"']+)["'][^>]*attribute=["']${idAttribute}["']`, "i");
	const matchReversed = fetchXml.match(regexReversed);
	return matchReversed?.[1] ?? null;
}

/**
 * Parse a record GUID from a linked-entity filter in FetchXML.
 * Used for child records filtered by parent ID.
 * Matches: <condition attribute="eyfrcc_childapplication" operator="eq" value="GUID" />
 */
export function extractLinkedIdFromFetchXml(fetchXml: string, linkAttribute: string): string | null {
	return extractIdFromFetchXml(fetchXml, linkAttribute);
}

/** Parse entity ID from OData URL path, e.g. /_api/eyfrcc_subrecipients(GUID) */
export function extractIdFromUrl(url: string): string | null {
	const match = url.match(/\(([0-9a-f-]{36})\)/i);
	return match?.[1] ?? null;
}

/**
 * Get records for an entity set from the mock store.
 * If filterId is provided, returns only the matching record.
 * If filterField is provided, filters records where that field matches filterId.
 */
export function getRecords(entitySetName: string, filterId?: string | null, filterField?: string): Record<string, any>[] {
	const entityData = getStore().data[entitySetName] ?? {};
	const allRecords = Object.values(entityData);

	if (!filterId) return allRecords;

	// If filtering by a non-primary field (e.g., parent reference)
	if (filterField) {
		return allRecords.filter((r) => r[filterField] === filterId);
	}

	// Filter by primary key (record ID as the key in the map)
	if (entityData[filterId]) {
		return [entityData[filterId]];
	}

	return allRecords;
}

/** Wrap records in a standard Dataverse OData collection response */
export function odataCollection(value: Record<string, any>[], totalCount?: number) {
	return {
		"@odata.count": totalCount ?? value.length,
		"@Microsoft.Dynamics.CRM.totalrecordcount": totalCount ?? value.length,
		value,
	};
}

/** Generate a new random GUID for mock record creation */
export function newGuid(): string {
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}
