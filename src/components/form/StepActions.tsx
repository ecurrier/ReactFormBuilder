import React from "react";
import PropTypes from "prop-types";
import FieldInput from "@components/form/fields/FieldInput";
import TableEntryAction from "@components/form/TableEntryAction";
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

				if (action.Type === ActionType.FieldInput) {
					return <FieldInput key={action.Id ?? action.Name} action={action} formState={formState} entityName={entityName} />;
				}

				if (action.Type === ActionType.TableEntry) {
					const actionKey = action.Id ?? action.Name;
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
