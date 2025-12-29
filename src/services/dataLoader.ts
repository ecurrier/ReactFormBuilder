import { retrieveRecord, retrieveMultipleRecords } from "../hooks/api";
import type { Entity } from "../types/Entity";
import type { ReactFormConfiguration } from "../types/config";
import { ActionType } from "../constants/enums";
import { buildFetchXmlForRecord, buildFetchXmlForChildRecords } from "../utilities/FetchXmlBuilder";
import { resolvePrimaryIdAttribute, resolvePrimaryNameAttribute } from "../utilities/entityMetadata";
import { getDocumentIdentifierFields } from "../utilities/documentUpload";

/**
 * Load record data and traverse form lookup to get version configuration.
 *
 * @param recordLogicalName - Entity logical name of the record
 * @param recordId - GUID of the record to load
 * @returns Object containing form ID and version ID for subsequent config loading
 */
export async function loadRecordWithForm(recordLogicalName: string, recordId: string): Promise<{ formId: string; versionId: string } | null> {
	try {
		// First, we need to get the form field name from the record
		// This will be entity-specific (e.g., eyfrcc_form)
		// For now, we'll assume it follows the pattern eyfrcc_form
		// In future, this should come from Form Configuration Identifiers
		const formFieldName = "eyfrcc_form";
		const primaryIdAttribute = resolvePrimaryIdAttribute(recordLogicalName);

		const fetchXml = `
            <fetch top="1">
                <entity name="${recordLogicalName}">
                    <attribute name="${formFieldName}" />
                    <filter>
                        <condition attribute="${primaryIdAttribute}" operator="eq" value="${recordId}" />
                    </filter>
                    <link-entity name="eyfrcc_form" from="eyfrcc_formid" to="${formFieldName}" alias="form">
                        <attribute name="eyfrcc_publishedversionid" />
                    </link-entity>
                </entity>
            </fetch>
        `;

		const result = await retrieveRecord<Entity>(recordLogicalName, fetchXml);

		if (!result) {
			throw new Error(`Record not found: ${recordLogicalName}(${recordId})`);
		}

		const formId = result[formFieldName];
		const versionId = result["form.eyfrcc_publishedversionid"];

		if (!formId || !versionId) {
			throw new Error(`Record does not have a form configured or form does not have a published version`);
		}

		return { formId, versionId };
	} catch (error) {
		console.error("Failed to load record with form:", error);
		throw error;
	}
}

/**
 * Load primary record data with all fields referenced in the form configuration.
 *
 * @param recordLogicalName - Entity logical name
 * @param recordId - Record GUID
 * @param config - Form configuration to determine which fields to load
 * @returns Entity record with all form fields populated
 */
export async function loadRecordData(recordLogicalName: string, recordId: string, config: ReactFormConfiguration): Promise<Entity | null> {
	try {
		// Collect all field logical names from form configuration
		const fieldNames = new Set<string>();

		// Add primary key field
		fieldNames.add(resolvePrimaryIdAttribute(recordLogicalName));

		// Traverse all steps and actions to find FieldInput actions
		config.Form?.Steps?.forEach((step) => {
			step.Actions?.forEach((action) => {
				if (action.Type === ActionType.FieldInput && action.Properties.LogicalName) {
					fieldNames.add(action.Properties.LogicalName);
				}

				// Check child actions (for nested structures)
				if (action.ChildActions) {
					action.ChildActions.forEach((childAction) => {
						if (childAction.Type === ActionType.FieldInput && childAction.Properties.LogicalName) {
							fieldNames.add(childAction.Properties.LogicalName);
						}
					});
				}
			});
		});

		// Add document identifier fields if configured
		const identifierFields = getDocumentIdentifierFields(config, recordLogicalName);
		if (identifierFields.documentPathField) {
			fieldNames.add(identifierFields.documentPathField);
		}
		if (identifierFields.applicationNumberField) {
			fieldNames.add(identifierFields.applicationNumberField);
		}

		const columns = Array.from(fieldNames);
		const fetchXml = buildFetchXmlForRecord(recordLogicalName, recordId, columns);

		const result = await retrieveRecord<Entity>(recordLogicalName, fetchXml);

		if (!result) {
			throw new Error(`Record not found: ${recordLogicalName}(${recordId})`);
		}

		// TODO: Expand lookup values to include primary name for display
		// This would require additional queries to lookup target entities

		return result;
	} catch (error) {
		console.error("Failed to load record data:", error);
		throw error;
	}
}

/**
 * Load all child records for TableEntry actions in the form.
 *
 * @param parentRecordId - Parent record GUID
 * @param config - Form configuration containing TableEntry actions
 * @returns Map of child entity name to array of child records
 */
export async function loadChildRecords(parentRecordId: string, config: ReactFormConfiguration): Promise<Map<string, Entity[]>> {
	const childRecordsMap = new Map<string, Entity[]>();

	try {
		// Find all TableEntry actions
		const tableEntryActions = config.Form?.Steps?.flatMap((step) => step.Actions?.filter((action) => action.Type === ActionType.TableEntry) || []) || [];

		// Load child records for each TableEntry
		for (const action of tableEntryActions) {
			const childEntityName = action.Properties.ChildEntityLogicalName;
			const referencingAttribute = action.Properties.ReferencingAttribute;

			if (!childEntityName || !referencingAttribute) {
				console.warn("TableEntry action missing required properties:", action);
				continue;
			}

			// Get columns from ChildViewSteps
			const columns = action.Properties.ChildViewSteps?.[0]?.Actions?.map((a: any) => a.Properties.LogicalName).filter(Boolean) || [];

			// Add primary key
			columns.push(resolvePrimaryIdAttribute(childEntityName));

			const fetchXml = buildFetchXmlForChildRecords(childEntityName, referencingAttribute, parentRecordId, columns);

			const response = await retrieveMultipleRecords<Entity>(childEntityName, fetchXml, {});

			childRecordsMap.set(childEntityName, response.results || []);
		}

		return childRecordsMap;
	} catch (error) {
		console.error("Failed to load child records:", error);
		throw error;
	}
}

/**
 * Map loaded record data to field paths for form initialization.
 *
 * @param recordData - Entity record data
 * @param entityName - Entity logical name (used for field path construction)
 * @returns Map of field path to field value
 */
export function populateFieldsFromData(recordData: Entity, entityName: string, config?: ReactFormConfiguration): Map<string, any> {
	const fieldValues = new Map<string, any>();

	if (!recordData) {
		return fieldValues;
	}

	const lookupFields = new Map<string, any>();
	if (config?.Form?.Steps) {
		config.Form.Steps.forEach((step) => {
			step.Actions?.forEach((action) => {
				if (action.Type === ActionType.FieldInput && action.Properties?.DataType === 643260009 && action.Properties?.LogicalName) {
					lookupFields.set(action.Properties.LogicalName, action.Properties);
				}
			});
		});
	}

	// Iterate through all properties in the record
	Object.entries(recordData).forEach(([key, value]) => {
		// Skip OData metadata fields
		if (key.startsWith("@odata") || key.includes(".")) {
			return;
		}

		if (key.startsWith("_")) {
			return;
		}

		// Create field path: entityName.fieldLogicalName
		const fieldPath = `${entityName}.${key}`;
		fieldValues.set(fieldPath, value);
	});

	// Map lookup fields to EntityReference shape when present
	lookupFields.forEach((properties, logicalName) => {
		const idKey = `_${logicalName}_value`;
		const lookupId = recordData[idKey];
		if (!lookupId) {
			return;
		}

		const logicalNameKey = `${idKey}@Microsoft.Dynamics.CRM.lookuplogicalname`;
		const formattedValueKey = `${idKey}@OData.Community.Display.V1.FormattedValue`;
		const lookupLogicalName = recordData[logicalNameKey] || properties.Targets?.[0]?.EntityLogicalName;
		const lookupName = recordData[formattedValueKey];

		if (!lookupLogicalName) {
			return;
		}

		fieldValues.set(`${entityName}.${logicalName}`, {
			id: lookupId,
			logicalName: lookupLogicalName,
			name: lookupName,
		});
	});

	return fieldValues;
}

/**
 * Expand lookup field values to include display name.
 * Fetches the primary name field from the referenced entity.
 *
 * @param lookupValue - EntityReference object { id, logicalName }
 * @param targetEntityName - Logical name of the lookup target entity
 * @returns EntityReference with added 'name' property
 */
export async function expandLookupValue(
	lookupValue: { id: string; logicalName: string },
	targetEntityName: string
): Promise<{ id: string; logicalName: string; name?: string }> {
	try {
		// This is a simplified implementation
		// In production, you'd want to determine the primary name field dynamically
		const primaryNameField = resolvePrimaryNameAttribute(targetEntityName);

		const fetchXml = buildFetchXmlForRecord(targetEntityName, lookupValue.id, [primaryNameField]);

		const result = await retrieveRecord<Entity>(targetEntityName, fetchXml);

		return {
			...lookupValue,
			name: result?.[primaryNameField] || undefined,
		};
	} catch (error) {
		console.warn(`Failed to expand lookup value for ${targetEntityName}:`, error);
		return lookupValue;
	}
}
