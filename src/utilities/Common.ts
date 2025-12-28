import { getEntityMetadata } from "./entityMetadata";

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
