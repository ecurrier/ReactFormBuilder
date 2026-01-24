import type {
	Entity,
	EntityReference,
	FieldMetadata,
	FormStateTreeNode,
	UploadNodeData,
	ReactConfigurationIdentifierMetadata,
	ReactFormConfiguration,
	SaveError,
	SaveProgressEvent,
	SaveResult,
} from "@app-types";
import {
	createRecord,
	updateRecord,
	validateField,
	createFormInstance,
	createUserFormSession,
	uploadDocumentForRecord,
	loadChildRecords,
	loadRecordData,
} from "@services";
import {
	isTempId,
	sanitizeGuid,
	buildEntityMetadataMap,
	resolvePrimaryIdAttribute,
	resolveRequestorId,
	serializeForApi,
	type TableMetadataEntry,
} from "@utilities";
import { ConfigurationIdentifiers } from "@/constants/configurationIdentifiers";

export interface SaveContext {
	formState: any;
	config: ReactFormConfiguration;
	urlParams: any;
	onProgress?: (event: SaveProgressEvent) => void;
}

const buildErrorMessage = (error: unknown): string => {
	if (error instanceof Error) {
		return error.message;
	}

	return String(error);
};

const reportProgress = (onProgress: SaveContext["onProgress"], event: SaveProgressEvent): void => {
	onProgress?.(event);
};

const buildProgressId = (scope: SaveProgressEvent["scope"], entityName: string, recordId?: string) => {
	if (recordId) {
		return `${scope}:${entityName}:${recordId}`;
	}

	return `${scope}:${entityName}`;
};

const buildSaveError = (error: SaveError["phase"], message: string, entityName?: string, recordId?: string): SaveError => ({
	phase: error,
	message,
	entityName,
	recordId,
});

const buildStepReferenceMap = (config: ReactFormConfiguration, primaryEntity?: string) => {
	const stepReferenceByEntity = new Map<string, { navigationProperty?: string; referencingAttribute?: string }>();

	if (config.Form?.Steps) {
		config.Form.Steps.forEach((step: any) => {
			if (!step.EntityLogicalName || step.EntityLogicalName === primaryEntity) {
				return;
			}

			if (!stepReferenceByEntity.has(step.EntityLogicalName)) {
				stepReferenceByEntity.set(step.EntityLogicalName, {
					navigationProperty: step.ReferencingNavigationProperty || step.ReferencingAttribute || step.ReferencingAttributeLogicalName,
					referencingAttribute: step.ReferencingAttribute || step.ReferencingAttributeLogicalName,
				});
			}
		});
	}

	return stepReferenceByEntity;
};

const normalizeConfigurationIdentifierMetadata = (
	metadata: ReactConfigurationIdentifierMetadata | ReactConfigurationIdentifierMetadata[]
): ReactConfigurationIdentifierMetadata[] => {
	if (Array.isArray(metadata)) {
		return metadata;
	}

	if (!metadata) {
		return [];
	}

	return [metadata];
};

// TO-DO: Should probably do something to make this configurable within Dataverse
const resolveDefaultLookupValue = (identifier: string, config: ReactFormConfiguration): EntityReference | null => {
	switch (identifier) {
		case ConfigurationIdentifiers.Form:
			return config.Form?.Id ? { id: config.Form.Id, logicalName: "eyfrcc_form" } : null;
		case ConfigurationIdentifiers.FundingOpportunity:
		case ConfigurationIdentifiers.ApplicationType:
			return config.FundingOpportunity?.Id ? { id: config.FundingOpportunity.Id, logicalName: "eyfrcc_applicationtype" } : null;
		case ConfigurationIdentifiers.Requestor: {
			const contactId = resolveRequestorId();
			return contactId ? { id: contactId, logicalName: "contact" } : null;
		}
		default:
			return null;
	}
};

// TO-DO: Should probably do something to make this configurable within Dataverse
const buildDefaultOnCreateData = (entityName: string, config: ReactFormConfiguration): Partial<Entity> => {
	const tableMetadata = config.Form?.TableMetadata?.[entityName] ?? config.TableMetadata?.[entityName];
	const actions = tableMetadata?.DefaultOnCreateActions ?? [];
	const defaults: Partial<Entity> = {};

	actions.forEach((action) => {
		const metadataEntries = normalizeConfigurationIdentifierMetadata(action.ConfigurationIdentifierMetadata);
		metadataEntries.forEach((metadata) => {
			const identifier = metadata.ConfigurationIdentifier;
			if (!identifier) {
				return;
			}

			const lookupValue = resolveDefaultLookupValue(identifier, config);
			if (!lookupValue) {
				return;
			}

			const targetField = metadata.NavigationPropertyName || metadata.FieldLogicalName;
			if (!targetField || defaults[targetField] !== undefined) {
				return;
			}

			defaults[targetField] = metadata.NavigationPropertyName ? lookupValue : lookupValue.id;
		});
	});

	return defaults;
};

const mergeDefaultOnCreateData = (data: Partial<Entity>, defaults: Partial<Entity>): Partial<Entity> => {
	const merged = { ...data };
	Object.entries(defaults).forEach(([key, value]) => {
		if (merged[key] === undefined) {
			merged[key] = value;
		}
	});

	return merged;
};

const buildSecondaryRecordsPayload = (recordIdsByEntity: Map<string, string>, primaryEntity?: string) => {
	const secondaryRecords: Array<{ LogicalName: string; Id: string }> = [];

	recordIdsByEntity.forEach((recordId, entityName) => {
		if (entityName === primaryEntity) {
			return;
		}

		secondaryRecords.push({ LogicalName: entityName, Id: recordId });
	});

	return secondaryRecords;
};

const shouldPersistEntityNode = (node: FormStateTreeNode) => {
	if (node.type === "upload") {
		return false;
	}

	const data = node.data ?? {};
	const hasData = Object.keys(data).length > 0;
	const hasChildren = node.children.length > 0;

	return hasData || (!node.isPersisted && hasChildren);
};

const saveUploadNode = async ({
	node,
	parentNode,
	onProgress,
	formState,
}: {
	node: FormStateTreeNode;
	parentNode: FormStateTreeNode | null;
	onProgress: SaveContext["onProgress"];
	formState: any;
}): Promise<SaveError[]> => {
	const uploadData = node.data as UploadNodeData;
	const parentId = parentNode?.recordId;
	const parentEntityName = node.logicalName || parentNode?.logicalName;

	if (!parentId || !parentEntityName) {
		return [buildSaveError("upload", "Missing parent record for upload", parentEntityName)];
	}

	const progressId = buildProgressId("upload", parentEntityName, node.id);
	reportProgress(onProgress, {
		id: progressId,
		scope: "upload",
		entityName: parentEntityName,
		label: uploadData?.file?.name || node.id,
		status: "saving",
	});

	try {
		const childId = uploadData?.childRecordId && uploadData.childRecordId !== parentId ? uploadData.childRecordId : undefined;
		await uploadDocumentForRecord({
			entityName: parentEntityName,
			recordId: parentId,
			folderName: uploadData.folderName,
			file: uploadData.file,
			uploadDate: uploadData.uploadDate,
			childId,
		});

		formState.deleteNode?.(node.id);

		reportProgress(onProgress, {
			id: progressId,
			scope: "upload",
			entityName: parentEntityName,
			status: "saved",
		});
		return [];
	} catch (error) {
		reportProgress(onProgress, {
			id: progressId,
			scope: "upload",
			entityName: parentEntityName,
			status: "failed",
			message: buildErrorMessage(error),
		});
		return [buildSaveError("upload", `Failed to upload document: ${buildErrorMessage(error)}`, parentEntityName, node.id)];
	}
};

const saveEntityNode = async ({
	node,
	parentNode,
	formState,
	primaryEntity,
	stepReferenceByEntity,
	config,
	entityMetadataMap,
	recordIdsByEntity,
	onProgress,
}: {
	node: FormStateTreeNode;
	parentNode: FormStateTreeNode | null;
	formState: any;
	primaryEntity?: string;
	stepReferenceByEntity: Map<string, { navigationProperty?: string; referencingAttribute?: string }>;
	config: ReactFormConfiguration;
	entityMetadataMap: Map<string, TableMetadataEntry>;
	recordIdsByEntity: Map<string, string>;
	onProgress: SaveContext["onProgress"];
}): Promise<{ recordId: string | null; errors: SaveError[] }> => {
	const errors: SaveError[] = [];
	const entityName = node.logicalName;

	if (!entityName) {
		return { recordId: null, errors: [buildSaveError("save", "Missing entity name for node")] };
	}

	const progressId = buildProgressId(node.type, entityName, node.id);
	reportProgress(onProgress, { id: progressId, scope: node.type, entityName, status: "saving" });
	let didReportFailure = false;

	try {
		const defaults = buildDefaultOnCreateData(entityName, config);
		const serializedData = serializeForApi(node.data ?? {}, entityName);
		const dataToSave = mergeDefaultOnCreateData({ ...(serializedData as any) }, defaults);
		const shouldPersist = shouldPersistEntityNode(node);
		let recordId = node.recordId ?? null;

		if (node.type === "primary") {
			if (shouldPersist) {
				if (recordId) {
					await updateRecord(entityName, recordId, dataToSave);
				} else {
					recordId = await createRecord(entityName, dataToSave);
					if (!recordId) {
						throw new Error("Failed to create primary record");
					}
					formState.setRecordId?.(recordId);
				}
			}
		} else if (node.type === "secondary") {
			const referenceInfo = stepReferenceByEntity.get(entityName);
			const navigationProperty = referenceInfo?.navigationProperty;
			const parentId = parentNode?.recordId;

			if (!recordId && navigationProperty && parentId && dataToSave[navigationProperty] === undefined) {
				dataToSave[navigationProperty] = {
					id: parentId,
					logicalName: primaryEntity,
				};
			}

			if (!recordId && !navigationProperty) {
				throw new Error(`Missing referencing navigation property for ${entityName}`);
			}

			if (shouldPersist) {
				if (recordId) {
					await updateRecord(entityName, recordId, dataToSave);
				} else {
					recordId = await createRecord(entityName, dataToSave);
					if (!recordId) {
						throw new Error(`Failed to create record for ${entityName}`);
					}
				}
			}

			if (recordId) {
				formState.setRelatedRecord?.(entityName, recordId, referenceInfo?.referencingAttribute, navigationProperty);
			}
		} else if (node.type === "child") {
			const parentId = parentNode?.recordId;
			const navigationProperty = node.referencingNavigationProperty || node.referencingAttribute;

			if (!navigationProperty) {
				throw new Error(`Missing referencing navigation property for ${entityName}`);
			}

			if (!parentId) {
				throw new Error(`Missing parent record for ${entityName}`);
			}

			const primaryIdAttribute = resolvePrimaryIdAttribute(entityName, entityMetadataMap);
			if (node.id && isTempId(node.id) && dataToSave[primaryIdAttribute] === undefined) {
				const sanitizedId = sanitizeGuid(node.id);
				dataToSave[primaryIdAttribute] = sanitizedId;
			}

			dataToSave[navigationProperty] = {
				id: parentId,
				logicalName: parentNode?.logicalName,
			};

			if (shouldPersist) {
				if (recordId && node.isPersisted) {
					await updateRecord(entityName, recordId, dataToSave);
				} else {
					recordId = await createRecord(entityName, dataToSave);
					if (!recordId) {
						throw new Error(`Failed to create child record for ${entityName}`);
					}
				}
			}

			if (recordId) {
				formState.upsertChildRecord?.(entityName, { id: recordId, ...dataToSave });
			}
		}

		if (recordId) {
			formState.updateNodeRecordId?.(node.id, recordId, true);
			if (node.type === "primary" || node.type === "secondary") {
				recordIdsByEntity.set(entityName, recordId);
			}
		}

		if (Object.keys(serializedData || {}).length > 0) {
			formState.resetNodeData?.(node.id);
		}

		reportProgress(onProgress, { id: progressId, scope: node.type, entityName, status: "saved" });
		return { recordId, errors };
	} catch (error) {
		if (!didReportFailure) {
			reportProgress(onProgress, {
				id: progressId,
				scope: node.type,
				entityName,
				status: "failed",
				message: buildErrorMessage(error),
			});
			didReportFailure = true;
		}
		errors.push(buildSaveError(node.type, buildErrorMessage(error), entityName, node.id));
		return { recordId: null, errors };
	}
};

const ensureFormInstanceAndSession = async ({
	formState,
	config,
	urlParams,
	primaryEntity,
	primaryRecordId,
	recordIdsByEntity,
}: {
	formState: any;
	config: ReactFormConfiguration;
	urlParams: any;
	primaryEntity?: string;
	primaryRecordId: string | null;
	recordIdsByEntity: Map<string, string>;
}) => {
	const resolvedPrimaryRecordId = primaryRecordId || formState.recordId || urlParams?.recordId;
	const primaryRecordLogicalName = urlParams?.recordLogicalName || primaryEntity;
	const versionId = urlParams?.versionId;

	if (!resolvedPrimaryRecordId || !primaryRecordLogicalName) {
		return;
	}

	const secondaryRecords = buildSecondaryRecordsPayload(recordIdsByEntity, primaryEntity);

	let formInstanceId = formState.formInstanceId;

	if (formInstanceId) {
		await updateRecord("eyfrcc_forminstance", formInstanceId, {
			eyfrcc_primaryrecordid: resolvedPrimaryRecordId,
			eyfrcc_primaryrecordlogicalname: primaryRecordLogicalName,
			eyfrcc_secondaryrecords: JSON.stringify(secondaryRecords),
		});
	} else if (versionId) {
		formInstanceId = await createFormInstance({
			versionId,
			primaryRecordId: resolvedPrimaryRecordId,
			primaryRecordLogicalName,
			secondaryRecords,
		});

		if (!formInstanceId) {
			throw new Error("Failed to create form instance");
		}

		formState.setFormInstanceId?.(formInstanceId);
	}

	if (!formInstanceId || formState.userFormSessionId) {
		return;
	}

	const contactId = resolveRequestorId();
	if (!contactId) {
		return;
	}

	const sessionId = await createUserFormSession({
		formInstanceId,
		contactId,
		lastActive: new Date(),
	});

	if (sessionId) {
		formState.setUserFormSessionId?.(sessionId);
	}
};

/**
 * Execute save operation.
 * Saves only dirty fields without validation.
 *
 * @param context - Save context containing form state and configuration
 * @returns Save result with success status and any errors
 */
export async function executeSave(context: SaveContext): Promise<SaveResult> {
	const { formState, config, onProgress } = context;
	const errors: SaveError[] = [];
	const entityMetadataMap = buildEntityMetadataMap(config);

	// TO-DO: Add helper file for some of the methods in here like hasWork, seedRecordIds, processNode, etc.
	try {
		const primaryEntity = config.Form?.PrimaryApplicationTable?.TableLogicalName;
		const stepReferenceByEntity = buildStepReferenceMap(config, primaryEntity);
		const saveTree: FormStateTreeNode | null = formState.getSaveTree?.();

		const hasWork = (node: FormStateTreeNode | null): boolean => {
			if (!node) {
				return false;
			}

			if (node.type === "upload" || shouldPersistEntityNode(node)) {
				return true;
			}

			return node.children.some((child) => hasWork(child));
		};

		if (!saveTree || !hasWork(saveTree)) {
			return {
				success: true,
				message: "No changes to save",
			};
		}

		const recordIdsByEntity = new Map<string, string>();
		const seedRecordIds = (node: FormStateTreeNode | null) => {
			if (!node) {
				return;
			}

			if (node.type === "primary" && node.recordId && primaryEntity) {
				recordIdsByEntity.set(primaryEntity, node.recordId);
			}

			if (node.type === "secondary" && node.logicalName && node.recordId) {
				recordIdsByEntity.set(node.logicalName, node.recordId);
			}

			node.children.forEach((child) => seedRecordIds(child));
		};

		seedRecordIds(saveTree);

		const processNode = async (node: FormStateTreeNode, parentNode: FormStateTreeNode | null): Promise<SaveError[]> => {
			if (node.type === "upload") {
				return await saveUploadNode({ node, parentNode, onProgress, formState });
			}

			const nodeErrors: SaveError[] = [];
			let resolvedRecordId = node.recordId ?? null;

			if (shouldPersistEntityNode(node)) {
				const nodeResult = await saveEntityNode({
					node,
					parentNode,
					formState,
					primaryEntity,
					stepReferenceByEntity,
					config,
					entityMetadataMap,
					recordIdsByEntity,
					onProgress,
				});
				nodeErrors.push(...nodeResult.errors);
				resolvedRecordId = nodeResult.recordId ?? resolvedRecordId;
			}

			if (!resolvedRecordId && node.children.length > 0) {
				nodeErrors.push(buildSaveError(node.type, `Missing parent record for ${node.logicalName}`, node.logicalName, node.id));
				return nodeErrors;
			}

			const updatedNode: FormStateTreeNode = {
				...node,
				recordId: resolvedRecordId,
			};

			const childResults = await Promise.allSettled(node.children.map((child) => processNode(child, updatedNode)));

			childResults.forEach((result) => {
				if (result.status === "fulfilled") {
					nodeErrors.push(...result.value);
				} else {
					nodeErrors.push(buildSaveError("save", buildErrorMessage(result.reason), node.logicalName));
				}
			});

			return nodeErrors;
		};

		errors.push(...(await processNode(saveTree, null)));

		const primaryRecordId = recordIdsByEntity.get(primaryEntity || "") || formState.recordId;

		if (primaryRecordId) {
			try {
				await ensureFormInstanceAndSession({
					formState,
					config,
					urlParams: context.urlParams,
					primaryEntity,
					primaryRecordId,
					recordIdsByEntity,
				});
			} catch (error) {
				errors.push(buildSaveError("save", buildErrorMessage(error), primaryEntity));
			}
		}

		if (errors.length === 0) {
			formState.resetDirty();
		}

		return {
			success: errors.length === 0,
			recordId: primaryRecordId || undefined,
			errors: errors.length > 0 ? errors : undefined,
		};
	} catch (error) {
		console.error("Save draft failed:", error);
		const message = buildErrorMessage(error);
		return {
			success: false,
			errors: [buildSaveError("save", message)],
		};
	}
}

/**
 * Execute validate and submit operation.
 * Runs all field validations before saving.
 *
 * @param context - Save context containing form state and configuration
 * @returns Save result with success status and any errors
 */
export async function executeValidateAndSubmit(context: SaveContext): Promise<SaveResult> {
	const { formState, config } = context;
	const validationErrors: SaveError[] = [];

	try {
		// Step 1: Run all field validators
		const allFields = Object.entries(formState.metadata || {}) as Array<[string, FieldMetadata]>;

		for (const [fieldPath, metadata] of allFields) {
			const fieldValue = formState.getFieldValue(fieldPath);

			// Find field configuration to get validation rules
			let fieldConfig: any = null;
			config.Form?.Steps?.forEach((step: any) => {
				step.Actions?.forEach((action: any) => {
					if (action.Properties?.LogicalName === metadata.logicalName) {
						fieldConfig = action.Properties;
					}
				});
			});

			if (fieldConfig) {
				const validationResult = validateField(fieldValue, fieldConfig);

				if (validationResult.isValid === false) {
					validationErrors.push({
						phase: "validation",
						message: `${fieldConfig.Label || metadata.logicalName}: ${validationResult.message || "Validation failed"}`,
						entityName: metadata.entityName,
					});
				}
			}
		}

		// Step 2: If validation fails, return errors
		if (validationErrors.length > 0) {
			return {
				success: false,
				errors: validationErrors,
			};
		}

		// Step 3: Execute save (validation passed)
		return await executeSave(context);
	} catch (error) {
		console.error("Validate and submit failed:", error);
		const message = buildErrorMessage(error);
		return {
			success: false,
			errors: [buildSaveError("validation", message)],
		};
	}
}

/**
 * Reload form data after successful save.
 * Fetches latest data from Dataverse and reinitializes form state.
 *
 * @param context - Save context
 * @param recordId - Record ID to reload
 * @returns Reloaded record data
 */
export async function reloadFormData(context: SaveContext, recordId: string): Promise<Entity | null> {
	const { config, urlParams, formState } = context;

	try {
		const entityName = urlParams.recordLogicalName || config.Form?.PrimaryApplicationTable?.TableLogicalName;

		if (!entityName || !recordId) {
			return null;
		}

		// Reload parent record data
		const recordData = await loadRecordData(entityName, recordId, config);

		// Reload child records
		const childRecordsMap = await loadChildRecords(recordId, config);

		childRecordsMap.forEach((records, childEntityName) => {
			formState.setChildRecords?.(childEntityName, records);
		});

		return recordData;
	} catch (error) {
		console.error("Failed to reload form data:", error);
		return null;
	}
}
