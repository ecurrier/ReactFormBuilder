import React, { useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import StepActions from "./StepActions.jsx";
import { ActionType } from "../constants/enums.js";
import { createRecord, deleteRecord, retrieveMultipleRecords, updateRecord } from "../hooks/api/Api.ts";
import { buildFetchXmlForChildRecords } from "../utilities/FetchXmlBuilder.ts";
import { resolvePrimaryIdAttribute } from "../utilities/entityMetadata";

const Step = ({ step, isActive, hasBeenVisited, positionLabel, recordId, formState, urlParams }) => {
	// Memoize sorted actions to prevent infinite loops
	const actions = useMemo(() => {
		return Array.isArray(step.Actions) ? [...step.Actions].sort((a, b) => (a.Order ?? 0) - (b.Order ?? 0)) : [];
	}, [step.Actions]);

	const primaryEntityName = formState?.primaryEntityName;
	const primaryRecordId = recordId || formState?.recordId;
	const getRelatedRecord = formState?.getRelatedRecord;

	// Memoize fetchData functions for each TableEntry action to prevent recreation on every render
	const tableEntryFetchFunctions = useMemo(() => {
		const fetchFuncs = new Map();

		actions.forEach((action) => {
			if (action.Type === ActionType.TableEntry) {
				const config = action.Properties;
				const fetchFunc = async (sort, pagination) => {
					// Only fetch if we have a recordId
					const resolvedParentRecordId =
						step.EntityLogicalName && primaryEntityName && step.EntityLogicalName !== primaryEntityName
							? getRelatedRecord?.(step.EntityLogicalName)?.recordId
							: primaryRecordId;

					if (!resolvedParentRecordId) {
						return {
							results: [],
							totalRecordCount: 0,
						};
					}

					const columns = config.ChildViewSteps?.[0]?.Actions?.map((a) => a.Properties.LogicalName).filter(Boolean) || [];
					const primaryKey = resolvePrimaryIdAttribute(config.ChildEntityLogicalName);
					if (!columns.includes(primaryKey)) {
						columns.push(primaryKey);
					}

					const fetchXml = buildFetchXmlForChildRecords(config.ChildEntityLogicalName, config.ReferencingAttribute, resolvedParentRecordId, columns);

					try {
						const options = {};
						if (sort?.key) {
							options.orderBy = `${sort.key} ${sort.direction}`;
						}
						if (pagination) {
							options.pagination = pagination;
						}

						const response = await retrieveMultipleRecords(config.ChildEntityLogicalName, fetchXml, options);

						return {
							results: response.results,
							totalRecordCount: response.totalRecordCount || 0,
						};
					} catch (error) {
						console.error("Error fetching child records:", error);
						return {
							results: [],
							totalRecordCount: 0,
						};
					}
				};

				fetchFuncs.set(action.Id ?? action.Name, fetchFunc);
			}
		});

		return fetchFuncs;
	}, [actions, getRelatedRecord, primaryEntityName, primaryRecordId, step.EntityLogicalName]);

	// Stable callbacks for TableEntry actions
	const sanitizeTableEntryData = useCallback((entityName, data, referencingAttribute, referencingNavigationProperty) => {
		if (!data || typeof data !== "object") {
			return {};
		}

		const primaryKey = resolvePrimaryIdAttribute(entityName);
		const keysToDrop = new Set(["id", primaryKey, "_isNew", "_isPending", referencingAttribute, referencingNavigationProperty]);

		const entries = Object.entries(data).filter(([key]) => {
			if (!key) {
				return false;
			}

			if (keysToDrop.has(key)) {
				return false;
			}

			if (key.startsWith("_") || key.startsWith("@") || key.includes("@")) {
				return false;
			}

			return true;
		});

		return Object.fromEntries(entries);
	}, []);

	const handleTableEntrySave = useCallback(
		async (entityName, data, rowRecordId, referencingAttribute, referencingNavigationProperty) => {
			const cleanedData = sanitizeTableEntryData(entityName, data, referencingAttribute, referencingNavigationProperty);

			if (rowRecordId) {
				await updateRecord(entityName, rowRecordId, cleanedData);
			} else {
				await createRecord(entityName, cleanedData);
			}
		},
		[sanitizeTableEntryData]
	);

	const handleTableEntryDelete = useCallback(async (entityName, rowRecordId) => {
		await deleteRecord(entityName, rowRecordId);
	}, []);

	if (actions.length === 0) {
		return null;
	}

	const stepIdentifier = step.Id ?? step.Name ?? "step";
	const entityName = step.EntityLogicalName ?? "Not specified";

	const actionItems = actions.map((action) => ({
		action,
		entityName: step.EntityLogicalName,
	}));

	const tableEntryOptions = {
		fetchFunctions: tableEntryFetchFunctions,
		fallbackFetch: async () => ({ results: [], totalRecordCount: 0 }),
		shouldLoadData: hasBeenVisited,
		parentRecordId:
			step.EntityLogicalName && primaryEntityName && step.EntityLogicalName !== primaryEntityName
				? getRelatedRecord?.(step.EntityLogicalName)?.recordId
				: primaryRecordId,
		parentEntityName: step.EntityLogicalName,
		onSave: handleTableEntrySave,
		onDelete: handleTableEntryDelete,
	};

	return (
		<div className="step" style={{ display: isActive ? "block" : "none" }}>
			<h2 className="form-subheading">{step.Name ?? entityName}</h2>
			{step.Description && <div className="instructions" dangerouslySetInnerHTML={{ __html: step.Description }} />}
			<p className="control-label block text-right mb-4 required-legend">Required</p>
			<div className="multi-step-form-main-content">
				<div className="actions">
					<StepActions actionItems={actionItems} formState={formState} tableEntryOptions={tableEntryOptions} />
				</div>
			</div>
		</div>
	);
};
Step.propTypes = {
	step: PropTypes.shape({
		Id: PropTypes.string,
		Name: PropTypes.string,
		Description: PropTypes.string,
		EntityLogicalName: PropTypes.string,
		ReferencingAttributeLogicalName: PropTypes.string,
		Order: PropTypes.number,
		Actions: PropTypes.arrayOf(PropTypes.object),
	}).isRequired,
	isActive: PropTypes.bool.isRequired,
	hasBeenVisited: PropTypes.bool.isRequired,
	positionLabel: PropTypes.string,
	recordId: PropTypes.string,
	formState: PropTypes.object.isRequired,
	urlParams: PropTypes.object,
};

Step.defaultProps = {
	positionLabel: undefined,
	recordId: undefined,
	urlParams: undefined,
};

export default Step;
