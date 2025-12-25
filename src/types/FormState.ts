import type { Entity } from "./Entity";

/**
 * Metadata about a field, used for API serialization.
 * Fields register this information when they mount.
 */
export interface FieldMetadata {
	/** Dataverse entity logical name (e.g., "eyfrcc_application") */
	entityName: string;
	/** Dataverse field logical name (e.g., "eyfrcc_name") */
	logicalName: string;
	/** Dataverse field schema name (e.g., "eyfrcc_Name") */
	schemaName: string;
	/** Field data type from configuration (e.g., DataType.SingleLineText) */
	dataType: number;
	/** Navigation property name for related entities (lookups, relationships) */
	navigationProperty?: string;
	/** Referencing attribute name for child entity relationships */
	referencingAttribute?: string;
}

/**
 * Represents a field value with dirty tracking.
 */
export interface FieldValue {
	/** Current value of the field */
	value: any;
	/** Whether the field has been modified since initial load */
	isDirty: boolean;
}

/**
 * Tracks related record IDs for secondary step entities.
 */
export interface RelatedRecordInfo {
	/** Record ID for the related entity */
	recordId: string;
	/** Referencing attribute for the relationship */
	referencingAttribute?: string;
	/** Navigation property for the relationship */
	referencingNavigationProperty?: string;
}

/**
 * Represents a pending child record operation (create or update).
 * Used to track child records before parent record exists.
 */
export interface PendingChildRecord {
	/** Temporary ID (UUID) or real GUID */
	id: string;
	/** Child entity logical name */
	entityName: string;
	/** Parent lookup field logical name */
	referencingAttribute: string;
	/** Navigation property for parent relationship (preferred for OData binds) */
	referencingNavigationProperty?: string;
	/** Parent entity logical name for this child record */
	parentEntityName?: string;
	/** Field data for the child record */
	data: Partial<Entity>;
	/** Whether this is a new record (vs update to unsaved record) */
	isNew: boolean;
}

/**
 * Complete form state structure.
 * Tracks all field values, dirty states, and metadata for serialization.
 */
export interface FormState {
	/** Map of field path to field value and dirty state */
	fields: Record<string, FieldValue>;
	/** Map of field path to field metadata */
	metadata: Record<string, FieldMetadata>;
	/** Record ID being edited (for updates), null for new records */
	recordId: string | null;
	/** Primary entity name for this form */
	primaryEntityName: string;
	/** Related record IDs for secondary step entities */
	relatedRecords: Record<string, RelatedRecordInfo>;
	/** Map of child entity names to record maps */
	childRecords: Record<string, Record<string, Entity>>;
	/** Map of pending child records keyed by entityName_tempId */
	pendingChildRecords: Record<string, PendingChildRecord>;
}

/**
 * Actions for form state reducer.
 */
export type FormStateAction =
	| { type: "REGISTER_FIELD"; path: string; metadata: FieldMetadata; initialValue?: any }
	| { type: "UPDATE_FIELD"; path: string; value: any }
	| { type: "SET_RECORD_ID"; recordId: string | null }
	| { type: "RESET_DIRTY"; paths?: string[] }
	| { type: "RESET_FORM" }
	| { type: "INITIALIZE_FORM_DATA"; fieldData: Map<string, any> }
	| { type: "SET_RELATED_RECORD"; entityName: string; record: RelatedRecordInfo }
	| { type: "CLEAR_RELATED_RECORDS"; entityName?: string }
	| { type: "SET_CHILD_RECORDS"; entityName: string; records: Entity[] }
	| { type: "UPSERT_CHILD_RECORD"; entityName: string; record: Entity }
	| { type: "CLEAR_CHILD_RECORDS"; entityName?: string }
	| { type: "ADD_PENDING_CHILD"; record: PendingChildRecord }
	| { type: "UPDATE_PENDING_CHILD"; key: string; data: Partial<Entity> }
	| { type: "DELETE_PENDING_CHILD"; key: string }
	| { type: "CLEAR_PENDING_CHILDREN"; entityName?: string };

/**
 * Represents changes grouped by entity for API submission.
 * Each entity can have creates, updates, or deletes.
 */
export interface EntityChanges {
	/** Entity logical name */
	entityName: string;
	/** Entity set name for API endpoint */
	entitySetName: string;
	/** Record ID (for updates/deletes) */
	recordId?: string;
	/** Changed field data to submit */
	data: Partial<Entity>;
	/** Field metadata for serialization */
	metadata: Record<string, FieldMetadata>;
}
