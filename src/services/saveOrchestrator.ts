import { createRecord, updateRecord } from "@/services/api";
import type { Entity, EntityReference } from "@app-types/Entity";
import type { FieldMetadata, PendingChildRecord, PendingDocumentUpload } from "@app-types/FormState";
import type { ReactConfigurationIdentifierMetadata, ReactFormConfiguration } from "@app-types/config";
import type { SaveError, SaveProgressEvent, SaveProgressStatus, SaveResult } from "@app-types/SaveOrchestrator";
import { validateField } from "@services/validation/validators";
import { createFormInstance, createUserFormSession } from "@services/formInstanceManagement";
import { uploadDocumentForRecord } from "@services/documentService";
import { loadChildRecords, loadRecordData } from "@services/dataLoader";
import type { UseFormStateResult } from "@hooks/useFormState";
import { isTempId, sanitizeGuid, buildEntityMetadataMap, resolvePrimaryIdAttribute, resolveRequestorId, type TableMetadataEntry } from "@utilities";

export interface SaveContext {
	formState: UseFormStateResult;
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

const startProgress = (
	onProgress: SaveContext["onProgress"],
	event: Omit<SaveProgressEvent, "status" | "startedAt"> & { status?: SaveProgressStatus }
): string => {
	const startedAt = new Date().toISOString();
	reportProgress(onProgress, { ...event, status: event.status ?? "saving", startedAt });
	return startedAt;
};

const finishProgress = (
	onProgress: SaveContext["onProgress"],
	event: Omit<SaveProgressEvent, "finishedAt" | "durationMs">
): void => {
	const finishedAt = new Date().toISOString();
	const durationMs = event.startedAt ? Date.parse(finishedAt) - Date.parse(event.startedAt) : undefined;
	reportProgress(onProgress, { ...event, finishedAt, durationMs });
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

const collectEntityChanges = (formState: UseFormStateResult, primaryEntity?: string) => {
	const entityChanges = formState.serializeForSubmission();
	const primaryChanges = entityChanges.find((change: any) => change.entityName === primaryEntity);
	const secondaryEntityChanges = entityChanges.filter((change: any) => change.entityName !== primaryEntity);

	return { entityChanges, primaryChanges, secondaryEntityChanges };
};

const buildRecordIdsByEntity = ({
	formState,
	primaryEntity,
	primaryRecordId,
}: {
	formState: UseFormStateResult;
	primaryEntity?: string;
	primaryRecordId: string | null;
}) => {
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

	return recordIdsByEntity;
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

const saveSecondaryEntityChanges = async ({
	secondaryEntityChanges,
	primaryEntity,
	primaryRecordId,
	formState,
	recordIdsByEntity,
	stepReferenceByEntity,
	config,
	onProgress,
}: {
	secondaryEntityChanges: any[];
	primaryEntity?: string;
	primaryRecordId: string | null;
	formState: UseFormStateResult;
	recordIdsByEntity: Map<string, string>;
	stepReferenceByEntity: Map<string, { navigationProperty?: string; referencingAttribute?: string }>;
	config: ReactFormConfiguration;
	onProgress: SaveContext["onProgress"];
}): Promise<SaveError[]> => {
	if (secondaryEntityChanges.length === 0) {
		return [];
	}

	const errors: SaveError[] = [];
	const results = await Promise.allSettled(
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

	results.forEach((result, index) => {
		if (result.status === "rejected") {
			const change = secondaryEntityChanges[index];
			const message = buildErrorMessage(result.reason);
			console.error(`Failed to save entity ${change.entityName}:`, result.reason);
			errors.push(buildSaveError("secondary", `Failed to save ${change.entityName}: ${message}`, change.entityName));
		}
	});

	return errors;
};

const groupPendingChildrenByParent = (formState: UseFormStateResult, primaryEntity?: string) => {
	const pendingRecords = Object.values(formState.pendingChildRecords || {}) as PendingChildRecord[];
	const pendingByParent = new Map<string, PendingChildRecord[]>();

	for (const pending of pendingRecords) {
		const parentEntityName = pending.parentEntityName || primaryEntity;
		if (!parentEntityName) {
			continue;
		}
		if (!pendingByParent.has(parentEntityName)) {
			pendingByParent.set(parentEntityName, []);
		}
		pendingByParent.get(parentEntityName)?.push(pending);
	}

	return pendingByParent;
};

const groupPendingDocumentUploadsByParent = (formState: UseFormStateResult, primaryEntity?: string) => {
	const pendingUploads = Object.values(formState.pendingDocumentUploads || {}) as PendingDocumentUpload[];
	const pendingByParent = new Map<string, PendingDocumentUpload[]>();

	for (const pending of pendingUploads) {
		if (pending.recordId || pending.childRecordId) {
			continue;
		}

		const parentEntityName = pending.entityName || primaryEntity;
		if (!parentEntityName) {
			continue;
		}

		if (!pendingByParent.has(parentEntityName)) {
			pendingByParent.set(parentEntityName, []);
		}
		pendingByParent.get(parentEntityName)?.push(pending);
	}

	return pendingByParent;
};

const executeDocumentUpload = async ({
	pending,
	targetEntityName,
	recordId,
	childId,
	formState,
	onProgress,
	parentEntityName,
	parentRecordId,
}: {
	pending: PendingDocumentUpload;
	targetEntityName: string;
	recordId: string;
	childId?: string;
	formState: UseFormStateResult;
	onProgress: SaveContext["onProgress"];
	parentEntityName?: string;
	parentRecordId?: string;
}) => {
	const progressId = buildProgressId("upload", pending.entityName, pending.id);
	const startedAt = startProgress(onProgress, {
		id: progressId,
		scope: "upload",
		entityName: pending.entityName,
		label: pending.file?.name || pending.id,
		operation: "upload",
		recordId,
		parentEntityName,
		parentRecordId,
	});

	try {
		await uploadDocumentForRecord({
			entityName: targetEntityName,
			recordId,
			folderName: pending.folderName,
			file: pending.file,
			uploadDate: pending.uploadDate,
			childId,
		});

		const key = `${pending.entityName}_${pending.id}`;
		formState.deletePendingDocumentUpload(key);

		finishProgress(onProgress, {
			id: progressId,
			scope: "upload",
			entityName: pending.entityName,
			status: "saved",
			startedAt,
			recordId,
			parentEntityName,
			parentRecordId,
		});
	} catch (error) {
		finishProgress(onProgress, {
			id: progressId,
			scope: "upload",
			entityName: pending.entityName,
			status: "failed",
			startedAt,
			message: buildErrorMessage(error),
			recordId,
			parentEntityName,
			parentRecordId,
		});
		throw error;
	}
};

const savePendingChildRecords = async ({
	formState,
	primaryEntity,
	primaryRecordId,
	recordIdsByEntity,
	stepReferenceByEntity,
	config,
	entityMetadataMap,
	onProgress,
}: {
	formState: UseFormStateResult;
	primaryEntity?: string;
	primaryRecordId: string | null;
	recordIdsByEntity: Map<string, string>;
	stepReferenceByEntity: Map<string, { navigationProperty?: string; referencingAttribute?: string }>;
	config: ReactFormConfiguration;
	entityMetadataMap: Map<string, TableMetadataEntry>;
	onProgress: SaveContext["onProgress"];
}): Promise<SaveError[]> => {
	if (!formState.hasPendingChildren) {
		return [];
	}

	const errors: SaveError[] = [];
	const pendingByParent = groupPendingChildrenByParent(formState, primaryEntity);

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
			} else {
				errors.push(...result.value);
			}
		});
	}

	return errors;
};

const savePendingDocumentUploads = async ({
	formState,
	primaryEntity,
	primaryRecordId,
	recordIdsByEntity,
	stepReferenceByEntity,
	config,
	onProgress,
}: {
	formState: UseFormStateResult;
	primaryEntity?: string;
	primaryRecordId: string | null;
	recordIdsByEntity: Map<string, string>;
	stepReferenceByEntity: Map<string, { navigationProperty?: string; referencingAttribute?: string }>;
	config: ReactFormConfiguration;
	onProgress: SaveContext["onProgress"];
}): Promise<SaveError[]> => {
	if (!formState.hasPendingDocumentUploads) {
		return [];
	}

	const errors: SaveError[] = [];
	const pendingByParent = groupPendingDocumentUploadsByParent(formState, primaryEntity);

	for (const [parentEntityName, uploads] of pendingByParent) {
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

		const results = await Promise.allSettled(
			uploads.map((pending) =>
				executeDocumentUpload({
					pending,
					targetEntityName: parentEntityName,
					recordId: parentId,
					childId: pending.childRecordId,
					formState,
					onProgress,
					parentEntityName,
					parentRecordId: parentId,
				})
			)
		);

		results.forEach((result, index) => {
			if (result.status === "rejected") {
				const pending = uploads[index];
				const message = buildErrorMessage(result.reason);
				console.error("Failed to upload document:", result.reason);
				errors.push(buildSaveError("upload", `Failed to upload document: ${message}`, pending.entityName));
			}
		});
	}

	return errors;
};

const savePendingDocumentUploadsForRecords = async ({
	formState,
	onProgress,
}: {
	formState: UseFormStateResult;
	onProgress: SaveContext["onProgress"];
}): Promise<SaveError[]> => {
	const pendingUploads = Object.values(formState.pendingDocumentUploads || {}) as PendingDocumentUpload[];
	const uploadsForRecords = pendingUploads.filter((upload) => {
		if (!upload.recordId || isTempId(upload.recordId)) {
			return false;
		}

		return !upload.childRecordId || !isTempId(upload.childRecordId);
	});

	if (uploadsForRecords.length === 0) {
		return [];
	}

	const errors: SaveError[] = [];

	const results = await Promise.allSettled(
		uploadsForRecords.map((pending) => {
			const childId = pending.childRecordId && pending.childRecordId !== pending.recordId ? pending.childRecordId : undefined;
			return executeDocumentUpload({
				pending,
				targetEntityName: pending.entityName,
				recordId: pending.recordId as string,
				childId,
				formState,
				onProgress,
				parentEntityName: pending.entityName,
				parentRecordId: pending.recordId as string,
			});
		})
	);

	results.forEach((result, index) => {
		if (result.status === "rejected") {
			const pending = uploadsForRecords[index];
			const message = buildErrorMessage(result.reason);
			console.error("Failed to upload document:", result.reason);
			errors.push(buildSaveError("upload", `Failed to upload document: ${message}`, pending.entityName));
		}
	});

	return errors;
};

const ensureFormInstanceAndSession = async ({
	formState,
	config,
	urlParams,
	primaryEntity,
	primaryRecordId,
	recordIdsByEntity,
}: {
	formState: UseFormStateResult;
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
	formState: UseFormStateResult;
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
		const startedAt = startProgress(onProgress, {
			id: progressId,
			scope: "primary",
			entityName: primaryEntity,
			operation: primaryRecordId ? "update" : "create",
			recordId: primaryRecordId ?? undefined,
		});
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

			finishProgress(onProgress, {
				id: progressId,
				scope: "primary",
				entityName: primaryEntity,
				status: "saved",
				startedAt,
				recordId: primaryRecordId ?? undefined,
			});
		} catch (error) {
			if (!didReportFailure) {
				finishProgress(onProgress, {
					id: progressId,
					scope: "primary",
					entityName: primaryEntity,
					status: "failed",
					startedAt,
					message: buildErrorMessage(error),
					recordId: primaryRecordId ?? undefined,
				});
				didReportFailure = true;
			}
			throw error;
		}
	} else if (shouldEnsurePrimaryExists) {
		const progressId = buildProgressId("primary", primaryEntity);
		const startedAt = startProgress(onProgress, {
			id: progressId,
			scope: "primary",
			entityName: primaryEntity,
			operation: "ensure",
		});
		let didReportFailure = false;

		try {
			const defaults = buildDefaultOnCreateData(primaryEntity, config);
			primaryRecordId = await createRecord(primaryEntity, defaults);

			if (!primaryRecordId) {
				throw new Error("Failed to create primary record");
			}

			formState.setRecordId(primaryRecordId);
			finishProgress(onProgress, {
				id: progressId,
				scope: "primary",
				entityName: primaryEntity,
				status: "saved",
				startedAt,
				recordId: primaryRecordId ?? undefined,
			});
		} catch (error) {
			if (!didReportFailure) {
				finishProgress(onProgress, {
					id: progressId,
					scope: "primary",
					entityName: primaryEntity,
					status: "failed",
					startedAt,
					message: buildErrorMessage(error),
					recordId: primaryRecordId ?? undefined,
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
	formState: UseFormStateResult;
	recordIdsByEntity: Map<string, string>;
	stepReferenceByEntity: Map<string, { navigationProperty?: string; referencingAttribute?: string }>;
	config: ReactFormConfiguration;
	onProgress: SaveContext["onProgress"];
}) => {
	const progressId = buildProgressId("secondary", change.entityName);
	const startedAt = startProgress(onProgress, {
		id: progressId,
		scope: "secondary",
		entityName: change.entityName,
		operation: change.recordId ? "update" : "create",
		parentEntityName: primaryEntity,
		parentRecordId: primaryRecordId ?? undefined,
	});
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
			finishProgress(onProgress, {
				id: progressId,
				scope: "secondary",
				entityName: change.entityName,
				status: "failed",
				startedAt,
				message: "Missing referencing navigation property",
				parentEntityName: primaryEntity,
				parentRecordId: primaryRecordId ?? undefined,
			});
			didReportFailure = true;
			throw new Error(`Missing referencing navigation property for ${change.entityName}`);
		}

		if (existingRecordId) {
			await updateRecord(change.entityName, existingRecordId, dataToSave);
			recordIdsByEntity.set(change.entityName, existingRecordId);
			formState.setRelatedRecord?.(change.entityName, existingRecordId, referenceInfo?.referencingAttribute, navigationProperty);
			finishProgress(onProgress, {
				id: progressId,
				scope: "secondary",
				entityName: change.entityName,
				status: "saved",
				startedAt,
				recordId: existingRecordId,
				parentEntityName: primaryEntity,
				parentRecordId: primaryRecordId ?? undefined,
			});
			return;
		}

		const childId = await createRecord(change.entityName, dataToSave);
		if (!childId) {
			throw new Error(`Failed to create record for ${change.entityName}`);
		}

		recordIdsByEntity.set(change.entityName, childId);
		formState.setRelatedRecord?.(change.entityName, childId, referenceInfo?.referencingAttribute, navigationProperty);
		finishProgress(onProgress, {
			id: progressId,
			scope: "secondary",
			entityName: change.entityName,
			status: "saved",
			startedAt,
			recordId: childId,
			parentEntityName: primaryEntity,
			parentRecordId: primaryRecordId ?? undefined,
		});
	} catch (error) {
		if (!didReportFailure) {
			finishProgress(onProgress, {
				id: progressId,
				scope: "secondary",
				entityName: change.entityName,
				status: "failed",
				startedAt,
				message: buildErrorMessage(error),
				parentEntityName: primaryEntity,
				parentRecordId: primaryRecordId ?? undefined,
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
	formState: UseFormStateResult;
	recordIdsByEntity: Map<string, string>;
	stepReferenceByEntity: Map<string, { navigationProperty?: string; referencingAttribute?: string }>;
	config: ReactFormConfiguration;
}) => {
	let parentId: string | null = recordIdsByEntity.get(parentEntityName) ?? null;

	if (!parentId && parentEntityName === primaryEntity && primaryRecordId) {
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
	formState: UseFormStateResult;
	config: ReactFormConfiguration;
	entityMetadataMap: Map<string, TableMetadataEntry>;
	onProgress: SaveContext["onProgress"];
}): Promise<SaveError[]> => {
	const progressId = buildProgressId("child", pending.entityName, pending.id);
	const startedAt = startProgress(onProgress, {
		id: progressId,
		scope: "child",
		entityName: pending.entityName,
		label: pending.id,
		operation: "create",
		parentEntityName,
		parentRecordId: parentId,
	});
	let didReportFailure = false;
	const errors: SaveError[] = [];

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
			finishProgress(onProgress, {
				id: progressId,
				scope: "child",
				entityName: pending.entityName,
				status: "failed",
				startedAt,
				message: "Missing referencing navigation property",
				parentEntityName,
				parentRecordId: parentId,
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

		finishProgress(onProgress, {
			id: progressId,
			scope: "child",
			entityName: pending.entityName,
			status: "saved",
			startedAt,
			recordId: childId,
			parentEntityName,
			parentRecordId: parentId,
		});

		const pendingUploads = Object.values(formState.pendingDocumentUploads || {}) as PendingDocumentUpload[];
		const uploadsForChild = pendingUploads.filter((upload) => upload.childRecordId === pending.id);

		for (const upload of uploadsForChild) {
			const updatedUpload = {
				...upload,
				recordId: childId,
				childRecordId: childId,
			};
			formState.addPendingDocumentUpload?.(updatedUpload);

			try {
				await executeDocumentUpload({
					pending: upload,
					targetEntityName: pending.entityName,
					recordId: childId,
					formState,
					onProgress,
					parentEntityName: pending.entityName,
					parentRecordId: childId,
				});
			} catch (error) {
				errors.push(buildSaveError("upload", `Failed to upload document: ${buildErrorMessage(error)}`, pending.entityName, upload.id));
			}
		}
	} catch (error) {
		if (!didReportFailure) {
			finishProgress(onProgress, {
				id: progressId,
				scope: "child",
				entityName: pending.entityName,
				status: "failed",
				startedAt,
				message: buildErrorMessage(error),
				parentEntityName,
				parentRecordId: parentId,
			});
			didReportFailure = true;
		}
		throw error;
	}

	return errors;
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

	try {
		const primaryEntity = config.Form?.PrimaryApplicationTable?.TableLogicalName;
		const stepReferenceByEntity = buildStepReferenceMap(config, primaryEntity);
		const { entityChanges, primaryChanges, secondaryEntityChanges } = collectEntityChanges(formState, primaryEntity);

		if (entityChanges.length === 0 && !formState.hasPendingUploads) {
			return {
				success: true,
				message: "No changes to save",
			};
		}

		const shouldEnsurePrimaryExists = !formState.recordId && (formState.hasPendingUploads || secondaryEntityChanges.length > 0);
		const primaryRecordId = await savePrimaryRecord({
			formState,
			primaryEntity,
			primaryChanges,
			shouldEnsurePrimaryExists,
			config,
			onProgress,
		});

		const recordIdsByEntity = buildRecordIdsByEntity({ formState, primaryEntity, primaryRecordId });
		const [secondaryResult, recordUploadResult] = await Promise.allSettled([
			saveSecondaryEntityChanges({
				secondaryEntityChanges,
				primaryEntity,
				primaryRecordId,
				formState,
				recordIdsByEntity,
				stepReferenceByEntity,
				config,
				onProgress,
			}),
			savePendingDocumentUploadsForRecords({
				formState,
				onProgress,
			}),
		]);

		if (secondaryResult.status === "fulfilled") {
			errors.push(...secondaryResult.value);
		} else {
			const message = buildErrorMessage(secondaryResult.reason);
			errors.push(buildSaveError("secondary", `Failed to save secondary records: ${message}`));
		}

		if (recordUploadResult.status === "fulfilled") {
			errors.push(...recordUploadResult.value);
		} else {
			const message = buildErrorMessage(recordUploadResult.reason);
			errors.push(buildSaveError("upload", `Failed to upload documents: ${message}`));
		}

		const childErrors = await savePendingChildRecords({
			formState,
			primaryEntity,
			primaryRecordId,
			recordIdsByEntity,
			stepReferenceByEntity,
			config,
			entityMetadataMap,
			onProgress,
		});
		errors.push(...childErrors);

		const documentErrors = await savePendingDocumentUploads({
			formState,
			primaryEntity,
			primaryRecordId,
			recordIdsByEntity,
			stepReferenceByEntity,
			config,
			onProgress,
		});
		errors.push(...documentErrors);

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
