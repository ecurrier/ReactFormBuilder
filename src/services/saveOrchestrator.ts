import { createRecord, updateRecord } from "../hooks/api";
import type { PendingChildRecord } from "../types/FormState";
import type { Entity } from "../types/Entity";
import { validateField } from "./validation/validators";
import { loadRecordData, loadChildRecords } from "./dataLoader";
import type { ReactFormConfiguration } from "../types/config";

export interface SaveResult {
	success: boolean;
	recordId?: string;
	errors?: string[];
}

export interface SaveContext {
	formState: any;
	config: ReactFormConfiguration;
	urlParams: any;
}

/**
 * Execute a draft save operation.
 * Saves only dirty fields without validation.
 * 
 * @param context - Save context containing form state and configuration
 * @returns Save result with success status and any errors
 */
export async function executeSaveDraft(context: SaveContext): Promise<SaveResult> {
	const { formState, config, urlParams } = context;
	const errors: string[] = [];
	
	try {
		// Step 1: Get all changed data from form state
		const primaryEntity = config.Form?.PrimaryApplicationTable?.TableLogicalName;
		const entityChanges = formState.serializeForSubmission();
		const otherEntityChanges = entityChanges.filter((change: any) => change.entityName !== primaryEntity);
		const stepReferenceByEntity = new Map<string, { navigationProperty?: string; referencingAttribute?: string }>();

		if (config.Form?.Steps) {
			config.Form.Steps.forEach((step: any) => {
				if (!step.EntityLogicalName || step.EntityLogicalName === primaryEntity) {
					return;
				}

				if (!stepReferenceByEntity.has(step.EntityLogicalName)) {
					stepReferenceByEntity.set(step.EntityLogicalName, {
						navigationProperty:
							step.ReferencingNavigationProperty || step.ReferencingAttribute || step.ReferencingAttributeLogicalName,
						referencingAttribute: step.ReferencingAttribute || step.ReferencingAttributeLogicalName,
					});
				}
			});
		}
		
		if (entityChanges.length === 0 && !formState.hasPendingChildren) {
			return {
				success: true,
				message: "No changes to save",
			};
		}

		// Step 2: Save parent record first
		const parentChanges = entityChanges.find((change: any) => change.entityName === primaryEntity);
		let parentRecordId = formState.recordId;
		const shouldEnsureParentExists = !parentRecordId && (formState.hasPendingChildren || otherEntityChanges.length > 0);

		if (parentChanges && parentChanges.data && Object.keys(parentChanges.data).length > 0) {
			if (parentRecordId) {
				// Update existing parent
				await updateRecord(primaryEntity, parentRecordId, parentChanges.data);
			} else {
				// Create new parent
				parentRecordId = await createRecord(primaryEntity, parentChanges.data);
				
				if (!parentRecordId) {
					throw new Error("Failed to create parent record");
				}
				
				// Update form state with new record ID
				formState.setRecordId(parentRecordId);
			}
		} else if (shouldEnsureParentExists) {
			parentRecordId = await createRecord(primaryEntity, {});

			if (!parentRecordId) {
				throw new Error("Failed to create parent record");
			}

			formState.setRecordId(parentRecordId);
		}

		const recordIdsByEntity = new Map<string, string>();
		if (parentRecordId) {
			recordIdsByEntity.set(primaryEntity, parentRecordId);
		}
		const relatedRecords = formState.relatedRecords || {};
		Object.entries(relatedRecords).forEach(([entityName, recordInfo]: any) => {
			if (recordInfo?.recordId && !recordIdsByEntity.has(entityName)) {
				recordIdsByEntity.set(entityName, recordInfo.recordId);
			}
		});

		// Step 3: Save dirty fields from other entities (child step entities)
		for (const change of otherEntityChanges) {
			try {
				const dataToSave = { ...change.data };
				const referenceInfo = stepReferenceByEntity.get(change.entityName);
				const navigationProperty = referenceInfo?.navigationProperty;
				const existingRecordId =
					change.recordId ||
					recordIdsByEntity.get(change.entityName) ||
					formState.getRelatedRecord?.(change.entityName)?.recordId;

				if (!existingRecordId && navigationProperty && parentRecordId) {
					dataToSave[navigationProperty] = {
						id: parentRecordId,
						logicalName: primaryEntity,
					};
				}

				if (!existingRecordId && !navigationProperty) {
					throw new Error(`Missing referencing navigation property for ${change.entityName}`);
				}

				if (existingRecordId) {
					await updateRecord(change.entityName, existingRecordId, dataToSave);
					recordIdsByEntity.set(change.entityName, existingRecordId);
					formState.setRelatedRecord?.(
						change.entityName,
						existingRecordId,
						referenceInfo?.referencingAttribute,
						navigationProperty
					);
				} else {
					// For child entities without a record ID, we need the parent relationship
					// This handles step-level child entities
					const childId = await createRecord(change.entityName, dataToSave);
					if (childId) {
						recordIdsByEntity.set(change.entityName, childId);
						formState.setRelatedRecord?.(
							change.entityName,
							childId,
							referenceInfo?.referencingAttribute,
							navigationProperty
						);
					}
					// TODO: Track child entity record IDs in form state
				}
			} catch (error) {
				console.error(`Failed to save entity ${change.entityName}:`, error);
				errors.push(`Failed to save ${change.entityName}: ${error.message || "Unknown error"}`);
			}
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
				let parentId = recordIdsByEntity.get(parentEntityName);

				if (!parentId && parentEntityName === primaryEntity) {
					parentId = parentRecordId;
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
						errors.push(`Missing referencing navigation property for ${parentEntityName}`);
						continue;
					}

					const parentData = parentRecordId
						? {
								[navigationProperty]: {
									id: parentRecordId,
									logicalName: primaryEntity,
								},
							}
						: {};

					parentId = await createRecord(parentEntityName, parentData);

					if (!parentId) {
						errors.push(`Failed to create parent record for ${parentEntityName}`);
						continue;
					}

					recordIdsByEntity.set(parentEntityName, parentId);
					formState.setRelatedRecord?.(
						parentEntityName,
						parentId,
						referenceInfo?.referencingAttribute,
						navigationProperty
					);
				}

				if (!parentId) {
					errors.push(`Missing parent record for ${parentEntityName}`);
					continue;
				}

				for (const pending of records) {
					try {
						const childData = { ...pending.data };

						if (pending.referencingAttribute) {
							delete childData[pending.referencingAttribute];
						}

						if (pending.referencingNavigationProperty) {
							delete childData[pending.referencingNavigationProperty];
						}

						const navigationProperty = pending.referencingNavigationProperty || pending.referencingAttribute;

						if (!navigationProperty) {
							throw new Error(`Missing referencing navigation property for ${pending.entityName}`);
						}

						childData[navigationProperty] = {
							id: parentId,
							logicalName: parentEntityName,
						};

						const childId = await createRecord(pending.entityName, childData);
						
						if (childId) {
							const key = `${pending.entityName}_${pending.id}`;
							formState.deletePendingChildRecord(key);
						}
					} catch (error) {
						console.error(`Failed to save child record:`, error);
						errors.push(`Failed to save child record: ${error.message || "Unknown error"}`);
					}
				}
			}
		}

		// Step 5: Reset dirty flags for successfully saved fields
		if (errors.length === 0) {
			formState.resetDirty();
		}

		return {
			success: errors.length === 0,
			recordId: parentRecordId,
			errors: errors.length > 0 ? errors : undefined,
		};
	} catch (error) {
		console.error("Save draft failed:", error);
		return {
			success: false,
			errors: [error.message || "Unknown error occurred during save"],
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
	const validationErrors: string[] = [];
	
	try {
		// Step 1: Run all field validators
		const allFields = Object.entries(formState.metadata || {});
		
		for (const [fieldPath, metadata] of allFields) {
			const fieldValue = formState.getFieldValue(fieldPath);
			const isDirty = formState.isFieldDirty(fieldPath);
			
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
					validationErrors.push(
						`${fieldConfig.Label || metadata.logicalName}: ${validationResult.message || "Validation failed"}`
					);
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
		return {
			success: false,
			errors: [error.message || "Unknown error occurred during validation"],
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
export async function populateFormLookup(
	recordId: string,
	entityName: string,
	formId: string,
	formFieldName: string = "eyfrcc_form"
): Promise<void> {
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
export async function reloadFormData(
	context: SaveContext,
	recordId: string
): Promise<Entity | null> {
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
		
		// TODO: Integrate child records into form state
		
		return recordData;
	} catch (error) {
		console.error("Failed to reload form data:", error);
		return null;
	}
}
