import { createRecord, updateRecord } from "../hooks/api";
import type { PendingChildRecord } from "../types/FormState";
import type { Entity, EntityReference } from "../types/Entity";
import type { SaveError, SaveProgressEvent, SaveResult } from "../types/SaveOrchestrator";
import { validateField } from "./validation/validators";
import type { ReactConfigurationIdentifierMetadata, ReactFormConfiguration } from "../types/config";
import { createFormInstance, createUserFormSession } from "../queries/version";
import { resolveRequestorId } from "../utilities/session";
import { buildEntityMetadataMap, resolvePrimaryIdAttribute, type TableMetadataEntry } from "../utilities/entityMetadata";
import { sanitizeGuid } from "../utilities/Serialization";
import { isTempId } from "../utilities/Common";

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

const resolveDefaultLookupValue = (identifier: string, config: ReactFormConfiguration): EntityReference | null => {
	switch (identifier) {
		case "Form":
			return config.Form?.Id ? { id: config.Form.Id, logicalName: "eyfrcc_form" } : null;
		case "FundingOpportunity":
		case "ApplicationType":
			return config.FundingOpportunity?.Id ? { id: config.FundingOpportunity.Id, logicalName: "eyfrcc_applicationtype" } : null;
		case "Requestor": {
			const contactId = resolveRequestorId();
			return contactId ? { id: contactId, logicalName: "contact" } : null;
		}
		default:
			return null;
	}
};

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

const savePrimaryRecord = async ({
	formState,
	primaryEntity,
	primaryChanges,
	shouldEnsurePrimaryExists,
	config,
	onProgress,
}: {
	formState: any;
	primaryEntity?: string;
	primaryChanges: any;
	shouldEnsurePrimaryExists: boolean;
	config: ReactFormConfiguration;
	onProgress: SaveContext["onProgress"];
}): Promise<string | null> => {
	if (!primaryEntity) {
		throw new Error("Missing primary entity name");
	}

	let primaryRecordId = formState.recordId;

	if (primaryChanges && primaryChanges.data && Object.keys(primaryChanges.data).length > 0) {
		const progressId = buildProgressId("primary", primaryEntity);
		reportProgress(onProgress, { id: progressId, scope: "primary", entityName: primaryEntity, status: "saving" });
		let didReportFailure = false;

		try {
			if (primaryRecordId) {
				await updateRecord(primaryEntity, primaryRecordId, primaryChanges.data);
			} else {
				const defaults = buildDefaultOnCreateData(primaryEntity, config);
				const dataToSave = mergeDefaultOnCreateData(primaryChanges.data, defaults);
				primaryRecordId = await createRecord(primaryEntity, dataToSave);

				if (!primaryRecordId) {
					throw new Error("Failed to create primary record");
				}

				formState.setRecordId(primaryRecordId);
			}

			reportProgress(onProgress, { id: progressId, scope: "primary", entityName: primaryEntity, status: "saved" });
		} catch (error) {
			if (!didReportFailure) {
				reportProgress(onProgress, {
					id: progressId,
					scope: "primary",
					entityName: primaryEntity,
					status: "failed",
					message: buildErrorMessage(error),
				});
				didReportFailure = true;
			}
			throw error;
		}
	} else if (shouldEnsurePrimaryExists) {
		const progressId = buildProgressId("primary", primaryEntity);
		reportProgress(onProgress, { id: progressId, scope: "primary", entityName: primaryEntity, status: "saving" });
		let didReportFailure = false;

		try {
			const defaults = buildDefaultOnCreateData(primaryEntity, config);
			primaryRecordId = await createRecord(primaryEntity, defaults);

			if (!primaryRecordId) {
				throw new Error("Failed to create primary record");
			}

			formState.setRecordId(primaryRecordId);
			reportProgress(onProgress, { id: progressId, scope: "primary", entityName: primaryEntity, status: "saved" });
		} catch (error) {
			if (!didReportFailure) {
				reportProgress(onProgress, {
					id: progressId,
					scope: "primary",
					entityName: primaryEntity,
					status: "failed",
					message: buildErrorMessage(error),
				});
				didReportFailure = true;
			}
			throw error;
		}
	}

	return primaryRecordId;
};

const saveSecondaryRecord = async ({
	change,
	primaryEntity,
	primaryRecordId,
	formState,
	recordIdsByEntity,
	stepReferenceByEntity,
	config,
	onProgress,
}: {
	change: any;
	primaryEntity?: string;
	primaryRecordId: string | null;
	formState: any;
	recordIdsByEntity: Map<string, string>;
	stepReferenceByEntity: Map<string, { navigationProperty?: string; referencingAttribute?: string }>;
	config: ReactFormConfiguration;
	onProgress: SaveContext["onProgress"];
}) => {
	const progressId = buildProgressId("secondary", change.entityName);
	reportProgress(onProgress, { id: progressId, scope: "secondary", entityName: change.entityName, status: "saving" });
	let didReportFailure = false;

	try {
		const defaults = buildDefaultOnCreateData(change.entityName, config);
		const dataToSave = mergeDefaultOnCreateData({ ...change.data }, defaults);
		const referenceInfo = stepReferenceByEntity.get(change.entityName);
		const navigationProperty = referenceInfo?.navigationProperty;
		const existingRecordId = change.recordId || recordIdsByEntity.get(change.entityName) || formState.getRelatedRecord?.(change.entityName)?.recordId;

		if (!existingRecordId && navigationProperty && primaryRecordId && dataToSave[navigationProperty] === undefined) {
			dataToSave[navigationProperty] = {
				id: primaryRecordId,
				logicalName: primaryEntity,
			};
		}

		if (!existingRecordId && !navigationProperty) {
			reportProgress(onProgress, {
				id: progressId,
				scope: "secondary",
				entityName: change.entityName,
				status: "failed",
				message: "Missing referencing navigation property",
			});
			didReportFailure = true;
			throw new Error(`Missing referencing navigation property for ${change.entityName}`);
		}

		if (existingRecordId) {
			await updateRecord(change.entityName, existingRecordId, dataToSave);
			recordIdsByEntity.set(change.entityName, existingRecordId);
			formState.setRelatedRecord?.(change.entityName, existingRecordId, referenceInfo?.referencingAttribute, navigationProperty);
			reportProgress(onProgress, { id: progressId, scope: "secondary", entityName: change.entityName, status: "saved" });
			return;
		}

		const childId = await createRecord(change.entityName, dataToSave);
		if (!childId) {
			throw new Error(`Failed to create record for ${change.entityName}`);
		}

		recordIdsByEntity.set(change.entityName, childId);
		formState.setRelatedRecord?.(change.entityName, childId, referenceInfo?.referencingAttribute, navigationProperty);
		reportProgress(onProgress, { id: progressId, scope: "secondary", entityName: change.entityName, status: "saved" });
	} catch (error) {
		if (!didReportFailure) {
			reportProgress(onProgress, {
				id: progressId,
				scope: "secondary",
				entityName: change.entityName,
				status: "failed",
				message: buildErrorMessage(error),
			});
			didReportFailure = true;
		}
		throw error;
	}
};

const ensureSecondaryParentRecord = async ({
	parentEntityName,
	primaryEntity,
	primaryRecordId,
	formState,
	recordIdsByEntity,
	stepReferenceByEntity,
	config,
}: {
	parentEntityName: string;
	primaryEntity?: string;
	primaryRecordId: string | null;
	formState: any;
	recordIdsByEntity: Map<string, string>;
	stepReferenceByEntity: Map<string, { navigationProperty?: string; referencingAttribute?: string }>;
	config: ReactFormConfiguration;
}) => {
	let parentId = recordIdsByEntity.get(parentEntityName);

	if (!parentId && parentEntityName === primaryEntity) {
		parentId = primaryRecordId;
	}

	if (!parentId && parentEntityName !== primaryEntity) {
		const relatedRecord = formState.getRelatedRecord?.(parentEntityName);
		if (relatedRecord?.recordId) {
			parentId = relatedRecord.recordId;
			recordIdsByEntity.set(parentEntityName, relatedRecord.recordId);
		}
	}

	if (!parentId && parentEntityName !== primaryEntity) {
		const referenceInfo = stepReferenceByEntity.get(parentEntityName);
		const navigationProperty = referenceInfo?.navigationProperty;

		if (!navigationProperty) {
			throw new Error(`Missing referencing navigation property for ${parentEntityName}`);
		}

		const defaults = buildDefaultOnCreateData(parentEntityName, config);
		const parentData = mergeDefaultOnCreateData({}, defaults);
		if (primaryRecordId) {
			parentData[navigationProperty] = {
				id: primaryRecordId,
				logicalName: primaryEntity,
			};
		}

		parentId = await createRecord(parentEntityName, parentData);

		if (!parentId) {
			throw new Error(`Failed to create parent record for ${parentEntityName}`);
		}

		recordIdsByEntity.set(parentEntityName, parentId);
		formState.setRelatedRecord?.(parentEntityName, parentId, referenceInfo?.referencingAttribute, navigationProperty);
	}

	return parentId;
};

const saveChildRecord = async ({
	pending,
	parentEntityName,
	parentId,
	formState,
	config,
	entityMetadataMap,
	onProgress,
}: {
	pending: PendingChildRecord;
	parentEntityName: string;
	parentId: string;
	formState: any;
	config: ReactFormConfiguration;
	entityMetadataMap: Map<string, TableMetadataEntry>;
	onProgress: SaveContext["onProgress"];
}) => {
	const progressId = buildProgressId("child", pending.entityName, pending.id);
	reportProgress(onProgress, {
		id: progressId,
		scope: "child",
		entityName: pending.entityName,
		label: pending.id,
		status: "saving",
	});
	let didReportFailure = false;

	try {
		const defaults = buildDefaultOnCreateData(pending.entityName, config);
		const childData = mergeDefaultOnCreateData({ ...pending.data }, defaults);

		const primaryIdAttribute = resolvePrimaryIdAttribute(pending.entityName, entityMetadataMap);
		if (pending.id) {
			if (isTempId(pending.id) && childData[primaryIdAttribute] === undefined) {
				const sanitizedId = sanitizeGuid(pending.id);
				childData[primaryIdAttribute] = sanitizedId;
			}

			delete childData.id;
		}

		delete childData.id;
		delete childData._isNew;
		delete childData._isPending;

		if (pending.referencingAttribute) {
			delete childData[pending.referencingAttribute];
		}

		if (pending.referencingNavigationProperty) {
			delete childData[pending.referencingNavigationProperty];
		}

		const navigationProperty = pending.referencingNavigationProperty || pending.referencingAttribute;

		if (!navigationProperty) {
			reportProgress(onProgress, {
				id: progressId,
				scope: "child",
				entityName: pending.entityName,
				status: "failed",
				message: "Missing referencing navigation property",
			});
			didReportFailure = true;
			throw new Error(`Missing referencing navigation property for ${pending.entityName}`);
		}

		childData[navigationProperty] = {
			id: parentId,
			logicalName: parentEntityName,
		};

		const childId = await createRecord(pending.entityName, childData);

		if (!childId) {
			throw new Error(`Failed to create child record for ${pending.entityName}`);
		}

		const key = `${pending.entityName}_${pending.id}`;
		formState.deletePendingChildRecord(key);
		formState.upsertChildRecord?.(pending.entityName, { id: childId, ...childData });

		reportProgress(onProgress, {
			id: progressId,
			scope: "child",
			entityName: pending.entityName,
			status: "saved",
		});
	} catch (error) {
		if (!didReportFailure) {
			reportProgress(onProgress, {
				id: progressId,
				scope: "child",
				entityName: pending.entityName,
				status: "failed",
				message: buildErrorMessage(error),
			});
			didReportFailure = true;
		}
		throw error;
	}
};

/**
 * Execute a draft save operation.
 * Saves only dirty fields without validation.
 *
 * @param context - Save context containing form state and configuration
 * @returns Save result with success status and any errors
 */
export async function executeSaveDraft(context: SaveContext): Promise<SaveResult> {
	const { formState, config, onProgress } = context;
	const errors: SaveError[] = [];
	const entityMetadataMap = buildEntityMetadataMap(config);

	/*
		TO-DO: Somewhere in here, I need to create the FormInstance record if its not already created.
		If creating FormInstance, I need to also create the UserFormSession record for the current user.
		fields to default on FormInstance:
			- eyfrcc_versionid: This will be the versionId URL param
			- eyfrcc_primaryrecordid: If recordId URL param exists, set this to that value. Otherwise, it will be the primary record created.
			- eyfrcc_primaryrecordlogicalname: If recordLogicalName URL param exists, set this to that value. Otherwise, it will be the primary entity from the form config.
			- eyfrcc_secondaryrecords: JSON array of all secondary records created in the format [{ LogicalName: string, Id: string }]

		fields to default on UserFormSession:
			- eyfrcc_forminstanceid: Lookup to the FormInstance record created above
			- eyfrcc_contactid: Lookup to current contact (requestor)
			- eyfrcc_organizationid: Ignore... this will be set automatically by Dataverse (Plugin)
			- eyfrcc_lastactive: Set to current date/time
	*/

	try {
		// Step 1: Get all changed data from form state
		const primaryEntity = config.Form?.PrimaryApplicationTable?.TableLogicalName;
		const entityChanges = formState.serializeForSubmission();
		const secondaryEntityChanges = entityChanges.filter((change: any) => change.entityName !== primaryEntity);
		const stepReferenceByEntity = buildStepReferenceMap(config, primaryEntity);

		if (entityChanges.length === 0 && !formState.hasPendingChildren) {
			return {
				success: true,
				message: "No changes to save",
			};
		}

		// Step 2: Save primary record first
		const primaryChanges = entityChanges.find((change: any) => change.entityName === primaryEntity);
		const shouldEnsurePrimaryExists = !formState.recordId && (formState.hasPendingChildren || secondaryEntityChanges.length > 0);
		const primaryRecordId = await savePrimaryRecord({
			formState,
			primaryEntity,
			primaryChanges,
			shouldEnsurePrimaryExists,
			config,
			onProgress,
		});

		const recordIdsByEntity = new Map<string, string>();
		if (primaryRecordId && primaryEntity) {
			recordIdsByEntity.set(primaryEntity, primaryRecordId);
		}
		const relatedRecords = formState.relatedRecords || {};
		Object.entries(relatedRecords).forEach(([entityName, recordInfo]: any) => {
			if (recordInfo?.recordId && !recordIdsByEntity.has(entityName)) {
				recordIdsByEntity.set(entityName, recordInfo.recordId);
			}
		});

		// Step 3: Save dirty fields from secondary entities
		if (secondaryEntityChanges.length > 0) {
			const secondaryResults = await Promise.allSettled(
				secondaryEntityChanges.map((change: any) =>
					saveSecondaryRecord({
						change,
						primaryEntity,
						primaryRecordId,
						formState,
						recordIdsByEntity,
						stepReferenceByEntity,
						config,
						onProgress,
					})
				)
			);

			secondaryResults.forEach((result, index) => {
				if (result.status === "rejected") {
					const change = secondaryEntityChanges[index];
					const message = buildErrorMessage(result.reason);
					console.error(`Failed to save entity ${change.entityName}:`, result.reason);
					errors.push(buildSaveError("secondary", `Failed to save ${change.entityName}: ${message}`, change.entityName));
				}
			});
		}

		// Step 4: Process pending child operations
		if (formState.hasPendingChildren) {
			const pendingRecords = Object.values(formState.pendingChildRecords || {}) as PendingChildRecord[];
			const pendingByParent = new Map<string, PendingChildRecord[]>();

			for (const pending of pendingRecords) {
				const parentEntityName = pending.parentEntityName || primaryEntity;
				if (!pendingByParent.has(parentEntityName)) {
					pendingByParent.set(parentEntityName, []);
				}
				pendingByParent.get(parentEntityName)?.push(pending);
			}

			for (const [parentEntityName, records] of pendingByParent) {
				let parentId: string | null = null;

				try {
					parentId = await ensureSecondaryParentRecord({
						parentEntityName,
						primaryEntity,
						primaryRecordId,
						formState,
						recordIdsByEntity,
						stepReferenceByEntity,
						config,
					});
				} catch (error) {
					const message = buildErrorMessage(error);
					console.error(`Failed to ensure parent record for ${parentEntityName}:`, error);
					errors.push(buildSaveError("child", `Failed to ensure parent record for ${parentEntityName}: ${message}`, parentEntityName));
					continue;
				}

				if (!parentId) {
					errors.push(buildSaveError("child", `Missing parent record for ${parentEntityName}`, parentEntityName));
					continue;
				}

				const childResults = await Promise.allSettled(
					records.map((pending) =>
						saveChildRecord({
							pending,
							parentEntityName,
							parentId,
							formState,
							config,
							entityMetadataMap,
							onProgress,
						})
					)
				);

				childResults.forEach((result, index) => {
					if (result.status === "rejected") {
						const pending = records[index];
						const message = buildErrorMessage(result.reason);
						console.error(`Failed to save child record:`, result.reason);
						errors.push(buildSaveError("child", `Failed to save child record: ${message}`, pending.entityName));
					}
				});
			}
		}

		// Step 5: Ensure form instance + user session are created/updated
		if (errors.length === 0) {
			await ensureFormInstanceAndSession({
				formState,
				config,
				urlParams: context.urlParams,
				primaryEntity,
				primaryRecordId,
				recordIdsByEntity,
			});
		}

		// Step 6: Reset dirty flags for successfully saved fields
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
		const allFields = Object.entries(formState.metadata || {});

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

		// Step 3: Execute save draft (validation passed)
		return await executeSaveDraft(context);
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
 * Populate form lookup field after creating a new parent record.
 *
 * @param recordId - Parent record ID
 * @param entityName - Entity logical name
 * @param formId - Form ID to populate
 * @param formFieldName - Lookup field logical name for the form
 */
export async function populateFormLookup(recordId: string, entityName: string, formId: string, formFieldName: string = "eyfrcc_form"): Promise<void> {
	try {
		const data = {
			[formFieldName]: {
				id: formId,
				logicalName: "eyfrcc_form",
			},
		};

		await updateRecord(entityName, recordId, data);
	} catch (error) {
		// Log but don't fail the save if form lookup population fails
		console.warn("Failed to populate form lookup:", error);
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
	const { config, urlParams } = context;

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
