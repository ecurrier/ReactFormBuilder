/**
 * Base entity type for Dataverse records.
 * Uses generic Record type to support any entity structure.
 */
export type Entity = Record<string, any>;

/**
 * Represents a reference to another entity (lookup field).
 * Used for creating/updating lookup relationships.
 */
export interface EntityReference {
	/** GUID of the referenced entity */
	id: string;
	/** Logical name of the referenced entity (e.g., "account", "contact") */
	logicalName: string;
	/** Display name of the referenced entity (optional) */
	name?: string;
}

/**
 * Dataverse OData lookup value format.
 * Used in API requests to establish lookup relationships.
 */
export interface LookupValue {
	"@odata.type": string;
	"@odata.id": string;
}

/**
 * Option set (picklist) value.
 * Contains the numeric value and optional display label.
 */
export interface OptionSetValue {
	/** Numeric value of the option */
	Value: number;
	/** Display label for the option (optional) */
	Label?: string;
}

/**
 * Multi-select option set value.
 * Contains multiple option values selected.
 */
export interface MultiSelectOptionSetValue {
	/** Array of selected option values */
	Value: number[];
}
