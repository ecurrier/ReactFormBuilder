import { useReducer, useCallback, useMemo } from "react";
import type { FormState, FormStateAction, FieldMetadata, EntityChanges, PendingChildRecord, RelatedRecordInfo } from "../types/FormState";
import type { Entity } from "../types/Entity";
import { serializeForApi, getEntitySetName } from "../utilities";

/**
 * Initial form state.
 */
const initialFormState: FormState = {
	fields: {},
	metadata: {},
	recordId: null,
	primaryEntityName: "",
	relatedRecords: {},
	pendingChildRecords: {},
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
			return {
				...state,
				recordId: action.recordId,
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
			return initialFormState;
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

		case "ADD_PENDING_CHILD": {
			const { record } = action;
			const key = `${record.entityName}_${record.id}`;
			return {
				...state,
				pendingChildRecords: {
					...state.pendingChildRecords,
					[key]: record,
				},
			};
		}

		case "UPDATE_PENDING_CHILD": {
			const { key, data } = action;
			const existing = state.pendingChildRecords[key];
			if (!existing) return state;

			return {
				...state,
				pendingChildRecords: {
					...state.pendingChildRecords,
					[key]: {
						...existing,
						data: { ...existing.data, ...data },
					},
				},
			};
		}

		case "DELETE_PENDING_CHILD": {
			const { key } = action;
			const updatedPending = { ...state.pendingChildRecords };
			delete updatedPending[key];
			return {
				...state,
				pendingChildRecords: updatedPending,
			};
		}

		case "CLEAR_PENDING_CHILDREN": {
			const { entityName } = action;
			if (!entityName) {
				// Clear all
				return {
					...state,
					pendingChildRecords: {},
				};
			} else {
				// Clear specific entity
				const updatedPending = { ...state.pendingChildRecords };
				Object.keys(updatedPending).forEach((key) => {
					if (key.startsWith(`${entityName}_`)) {
						delete updatedPending[key];
					}
				});
				return {
					...state,
					pendingChildRecords: updatedPending,
				};
			}
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
	const [state, dispatch] = useReducer(formStateReducer, {
		...initialFormState,
		primaryEntityName,
		recordId,
	});

	/**
	 * Registers a field with the form state.
	 * Should be called when a field component mounts.
	 */
	const registerField = useCallback((path: string, metadata: FieldMetadata, initialValue?: any) => {
		dispatch({ type: "REGISTER_FIELD", path, metadata, initialValue });
	}, []);

	/**
	 * Updates a field value and marks it as dirty.
	 */
	const updateFieldValue = useCallback((path: string, value: any) => {
		dispatch({ type: "UPDATE_FIELD", path, value });
	}, []);

	/**
	 * Sets the record ID (useful when transitioning from create to update after save).
	 */
	const setRecordId = useCallback((recordId: string | null) => {
		dispatch({ type: "SET_RECORD_ID", recordId });
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
		},
		[]
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
	 * Adds a pending child record (for new records before parent exists).
	 */
	const addPendingChildRecord = useCallback((record: PendingChildRecord) => {
		dispatch({ type: "ADD_PENDING_CHILD", record });
	}, []);

	/**
	 * Updates data for a pending child record.
	 */
	const updatePendingChildRecord = useCallback((key: string, data: Partial<Entity>) => {
		dispatch({ type: "UPDATE_PENDING_CHILD", key, data });
	}, []);

	/**
	 * Deletes a pending child record.
	 */
	const deletePendingChildRecord = useCallback((key: string) => {
		dispatch({ type: "DELETE_PENDING_CHILD", key });
	}, []);

	/**
	 * Gets all pending child records for a specific entity.
	 */
	const getPendingChildRecords = useCallback(
		(entityName: string): PendingChildRecord[] => {
			return Object.entries(state.pendingChildRecords)
				.filter(([key]) => key.startsWith(`${entityName}_`))
				.map(([_, record]) => record);
		},
		[state.pendingChildRecords]
	);

	/**
	 * Clears pending child records, optionally filtered by entity name.
	 */
	const clearPendingChildRecords = useCallback((entityName?: string) => {
		dispatch({ type: "CLEAR_PENDING_CHILDREN", entityName });
	}, []);

	/**
	 * Gets all dirty field values grouped by entity.
	 * Returns an array of EntityChanges objects ready for API submission.
	 */
	const getChangedData = useCallback((): EntityChanges[] => {
		const changedByEntity = new Map<string, { data: Partial<Entity>; metadata: Record<string, FieldMetadata> }>();

		// Group dirty fields by entity
		Object.entries(state.fields).forEach(([path, fieldValue]) => {
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
				entitySetName: getEntitySetName(entityName),
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
		return Object.entries(state.fields)
			.filter(([_, field]) => field.isDirty)
			.map(([path]) => path);
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
		return Object.keys(state.pendingChildRecords).length > 0;
	}, [state.pendingChildRecords]);

	return {
		// State
		recordId: state.recordId,
		primaryEntityName: state.primaryEntityName,
		relatedRecords: state.relatedRecords,
		pendingChildRecords: state.pendingChildRecords,
		hasChanges,
		hasPendingChildren,
		dirtyFields,

		// Actions
		registerField,
		updateFieldValue,
		setRecordId,
		resetDirty,
		resetForm,
		initializeFormData,
		setRelatedRecord,
		getRelatedRecord,
		clearRelatedRecords,

		// Pending child record operations
		addPendingChildRecord,
		updatePendingChildRecord,
		deletePendingChildRecord,
		getPendingChildRecords,
		clearPendingChildRecords,

		// Getters
		getFieldValue,
		getFieldMetadata,
		isFieldDirty,
		getChangedData,
		serializeForSubmission,
	};
};
