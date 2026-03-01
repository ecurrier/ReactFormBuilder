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
 * Return type of the useFormState() hook.
 * Provides the full API for managing form state including field registration,
 * value tracking, dirty tracking, tree operations, and serialization.
 */
export interface FormStateAPI {
	type: "main";

	// State
	recordId: string | null;
	primaryEntityName: string;
	formInstanceId: string | null;
	userFormSessionId: string | null;
	relatedRecords: Record<string, RelatedRecordInfo>;
	childRecords: Record<string, Record<string, Entity>>;
	rootNodeId: string;
	nodesById: Record<string, FormStateNode>;
	entityNodeIds: Record<string, string>;
	metadata: Record<string, FieldMetadata>;
	hasChanges: boolean;
	hasPendingChildren: boolean;
	hasPendingDocumentUploads: boolean;
	hasPendingUploads: boolean;
	dirtyFields: string[];

	// Actions
	registerField: (path: string, metadata: FieldMetadata, initialValue?: any) => void;
	updateFieldValue: (path: string, value: any) => void;
	setRecordId: (recordId: string | null) => void;
	setFormInstanceId: (formInstanceId: string | null) => void;
	setUserFormSessionId: (userFormSessionId: string | null) => void;
	resetDirty: (paths?: string[]) => void;
	resetForm: () => void;
	initializeFormData: (fieldData: Map<string, any>) => void;
	setRelatedRecord: (entityName: string, recordId: string, referencingAttribute?: string, referencingNavigationProperty?: string) => void;
	getRelatedRecord: (entityName: string) => RelatedRecordInfo | undefined;
	clearRelatedRecords: (entityName?: string) => void;
	setChildRecords: (entityName: string, records: Entity[]) => void;
	upsertChildRecord: (entityName: string, record: Entity) => void;
	clearChildRecords: (entityName?: string) => void;
	getChildRecords: (entityName: string) => Entity[];

	// Tree operations
	upsertChildNode: (args: {
		parentEntityName: string;
		childEntityName: string;
		data: Partial<Entity>;
		recordId?: string;
		referencingAttribute: string;
		referencingNavigationProperty?: string;
		isPersisted?: boolean;
	}) => string;
	updateNodeData: (nodeId: string, data: Partial<Entity>) => void;
	updateNodeRecordId: (nodeId: string, recordId: string | null, isPersisted?: boolean) => void;
	resetNodeData: (nodeId: string) => void;
	deleteNode: (nodeId: string) => void;
	getChildNodes: (entityName: string) => FormStateNode[];
	ensureEntityNode: (entityName: string) => FormStateNode | undefined;
	getNodeById: (nodeId: string) => FormStateNode | undefined;
	getEntityNode: (entityName: string) => FormStateNode | undefined;
	findNodeByRecordId: (entityName: string, recordId?: string | null) => FormStateNode | undefined;

	// Upload operations
	addUploadNode: (args: { parentNodeId: string; entityName: string; folderName: string; file: File; uploadDate: string; childRecordId?: string }) => string;
	getUploadNodes: (args: { parentNodeId?: string; entityName?: string; folderName?: string }) => FormStateNode[];

	// Getters
	getFieldValue: (path: string) => any;
	getFieldMetadata: (path: string) => FieldMetadata | undefined;
	isFieldDirty: (path: string) => boolean;
	getChangedData: () => EntityChanges[];
	serializeForSubmission: () => EntityChanges[];
	getSaveTree: () => FormStateTreeNode | null;
}

/**
 * Local form state for TableEntryForm child forms.
 * A subset of FormStateAPI with table-entry-specific context.
 */
export interface TableEntryFormState {
	type: "tableEntry";
	nodeId?: string;
	recordId?: string;
	primaryEntityName: string;
	parentEntityName?: string;
	parentRecordId?: string;
	registerField: (path: string, metadata: FieldMetadata, initialValue?: any) => void;
	updateFieldValue: (path: string, value: any) => void;
	getFieldValue: (path: string) => any;
	getFieldMetadata: (path: string) => FieldMetadata | undefined;
	addUploadNode?: FormStateAPI["addUploadNode"];
	getUploadNodes?: FormStateAPI["getUploadNodes"];
	deleteNode?: FormStateAPI["deleteNode"];
	getNodeById?: FormStateAPI["getNodeById"];
	findNodeByRecordId?: FormStateAPI["findNodeByRecordId"];
	getEntityNode?: FormStateAPI["getEntityNode"];
}

/**
 * Discriminated union of all form state variants.
 * Use when a component can receive either the main or table-entry form state.
 */
export type AnyFormState = FormStateAPI | TableEntryFormState;

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
