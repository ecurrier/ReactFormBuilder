import React from "react";
import PropTypes from "prop-types";
import { FieldInput, TableEntryAction, DocumentUploadControl } from "@components";
import { ActionType } from "@constants/enums";

const StepActions = ({ actionItems, formState, tableEntryOptions }) => {
	if (!Array.isArray(actionItems) || actionItems.length === 0) {
		return null;
	}

	return (
		<>
			{actionItems.map(({ action, entityName }) => {
				if (!action) {
					return null;
				}

				const actionKey = action.Id ?? action.Name;

				if (action.Type === ActionType.FieldInput) {
					return <FieldInput key={actionKey} action={action} formState={formState} entityName={entityName} />;
				}

				if (action.Type === ActionType.TableEntry) {
					const fetchFunc = tableEntryOptions?.fetchFunctions?.get(actionKey);
					const fetchData = fetchFunc ?? tableEntryOptions?.fallbackFetch;

					if (!fetchData) {
						return null;
					}

					return (
						<TableEntryAction
							key={actionKey}
							config={action.Properties}
							fetchData={fetchData}
							shouldLoadData={tableEntryOptions?.shouldLoadData}
							parentRecordId={tableEntryOptions?.parentRecordId}
							parentEntityName={tableEntryOptions?.parentEntityName}
							formState={formState}
							onSave={tableEntryOptions?.onSave}
							onDelete={tableEntryOptions?.onDelete}
						/>
					);
				}

				if (action.Type === ActionType.FileUpload) {
					return <DocumentUploadControl key={actionKey} config={action.Properties} formState={formState} />;
				}

				return null;
			})}
		</>
	);
};

StepActions.propTypes = {
	actionItems: PropTypes.arrayOf(
		PropTypes.shape({
			action: PropTypes.object,
			entityName: PropTypes.string,
		})
	),
	formState: PropTypes.object.isRequired,
	tableEntryOptions: PropTypes.shape({
		fetchFunctions: PropTypes.instanceOf(Map),
		fallbackFetch: PropTypes.func,
		shouldLoadData: PropTypes.bool,
		parentRecordId: PropTypes.string,
		parentEntityName: PropTypes.string,
		onSave: PropTypes.func,
		onDelete: PropTypes.func,
	}),
};

StepActions.defaultProps = {
	actionItems: [],
	tableEntryOptions: undefined,
};

export default StepActions;
