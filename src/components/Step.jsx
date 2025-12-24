import React, { useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import FieldInput from "./fields/FieldInput.jsx";
import TableEntryAction from "./TableEntryAction.tsx";
import { ActionType } from "../constants/enums.js";
import { retrieveMultipleRecords } from "../hooks/api/Api.ts";
import { buildFetchXmlForChildRecords } from "../utilities/FetchXmlBuilder.ts";

const Step = ({ step, isActive, hasBeenVisited, positionLabel, recordId, formState, urlParams }) => {
	// Memoize sorted actions to prevent infinite loops
	const actions = useMemo(() => {
		return Array.isArray(step.Actions) ? [...step.Actions].sort((a, b) => (a.Order ?? 0) - (b.Order ?? 0)) : [];
	}, [step.Actions]);

	// Memoize fetchData functions for each TableEntry action to prevent recreation on every render
	const tableEntryFetchFunctions = useMemo(() => {
		const fetchFuncs = new Map();

		actions.forEach((action) => {
			if (action.Type === ActionType.TableEntry) {
				const config = action.Properties;
				const fetchFunc = async (sort, pagination) => {
					// Only fetch if we have a recordId
					if (!recordId) {
						return {
							results: [],
							totalRecordCount: 0,
						};
					}

					const columns = config.ChildViewSteps?.[0]?.Actions?.map((a) => a.Properties.LogicalName) || [];
					const fetchXml = buildFetchXmlForChildRecords(config.ChildEntityLogicalName, config.ReferencingAttribute, recordId, columns);

					try {
						const response = await retrieveMultipleRecords(config.ChildEntityLogicalName, fetchXml, {});

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
	}, [actions, recordId]);

	// Stable callbacks for TableEntry actions
	const handleTableEntrySave = useCallback(async (data, recordId) => {
		// TODO: Implement API call
		console.log("Save table entry:", data, recordId);
	}, []);

	const handleTableEntryDelete = useCallback(async (recordId) => {
		// TODO: Implement
		console.log("Delete table entry:", recordId);
	}, []);

	if (actions.length === 0) {
		return null;
	}

	const stepIdentifier = step.Id ?? step.Name ?? "step";
	const entityName = step.EntityLogicalName ?? "Not specified";

	return (
		<div className="step" style={{ display: isActive ? "block" : "none" }}>
			<h2 className="form-subheading">{step.Name ?? entityName}</h2>
			{step.Description && <div className="instructions" dangerouslySetInnerHTML={{ __html: step.Description }} />}
			<p className="control-label block text-right mb-4 required-legend">Required</p>
			<div className="multi-step-form-main-content">
				<div className="actions">
					{actions.map((action) => {
						if (action.Type === ActionType.FieldInput) {
							return <FieldInput key={action.Id ?? action.Name} action={action} formState={formState} entityName={step.EntityLogicalName} />;
						}

						if (action.Type === ActionType.TableEntry) {
							const fetchFunc = tableEntryFetchFunctions.get(action.Id ?? action.Name);

							return (
								<TableEntryAction
									key={action.Id ?? action.Name}
									config={action.Properties}
									fetchData={fetchFunc}
									shouldLoadData={hasBeenVisited}
									parentRecordId={recordId}
									parentEntityName={step.EntityLogicalName}
									formState={formState}
									onSave={handleTableEntrySave}
									onDelete={handleTableEntryDelete}
								/>
							);
						}
						return null;
					})}
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
