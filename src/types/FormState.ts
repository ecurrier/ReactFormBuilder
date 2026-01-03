import type { Entity } from "./Entity";

export interface FieldMetadata {
	entityName: string;
	logicalName: string;
	schemaName: string;
	dataType: number;
	navigationProperty?: string;
	referencingAttribute?: string;
}

export interface FieldValue {
	value: any;
	isDirty: boolean;
}

export interface RelatedRecordInfo {
	recordId: string;
	referencingAttribute?: string;
	referencingNavigationProperty?: string;
}

export interface PendingChildRecord {
	id: string;
	entityName: string;
	referencingAttribute: string;
	referencingNavigationProperty?: string;
	parentEntityName?: string;
	data: Partial<Entity>;
	isNew: boolean;
}

export interface PendingDocumentUpload {
	id: string;
	entityName: string;
	recordId?: string;
	childRecordId?: string;
	folderName: string;
	file: File;
	uploadDate: string;
}

export interface FormState {
	fields: Record<string, FieldValue>;
	metadata: Record<string, FieldMetadata>;
	recordId: string | null;
	primaryEntityName: string;
	formInstanceId: string | null;
	userFormSessionId: string | null;
	relatedRecords: Record<string, RelatedRecordInfo>;
	childRecords: Record<string, Record<string, Entity>>;
	pendingChildRecords: Record<string, PendingChildRecord>;
	pendingDocumentUploads: Record<string, PendingDocumentUpload>;
}

export interface EntityChanges {
	entityName: string;
	entitySetName: string;
	recordId?: string;
	data: Partial<Entity>;
	metadata: Record<string, FieldMetadata>;
}

/**
 * Actions for form state reducer.
 */
export type FormStateAction =
	| { type: "REGISTER_FIELD"; path: string; metadata: FieldMetadata; initialValue?: any }
	| { type: "UPDATE_FIELD"; path: string; value: any }
	| { type: "SET_RECORD_ID"; recordId: string | null }
	| { type: "SET_FORM_INSTANCE_ID"; formInstanceId: string | null }
	| { type: "SET_USER_FORM_SESSION_ID"; userFormSessionId: string | null }
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
	| { type: "CLEAR_PENDING_CHILDREN"; entityName?: string }
	| { type: "ADD_PENDING_DOCUMENT_UPLOAD"; upload: PendingDocumentUpload }
	| { type: "DELETE_PENDING_DOCUMENT_UPLOAD"; key: string }
	| { type: "CLEAR_PENDING_DOCUMENT_UPLOADS"; entityName?: string };
