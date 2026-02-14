import React from "react";
import { FieldInput, TableEntryAction, DocumentUploadControl } from "@components";
import { ActionType } from "@constants/enums";
import type { ReactActionConfiguration } from "@app-types";

type StepActionsProps = {
	actionItems?: Array<{ action: ReactActionConfiguration; entityName?: string }>;
	formState: any;
	tableEntryOptions?: {
		fetchFunctions?: Map<string, any>;
		fallbackFetch?: (...args: any[]) => Promise<{ results: any[]; totalRecordCount: number }>;
		shouldLoadData?: boolean;
		parentRecordId?: string;
		parentEntityName?: string;
		onSave?: (...args: any[]) => Promise<void>;
		onDelete?: (...args: any[]) => Promise<void>;
	};
};

const StepActions: React.FC<StepActionsProps> = ({ actionItems = [], formState, tableEntryOptions }) => {
	const normalizedActionItems = (actionItems ?? []) as Array<{ action: ReactActionConfiguration; entityName?: string }>;

	if (!Array.isArray(normalizedActionItems) || normalizedActionItems.length === 0) {
		return null;
	}

	return (
		<>
			{normalizedActionItems.map(({ action, entityName }) => {
				if (!action) {
					return null;
				}

				const actionKey = action.Id ?? action.Name;

				if (action.Type === ActionType.FieldInput) {
					return <FieldInput key={actionKey} action={action} formState={formState} entityName={entityName} />;
				}

				if (action.Type === ActionType.TableEntry) {
					if ((action.Properties as any)?.__conditionHidden) {
						return null;
					}

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
					if ((action.Properties as any)?.__conditionHidden) {
						return null;
					}

					return <DocumentUploadControl key={actionKey} config={action.Properties} formState={formState} entityName={entityName} />;
				}

				return null;
			})}
		</>
	);
};

export default StepActions;
