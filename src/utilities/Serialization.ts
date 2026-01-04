import type { Entity, EntityReference } from "@app-types/Entity";
import { resolveEntitySetName, sanitizeGuid } from "@utilities";

/**
 * Serializes entity data for Dataverse Web API submission.
 * Transforms entity objects into OData-compatible format.
 *
 * Handles:
 * - EntityReference (lookup fields) → @odata.bind syntax
 * - Date objects → ISO string format
 * - Boolean values → true/false (Dataverse accepts both boolean and 1/0)
 * - Null/undefined values → null
 * - Primitive values → pass through
 *
 * @param data - Partial entity data to serialize
 * @param entityName - Logical name of the entity (used for logging/debugging)
 * @returns Serialized data ready for API submission
 */
export const serializeForApi = (data: Partial<Entity>, entityName: string): Record<string, any> => {
	const serialized: Record<string, any> = {};

	for (const [key, value] of Object.entries(data)) {
		// Handle null/undefined/empty - explicitly set to null for API
		if (value === null || value === undefined || value === "") {
			serialized[key] = null;
			continue;
		}

		// Handle EntityReference (lookup fields)
		// Convert to OData bind syntax: fieldname@odata.bind
		if (typeof value === "object" && "id" in value && "logicalName" in value) {
			const ref = value as EntityReference;
			const targetEntitySetName = resolveEntitySetName(ref.logicalName);
			const normalizedId = sanitizeGuid(ref.id);
			serialized[`${key}@odata.bind`] = `/${targetEntitySetName}(${normalizedId})`;
			continue;
		}

		// Handle Date objects - convert to ISO string
		if (value instanceof Date) {
			serialized[key] = value.toISOString();
			continue;
		}

		// Handle arrays (for multi-select option sets)
		if (Array.isArray(value)) {
			serialized[key] = value.join(",");
			continue;
		}

		// Pass through other values (string, number, boolean)
		serialized[key] = value;
	}

	return serialized;
};

/**
 * Deserializes API response data into entity format.
 * Currently a pass-through, but can be extended for date parsing, etc.
 *
 * @param data - Raw API response data
 * @returns Deserialized entity
 */
export const deserializeFromApi = <T extends Entity>(data: T): T => {
	// TODO: Not needed at the moment... could use down the line if we wanted to enforce
	// consistent typing/format later on
	return data;
};
