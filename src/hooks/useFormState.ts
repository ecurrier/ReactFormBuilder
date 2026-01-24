import { useReducer, useCallback, useMemo } from "react";
import type { Entity } from "@app-types/Entity";
import type {
	EntityChanges,
	FieldMetadata,
	FieldValue,
	FormState,
	FormStateAction,
	FormStateNode,
	FormStateTreeNode,
	RelatedRecordInfo,
	UploadNodeData,
} from "@app-types/FormState";
import { generateTempId, isTempId, resolveEntitySetName, resolvePrimaryIdAttribute, serializeForApi } from "@utilities";

/**
 * Initial form state.
 */
const buildInitialFormState = ({
	primaryEntityName,
	recordId,
	rootNodeId,
}: {
	primaryEntityName: string;
	recordId: string | null;
	rootNodeId: string;
}): FormState => {
	const rootNode: FormStateNode = {
		id: rootNodeId,
		type: "primary",
		logicalName: primaryEntityName,
		data: {},
		recordId,
		isPersisted: Boolean(recordId && !isTempId(recordId)),
		parentId: null,
		children: [],
	};

	return {
		fields: {},
		metadata: {},
		recordId,
		primaryEntityName,
		formInstanceId: null,
		userFormSessionId: null,
		relatedRecords: {},
		childRecords: {},
		rootNodeId,
		nodesById: {
			[rootNodeId]: rootNode,
		},
		entityNodeIds: {
			[primaryEntityName]: rootNodeId,
		},
	};
};

const resolveRecordId = (entityName: string, record: Entity): string | null => {
	if (record && typeof record.id === "string") {
		return record.id;
	}

	const entityKey = resolvePrimaryIdAttribute(entityName);
	const entityValue = record?.[entityKey];
	if (typeof entityValue === "string") {
		return entityValue;
	}

	return null;
};

/**
 * Form state reducer.
 * Handles all state mutations for form fields and metadata.
 */
const formStateReducer = (state: FormState, action: FormStateAction): FormState => {
	switch (action.type) {
		case "REGISTER_FIELD": {
			const { path, metadata, initialValue } = action;
			return {
				...state,
				metadata: {
					...state.metadata,
					[path]: metadata,
				},
				fields: {
					...state.fields,
					[path]: {
						value: initialValue ?? null,
						isDirty: false,
					},
				},
			};
		}

		case "UPDATE_FIELD": {
			const { path, value } = action;
			return {
				...state,
				fields: {
					...state.fields,
					[path]: {
						value,
						isDirty: true,
					},
				},
			};
		}

		case "SET_RECORD_ID": {
			const rootNode = state.nodesById[state.rootNodeId];
			return {
				...state,
				recordId: action.recordId,
				nodesById: rootNode
					? {
							...state.nodesById,
							[state.rootNodeId]: {
								...rootNode,
								recordId: action.recordId,
								isPersisted: Boolean(action.recordId && !isTempId(action.recordId)),
							},
						}
					: state.nodesById,
			};
		}

		case "SET_FORM_INSTANCE_ID": {
			return {
				...state,
				formInstanceId: action.formInstanceId,
			};
		}

		case "SET_USER_FORM_SESSION_ID": {
			return {
				...state,
				userFormSessionId: action.userFormSessionId,
			};
		}

		case "RESET_DIRTY": {
			const { paths } = action;
			if (!paths) {
				// Reset all fields
				const updatedFields = { ...state.fields };
				Object.keys(updatedFields).forEach((key) => {
					updatedFields[key] = { ...updatedFields[key], isDirty: false };
				});
				return { ...state, fields: updatedFields };
			} else {
				// Reset specific fields
				const updatedFields = { ...state.fields };
				paths.forEach((path) => {
					if (updatedFields[path]) {
						updatedFields[path] = { ...updatedFields[path], isDirty: false };
					}
				});
				return { ...state, fields: updatedFields };
			}
		}

		case "RESET_FORM": {
			const rootNodeId = generateTempId();
			return buildInitialFormState({ primaryEntityName: state.primaryEntityName, recordId: null, rootNodeId });
		}

		case "INITIALIZE_FORM_DATA": {
			const { fieldData } = action;
			const updatedFields = { ...state.fields };

			// Set initial values without marking as dirty
			fieldData.forEach((value, path) => {
				if (updatedFields[path]) {
					updatedFields[path] = { value, isDirty: false };
				} else {
					updatedFields[path] = { value, isDirty: false };
				}
			});

			return { ...state, fields: updatedFields };
		}

		case "SET_RELATED_RECORD": {
			const { entityName, record } = action;
			return {
				...state,
				relatedRecords: {
					...state.relatedRecords,
					[entityName]: record,
				},
			};
		}

		case "CLEAR_RELATED_RECORDS": {
			const { entityName } = action;
			if (!entityName) {
				return {
					...state,
					relatedRecords: {},
				};
			}

			const updatedRecords = { ...state.relatedRecords };
			delete updatedRecords[entityName];
			return {
				...state,
				relatedRecords: updatedRecords,
			};
		}

		case "SET_CHILD_RECORDS": {
			const { entityName, records } = action;
			const recordMap: Record<string, Entity> = {};

			records.forEach((record) => {
				const recordId = resolveRecordId(entityName, record);
				if (recordId) {
					recordMap[recordId] = record;
				}
			});

			return {
				...state,
				childRecords: {
					...state.childRecords,
					[entityName]: recordMap,
				},
			};
		}

		case "UPSERT_CHILD_RECORD": {
			const { entityName, record } = action;
			const recordId = resolveRecordId(entityName, record);
			if (!recordId) {
				return state;
			}

			return {
				...state,
				childRecords: {
					...state.childRecords,
					[entityName]: {
						...(state.childRecords[entityName] || {}),
						[recordId]: record,
					},
				},
			};
		}

		case "CLEAR_CHILD_RECORDS": {
			const { entityName } = action;
			if (!entityName) {
				return {
					...state,
					childRecords: {},
				};
			}

			const updatedChildRecords = { ...state.childRecords };
			delete updatedChildRecords[entityName];
			return {
				...state,
				childRecords: updatedChildRecords,
			};
		}

		case "ADD_NODE": {
			const { node } = action;
			const parentId = node.parentId;
			const parentNode = parentId ? state.nodesById[parentId] : null;

			return {
				...state,
				nodesById: {
					...state.nodesById,
					[node.id]: node,
					...(parentNode
						? {
								[parentId!]: {
									...parentNode,
									children: parentNode.children.includes(node.id) ? parentNode.children : [...parentNode.children, node.id],
								},
							}
						: {}),
				},
			};
		}

		case "UPDATE_NODE_DATA": {
			const { nodeId, data } = action;
			const node = state.nodesById[nodeId];
			if (!node) {
				return state;
			}

			return {
				...state,
				nodesById: {
					...state.nodesById,
					[nodeId]: {
						...node,
						data: { ...(node.data ?? {}), ...(data ?? {}) },
					},
				},
			};
		}

		case "RESET_NODE_DATA": {
			const { nodeId } = action;
			const node = state.nodesById[nodeId];
			if (!node) {
				return state;
			}

			return {
				...state,
				nodesById: {
					...state.nodesById,
					[nodeId]: {
						...node,
						data: {},
					},
				},
			};
		}

		case "UPDATE_NODE_RECORD_ID": {
			const { nodeId, recordId, isPersisted } = action;
			const node = state.nodesById[nodeId];
			if (!node) {
				return state;
			}

			return {
				...state,
				nodesById: {
					...state.nodesById,
					[nodeId]: {
						...node,
						recordId,
						isPersisted: isPersisted ?? Boolean(recordId && !isTempId(recordId)),
					},
				},
			};
		}

		case "REMOVE_NODE": {
			const { nodeId } = action;
			const node = state.nodesById[nodeId];
			if (!node) {
				return state;
			}

			const updatedNodes = { ...state.nodesById };
			const removeIds = new Set<string>();
			const stack = [nodeId];
			while (stack.length > 0) {
				const currentId = stack.pop();
				if (!currentId || removeIds.has(currentId)) {
					continue;
				}
				removeIds.add(currentId);
				const current = updatedNodes[currentId];
				current?.children?.forEach((childId) => stack.push(childId));
			}

			removeIds.forEach((id) => {
				delete updatedNodes[id];
			});

			if (node.parentId && updatedNodes[node.parentId]) {
				updatedNodes[node.parentId] = {
					...updatedNodes[node.parentId],
					children: updatedNodes[node.parentId].children.filter((childId) => childId !== nodeId),
				};
			}

			return {
				...state,
				nodesById: updatedNodes,
			};
		}

		case "SET_ENTITY_NODE": {
			const { entityName, nodeId } = action;
			return {
				...state,
				entityNodeIds: {
					...state.entityNodeIds,
					[entityName]: nodeId,
				},
			};
		}

		default:
			return state;
	}
};

/**
 * Custom hook for managing form state.
 * Provides field registration, value tracking, dirty tracking, and serialization for API submission.
 *
 * @param primaryEntityName - Logical name of the primary entity for this form
 * @param recordId - Record ID for updates (null for creates)
 * @returns Form state management functions and data
 *
 * @example
 * ```typescript
 * const { registerField, updateFieldValue, getChangedData, serializeForSubmission } = useFormState("eyfrcc_application", applicationId);
 *
 * // In a field component:
 * useEffect(() => {
 *   registerField("eyfrcc_name", {
 *     entityName: "eyfrcc_application",
 *     logicalName: "eyfrcc_name",
 *     schemaName: "eyfrcc_Name",
 *     dataType: DataType.SingleLineText
 *   }, "Initial Value");
 * }, []);
 *
 * // On field change:
 * const handleChange = (value) => {
 *   updateFieldValue("eyfrcc_name", value);
 * };
 *
 * // On form submit:
 * const changes = serializeForSubmission();
 * // Submit changes via API...
 * ```
 */
export const useFormState = (primaryEntityName: string, recordId: string | null = null) => {
	const rootNodeId = useMemo(() => generateTempId(), []);
	const [state, dispatch] = useReducer(formStateReducer, undefined, () => buildInitialFormState({ primaryEntityName, recordId, rootNodeId }));

	/**
	 * Registers a field with the form state.
	 * Should be called when a field component mounts.
	 */
	const registerField = useCallback(
		(path: string, metadata: FieldMetadata, initialValue?: any) => {
			dispatch({ type: "REGISTER_FIELD", path, metadata, initialValue });

			const existingNodeId = state.entityNodeIds[metadata.entityName];
			if (!existingNodeId) {
				const nodeId = generateTempId();
				const isPrimary = metadata.entityName === state.primaryEntityName;
				const node: FormStateNode = {
					id: nodeId,
					type: isPrimary ? "primary" : "secondary",
					logicalName: metadata.entityName,
					data: {},
					recordId: isPrimary ? state.recordId : null,
					isPersisted: isPrimary ? Boolean(state.recordId && !isTempId(state.recordId)) : false,
					parentId: isPrimary ? null : state.rootNodeId,
					children: [],
				};
				dispatch({ type: "ADD_NODE", node });
				dispatch({ type: "SET_ENTITY_NODE", entityName: metadata.entityName, nodeId });
			}
		},
		[state.entityNodeIds, state.primaryEntityName, state.recordId, state.rootNodeId]
	);

	/**
	 * Updates a field value and marks it as dirty.
	 */
	const updateFieldValue = useCallback(
		(path: string, value: any) => {
			dispatch({ type: "UPDATE_FIELD", path, value });
			const metadata = state.metadata[path];
			if (!metadata) {
				return;
			}

			const nodeId = state.entityNodeIds[metadata.entityName];
			if (nodeId) {
				dispatch({ type: "UPDATE_NODE_DATA", nodeId, data: { [metadata.logicalName]: value } });
			}
		},
		[state.entityNodeIds, state.metadata]
	);

	/**
	 * Sets the record ID (useful when transitioning from create to update after save).
	 */
	const setRecordId = useCallback((recordId: string | null) => {
		dispatch({ type: "SET_RECORD_ID", recordId });
	}, []);

	/**
	 * Sets the form instance ID.
	 */
	const setFormInstanceId = useCallback((formInstanceId: string | null) => {
		dispatch({ type: "SET_FORM_INSTANCE_ID", formInstanceId });
	}, []);

	/**
	 * Sets the user form session ID.
	 */
	const setUserFormSessionId = useCallback((userFormSessionId: string | null) => {
		dispatch({ type: "SET_USER_FORM_SESSION_ID", userFormSessionId });
	}, []);

	/**
	 * Resets dirty flags for specified fields or all fields.
	 */
	const resetDirty = useCallback((paths?: string[]) => {
		dispatch({ type: "RESET_DIRTY", paths });
	}, []);

	/**
	 * Resets the entire form state.
	 */
	const resetForm = useCallback(() => {
		dispatch({ type: "RESET_FORM" });
	}, []);

	/**
	 * Initializes form data from loaded record(s) without marking fields as dirty.
	 * Used when loading an existing record for editing.
	 */
	const initializeFormData = useCallback((fieldData: Map<string, any>) => {
		dispatch({ type: "INITIALIZE_FORM_DATA", fieldData });
	}, []);

	/**
	 * Tracks a related record ID for a secondary step entity.
	 */
	const setRelatedRecord = useCallback(
		(entityName: string, recordId: string, referencingAttribute?: string, referencingNavigationProperty?: string) => {
			const record: RelatedRecordInfo = {
				recordId,
				referencingAttribute,
				referencingNavigationProperty,
			};

			dispatch({ type: "SET_RELATED_RECORD", entityName, record });

			const nodeId = state.entityNodeIds[entityName];
			if (nodeId) {
				dispatch({ type: "UPDATE_NODE_RECORD_ID", nodeId, recordId, isPersisted: Boolean(recordId && !isTempId(recordId)) });
			} else {
				const newNodeId = generateTempId();
				const node: FormStateNode = {
					id: newNodeId,
					type: entityName === state.primaryEntityName ? "primary" : "secondary",
					logicalName: entityName,
					data: {},
					recordId,
					isPersisted: Boolean(recordId && !isTempId(recordId)),
					parentId: entityName === state.primaryEntityName ? null : state.rootNodeId,
					children: [],
				};
				dispatch({ type: "ADD_NODE", node });
				dispatch({ type: "SET_ENTITY_NODE", entityName, nodeId: newNodeId });
			}
		},
		[state.entityNodeIds, state.primaryEntityName, state.recordId, state.rootNodeId]
	);

	/**
	 * Retrieves related record info for a secondary step entity.
	 */
	const getRelatedRecord = useCallback(
		(entityName: string): RelatedRecordInfo | undefined => {
			return state.relatedRecords[entityName];
		},
		[state.relatedRecords]
	);

	/**
	 * Clears related record entries, optionally filtered by entity name.
	 */
	const clearRelatedRecords = useCallback((entityName?: string) => {
		dispatch({ type: "CLEAR_RELATED_RECORDS", entityName });
	}, []);

	/**
	 * Sets all child records for an entity.
	 */
	const setChildRecords = useCallback((entityName: string, records: Entity[]) => {
		dispatch({ type: "SET_CHILD_RECORDS", entityName, records });
	}, []);

	/**
	 * Adds or updates a child record for an entity.
	 */
	const upsertChildRecord = useCallback((entityName: string, record: Entity) => {
		dispatch({ type: "UPSERT_CHILD_RECORD", entityName, record });
	}, []);

	/**
	 * Clears child records, optionally filtered by entity name.
	 */
	const clearChildRecords = useCallback((entityName?: string) => {
		dispatch({ type: "CLEAR_CHILD_RECORDS", entityName });
	}, []);

	/**
	 * Gets child records for an entity.
	 */
	const getChildRecords = useCallback(
		(entityName: string): Entity[] => {
			return Object.values(state.childRecords[entityName] || {});
		},
		[state.childRecords]
	);

	/**
	 * Adds or updates a child node under a parent entity node.
	 */
	const upsertChildNode = useCallback(
		({
			parentEntityName,
			childEntityName,
			data,
			recordId,
			referencingAttribute,
			referencingNavigationProperty,
			isPersisted,
		}: {
			parentEntityName: string;
			childEntityName: string;
			data: Partial<Entity>;
			recordId?: string;
			referencingAttribute: string;
			referencingNavigationProperty?: string;
			isPersisted?: boolean;
		}) => {
			let parentNodeId = state.entityNodeIds[parentEntityName];
			if (!parentNodeId) {
				const newParentId = generateTempId();
				const isPrimary = parentEntityName === state.primaryEntityName;
				const parentNode: FormStateNode = {
					id: newParentId,
					type: isPrimary ? "primary" : "secondary",
					logicalName: parentEntityName,
					data: {},
					recordId: isPrimary ? state.recordId : null,
					isPersisted: isPrimary ? Boolean(state.recordId && !isTempId(state.recordId)) : false,
					parentId: isPrimary ? null : state.rootNodeId,
					children: [],
				};
				dispatch({ type: "ADD_NODE", node: parentNode });
				dispatch({ type: "SET_ENTITY_NODE", entityName: parentEntityName, nodeId: newParentId });
				parentNodeId = newParentId;
			}

			const existingNodeId = (Object.values(state.nodesById) as FormStateNode[]).find(
				(node) => node.type === "child" && node.logicalName === childEntityName && node.recordId === recordId
			)?.id;

			if (existingNodeId) {
				dispatch({ type: "UPDATE_NODE_DATA", nodeId: existingNodeId, data });
				return existingNodeId;
			}

			const nodeId = recordId || generateTempId();
			const node: FormStateNode = {
				id: nodeId,
				type: "child",
				logicalName: childEntityName,
				data: { ...data },
				recordId: recordId ?? null,
				isPersisted: isPersisted ?? Boolean(recordId && !isTempId(recordId)),
				referencingAttribute,
				referencingNavigationProperty,
				parentId: parentNodeId,
				children: [],
			};
			dispatch({ type: "ADD_NODE", node });
			return nodeId;
		},
		[state.entityNodeIds, state.nodesById, state.primaryEntityName, state.recordId, state.rootNodeId]
	);

	const updateNodeData = useCallback((nodeId: string, data: Partial<Entity>) => {
		dispatch({ type: "UPDATE_NODE_DATA", nodeId, data });
	}, []);

	const updateNodeRecordId = useCallback((nodeId: string, recordId: string | null, isPersisted?: boolean) => {
		dispatch({ type: "UPDATE_NODE_RECORD_ID", nodeId, recordId, isPersisted });
	}, []);

	const resetNodeData = useCallback((nodeId: string) => {
		dispatch({ type: "RESET_NODE_DATA", nodeId });
	}, []);

	const deleteNode = useCallback((nodeId: string) => {
		dispatch({ type: "REMOVE_NODE", nodeId });
	}, []);

	const getChildNodes = useCallback(
		(entityName: string): FormStateNode[] => {
			return (Object.values(state.nodesById) as FormStateNode[]).filter((node) => node.type === "child" && node.logicalName === entityName);
		},
		[state.nodesById]
	);

	const ensureEntityNode = useCallback(
		(entityName: string): FormStateNode | undefined => {
			const nodeId = state.entityNodeIds[entityName];
			if (nodeId) {
				return state.nodesById[nodeId];
			}

			const newNodeId = generateTempId();
			const isPrimary = entityName === state.primaryEntityName;
			const node: FormStateNode = {
				id: newNodeId,
				type: isPrimary ? "primary" : "secondary",
				logicalName: entityName,
				data: {},
				recordId: isPrimary ? state.recordId : null,
				isPersisted: isPrimary ? Boolean(state.recordId && !isTempId(state.recordId)) : false,
				parentId: isPrimary ? null : state.rootNodeId,
				children: [],
			};
			dispatch({ type: "ADD_NODE", node });
			dispatch({ type: "SET_ENTITY_NODE", entityName, nodeId: newNodeId });
			return node;
		},
		[state.entityNodeIds, state.nodesById, state.primaryEntityName, state.recordId, state.rootNodeId]
	);

	const getNodeById = useCallback(
		(nodeId: string): FormStateNode | undefined => {
			return state.nodesById[nodeId];
		},
		[state.nodesById]
	);

	const getEntityNode = useCallback(
		(entityName: string): FormStateNode | undefined => {
			const nodeId = state.entityNodeIds[entityName];
			return nodeId ? state.nodesById[nodeId] : undefined;
		},
		[state.entityNodeIds, state.nodesById]
	);

	const findNodeByRecordId = useCallback(
		(entityName: string, recordId?: string | null): FormStateNode | undefined => {
			if (!recordId) {
				return undefined;
			}
			return (Object.values(state.nodesById) as FormStateNode[]).find(
				(node) => node.logicalName === entityName && (node.recordId === recordId || node.id === recordId)
			);
		},
		[state.nodesById]
	);

	const addUploadNode = useCallback(
		({
			parentNodeId,
			entityName,
			folderName,
			file,
			uploadDate,
			childRecordId,
		}: {
			parentNodeId: string;
			entityName: string;
			folderName: string;
			file: File;
			uploadDate: string;
			childRecordId?: string;
		}) => {
			const nodeId = generateTempId();
			const node: FormStateNode = {
				id: nodeId,
				type: "upload",
				logicalName: entityName,
				data: {
					folderName,
					file,
					uploadDate,
					childRecordId,
				} as UploadNodeData,
				recordId: null,
				isPersisted: false,
				parentId: parentNodeId,
				children: [],
			};
			dispatch({ type: "ADD_NODE", node });
			return nodeId;
		},
		[]
	);

	const getUploadNodes = useCallback(
		({ parentNodeId, entityName, folderName }: { parentNodeId?: string; entityName?: string; folderName?: string }) => {
			const nodes = (Object.values(state.nodesById) as FormStateNode[]).filter((node) => node.type === "upload");
			return nodes.filter((node) => {
				if (parentNodeId && node.parentId !== parentNodeId) {
					return false;
				}
				if (entityName && node.logicalName !== entityName) {
					return false;
				}
				const data = node.data as UploadNodeData;
				if (folderName && data.folderName !== folderName) {
					return false;
				}
				return true;
			});
		},
		[state.nodesById]
	);

	/**
	 * Gets all dirty field values grouped by entity.
	 * Returns an array of EntityChanges objects ready for API submission.
	 */
	const getChangedData = useCallback((): EntityChanges[] => {
		const changedByEntity = new Map<string, { data: Partial<Entity>; metadata: Record<string, FieldMetadata> }>();

		// Group dirty fields by entity
		const fieldEntries = Object.entries(state.fields) as Array<[string, FieldValue]>;
		fieldEntries.forEach(([path, fieldValue]) => {
			if (!fieldValue.isDirty) return;

			const metadata = state.metadata[path];
			if (!metadata) return;

			const entityName = metadata.entityName;
			if (!changedByEntity.has(entityName)) {
				changedByEntity.set(entityName, { data: {}, metadata: {} });
			}

			const entityChanges = changedByEntity.get(entityName)!;
			entityChanges.data[metadata.logicalName] = fieldValue.value;
			entityChanges.metadata[metadata.logicalName] = metadata;
		});

		// Convert to EntityChanges array
		const changes: EntityChanges[] = [];
		changedByEntity.forEach((value, entityName) => {
			changes.push({
				entityName,
				entitySetName: resolveEntitySetName(entityName),
				recordId: entityName === state.primaryEntityName ? (state.recordId ?? undefined) : undefined,
				data: value.data,
				metadata: value.metadata,
			});
		});

		return changes;
	}, [state.fields, state.metadata, state.primaryEntityName, state.recordId]);

	/**
	 * Serializes changed data for API submission.
	 * Groups changes by entity and applies serializeForApi transformation.
	 */
	const serializeForSubmission = useCallback((): EntityChanges[] => {
		const changes = getChangedData();

		// Apply serialization to each entity's data
		return changes.map((change) => ({
			...change,
			data: serializeForApi(change.data, change.entityName),
		}));
	}, [getChangedData]);

	/**
	 * Gets the current value of a field.
	 */
	const getFieldValue = useCallback(
		(path: string): any => {
			return state.fields[path]?.value ?? null;
		},
		[state.fields]
	);

	/**
	 * Gets the metadata for a field path.
	 */
	const getFieldMetadata = useCallback(
		(path: string): FieldMetadata | undefined => {
			return state.metadata[path];
		},
		[state.metadata]
	);

	/**
	 * Checks if a field is dirty.
	 */
	const isFieldDirty = useCallback(
		(path: string): boolean => {
			return state.fields[path]?.isDirty ?? false;
		},
		[state.fields]
	);

	/**
	 * Gets all dirty field paths.
	 */
	const dirtyFields = useMemo(() => {
		const fieldEntries = Object.entries(state.fields) as Array<[string, FieldValue]>;
		return fieldEntries.filter(([, field]) => field.isDirty).map(([path]) => path);
	}, [state.fields]);

	/**
	 * Checks if any fields are dirty.
	 */
	const hasChanges = useMemo(() => {
		return dirtyFields.length > 0;
	}, [dirtyFields.length]);

	/**
	 * Checks if there are any pending child operations.
	 */
	const hasPendingChildren = useMemo(() => {
		return (Object.values(state.nodesById) as FormStateNode[]).some((node) => {
			if (node.type !== "child") {
				return false;
			}
			const hasData = node.data && Object.keys(node.data).length > 0;
			return !node.isPersisted || hasData;
		});
	}, [state.nodesById]);

	const hasPendingDocumentUploads = useMemo(() => {
		return (Object.values(state.nodesById) as FormStateNode[]).some((node) => node.type === "upload");
	}, [state.nodesById]);

	const hasPendingUploads = useMemo(() => {
		return hasPendingChildren || hasPendingDocumentUploads;
	}, [hasPendingChildren, hasPendingDocumentUploads]);

	const getSaveTree = useCallback((): FormStateTreeNode | null => {
		const buildTree = (nodeId: string): FormStateTreeNode | null => {
			const node = state.nodesById[nodeId];
			if (!node) {
				return null;
			}

			return {
				...node,
				children: node.children.map((childId) => buildTree(childId)).filter((child): child is FormStateTreeNode => Boolean(child)),
			};
		};

		return buildTree(state.rootNodeId);
	}, [state.nodesById, state.rootNodeId]);

	return {
		type: "main",
		// State
		recordId: state.recordId,
		primaryEntityName: state.primaryEntityName,
		formInstanceId: state.formInstanceId,
		userFormSessionId: state.userFormSessionId,
		relatedRecords: state.relatedRecords,
		childRecords: state.childRecords,
		rootNodeId: state.rootNodeId,
		nodesById: state.nodesById,
		entityNodeIds: state.entityNodeIds,
		hasChanges,
		hasPendingChildren,
		hasPendingDocumentUploads,
		hasPendingUploads,
		dirtyFields,

		// Actions
		registerField,
		updateFieldValue,
		setRecordId,
		setFormInstanceId,
		setUserFormSessionId,
		resetDirty,
		resetForm,
		initializeFormData,
		setRelatedRecord,
		getRelatedRecord,
		clearRelatedRecords,
		setChildRecords,
		upsertChildRecord,
		clearChildRecords,
		getChildRecords,

		// Tree operations
		upsertChildNode,
		updateNodeData,
		updateNodeRecordId,
		resetNodeData,
		deleteNode,
		getChildNodes,
		ensureEntityNode,
		getNodeById,
		getEntityNode,
		findNodeByRecordId,

		// Upload operations
		addUploadNode,
		getUploadNodes,

		// Getters
		getFieldValue,
		getFieldMetadata,
		isFieldDirty,
		getChangedData,
		serializeForSubmission,
		getSaveTree,
	};
};
