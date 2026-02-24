import React from "react";
import { FieldInput, TableEntryAction, DocumentUploadControl } from "@components";
import { ActionType } from "@constants/enums";
import type { ReactActionConfiguration } from "@app-types";

type StepActionsProps = {
	actionItems?: Array<{ action: ReactActionConfiguration; entityName?: string }>;
	formState: any;
	getFieldIssues?: (fieldId: string) => Array<{ message: string; severity: "error" | "warning" }>;
	onFieldChangeClearIssues?: (fieldId: string) => void;
	onValidateTableEntryForm?: (args: { actions: ReactActionConfiguration[]; entityName?: string; values: Record<string, any> }) => Array<{ message: string }>;
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

const StepActions: React.FC<StepActionsProps> = ({
	actionItems = [],
	formState,
	getFieldIssues,
	onFieldChangeClearIssues,
	onValidateTableEntryForm,
	tableEntryOptions,
}) => {
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
				const actionAnchorId = `action-${actionKey}`;

				if (action.Type === ActionType.FieldInput) {
					return (
						<div key={String(actionKey)} id={actionAnchorId}>
							<FieldInput
								action={action}
								formState={formState}
								entityName={entityName}
								getFieldIssues={getFieldIssues}
								onFieldChangeClearIssues={onFieldChangeClearIssues}
							/>
						</div>
					);
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
						<div key={String(actionKey)} id={actionAnchorId}>
							<TableEntryAction
								config={action.Properties}
								fetchData={fetchData}
								shouldLoadData={tableEntryOptions?.shouldLoadData}
								parentRecordId={tableEntryOptions?.parentRecordId}
								parentEntityName={tableEntryOptions?.parentEntityName}
								formState={formState}
								onSave={tableEntryOptions?.onSave}
								onDelete={tableEntryOptions?.onDelete}
								onValidateTableEntryForm={onValidateTableEntryForm}
							/>
						</div>
					);
				}

				if (action.Type === ActionType.FileUpload) {
					if ((action.Properties as any)?.__conditionHidden) {
						return null;
					}

					return (
						<div key={String(actionKey)} id={actionAnchorId}>
							<DocumentUploadControl config={action.Properties} formState={formState} entityName={entityName} />
						</div>
					);
				}

				return null;
			})}
		</>
	);
};

export default StepActions;
