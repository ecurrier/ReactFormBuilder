import { getEntityMetadata } from "./metadata";

/**
 * Converts a Dataverse entity logical name to its entity set name (collection name).
 * Used for constructing Web API URLs.
 *
 * Rules:
 * - Entities ending in 's' → append 'es' (e.g., "address" → "addresses")
 * - Entities ending in 'y' → replace with 'ies' (e.g., "opportunity" → "opportunities")
 * - All others → append 's' (e.g., "account" → "accounts")
 *
 * @param entityName - Logical name of the entity
 * @returns Entity set name for API endpoints
 */

export const getEntitySetName = (entityName: string): string => {
	if (!entityName) {
		return entityName;
	}

	const metadata = getEntityMetadata(entityName);
	if (metadata?.EntitySetName) {
		return metadata.EntitySetName;
	}

	const lastChar = entityName[entityName.length - 1].toLowerCase();
	switch (lastChar) {
		case "s":
			return `${entityName}es`;
		case "y":
			return `${entityName.slice(0, -1)}ies`;
		default:
			return `${entityName}s`;
	}
};

const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Check if an ID is a temporary UUID (starts with a specific pattern or doesn't match GUID format)
 */
export const isTempId = (id?: string | null): boolean => {
	if (!id || typeof id !== "string") {
		return false;
	}

	// Temp IDs are UUIDs but we can distinguish them by checking if they start with our pattern
	// or by checking if they exist in pending records
	return id.startsWith("temp-") || !guidPattern.test(id);
};

/**
 * Generate a UUID v4 for temporary record IDs
 */
export const generateTempId = (): string => {
	return `temp-${crypto.randomUUID()}`;
};
