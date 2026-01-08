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

export type FormNodeType = "primary" | "secondary" | "child" | "upload";

export interface UploadNodeData {
	folderName: string;
	file: File;
	uploadDate: string;
	childRecordId?: string;
}

export interface FormStateNode {
	id: string;
	type: FormNodeType;
	logicalName?: string;
	data: Partial<Entity> | UploadNodeData;
	recordId?: string | null;
	isPersisted?: boolean;
	referencingAttribute?: string;
	referencingNavigationProperty?: string;
	parentId?: string | null;
	children: string[];
}

export interface FormStateTreeNode extends Omit<FormStateNode, "children"> {
	children: FormStateTreeNode[];
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
	rootNodeId: string;
	nodesById: Record<string, FormStateNode>;
	entityNodeIds: Record<string, string>;
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
	| { type: "ADD_NODE"; node: FormStateNode }
	| { type: "UPDATE_NODE_DATA"; nodeId: string; data: Partial<Entity> | UploadNodeData }
	| { type: "RESET_NODE_DATA"; nodeId: string }
	| { type: "UPDATE_NODE_RECORD_ID"; nodeId: string; recordId: string | null; isPersisted?: boolean }
	| { type: "REMOVE_NODE"; nodeId: string }
	| { type: "SET_ENTITY_NODE"; entityName: string; nodeId: string };
