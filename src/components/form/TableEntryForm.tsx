import React, { useState, useEffect } from "react";
import StepActions from "@components/form/StepActions";
import { ActionType } from "@constants/enums";
import { applyConditions } from "@services/conditions";

interface FieldAction {
	Id: string;
	Name: string;
	Order: number;
	ChildOrder: number;
	Type: number;
	Properties: any;
}

interface FormStep {
	Id: string;
	Name: string;
	EntityLogicalName: string;
	ReferencingAttributeLogicalName: string | null;
	Order: number;
	Actions: FieldAction[];
	Conditions: any[];
}

interface TableEntryActionConfig {
	ChildEntityLogicalName: string;
	RelationshipName: string;
	ValidationMessage?: string;
	CreateEnabled: boolean;
	EditEnabled: boolean;
	DeleteEnabled: boolean;
	ValidationType?: number;
	ReferencingAttribute: string;
	ReferencingNavigationProperty?: string;
	ChildFormSteps: FormStep[];
	ChildViewSteps: FormStep[];
}

interface TableEntryFormProps {
	config: TableEntryActionConfig;
	initialData: any | null;
	parentRecordId?: string;
	parentEntityName?: string;
	parentFormState?: any;
	nodeId?: string;
	onSave: (data: any) => void;
	onCancel: () => void;
	onValidate?: (args: { actions: FieldAction[]; entityName?: string; values: Record<string, any> }) => Array<{ message: string }>;
}

export const TableEntryForm: React.FC<TableEntryFormProps> = ({
	config,
	initialData,
	parentRecordId,
	parentEntityName,
	parentFormState,
	nodeId,
	onSave,
	onCancel,
	onValidate,
}) => {
	const [formData, setFormData] = useState<any>(initialData || {});
	const [validationMessages, setValidationMessages] = useState<string[]>([]);
	const metadataRef = React.useRef<Record<string, any>>({});
	const recordId = initialData?.id;
	const getFieldKey = React.useCallback((path: string) => {
		const parts = String(path).split(".");
		return parts[parts.length - 1] || path;
	}, []);

	useEffect(() => {
		setFormData(initialData || {});
	}, [initialData]);

	const registerField = React.useCallback(
		(path: string, metadata: any, initialValue?: any) => {
			metadataRef.current[path] = metadata;

			if (initialValue !== undefined) {
				const key = getFieldKey(path);
				setFormData((prev) => (prev[key] === undefined ? { ...prev, [key]: initialValue } : prev));
			}
		},
		[getFieldKey]
	);

	const updateFieldValue = React.useCallback(
		(path: string, value: any) => {
			const key = getFieldKey(path);
			setFormData((prev) => ({ ...prev, [key]: value }));
		},
		[getFieldKey]
	);

	const getFieldValue = React.useCallback(
		(path: string) => {
			const key = getFieldKey(path);
			return formData?.[key] ?? null;
		},
		[formData, getFieldKey]
	);

	const localFormState = React.useMemo(
		() => ({
			type: "tableEntry",
			nodeId,
			recordId,
			primaryEntityName: config.ChildEntityLogicalName,
			parentEntityName,
			parentRecordId,
			registerField,
			updateFieldValue,
			getFieldValue,
			getFieldMetadata: (path: string) => metadataRef.current[path],
			addUploadNode: parentFormState?.addUploadNode,
			getUploadNodes: parentFormState?.getUploadNodes,
			deleteNode: parentFormState?.deleteNode,
			getNodeById: parentFormState?.getNodeById,
			findNodeByRecordId: parentFormState?.findNodeByRecordId,
			getEntityNode: parentFormState?.getEntityNode,
		}),
		[config.ChildEntityLogicalName, getFieldValue, nodeId, parentEntityName, parentRecordId, parentFormState, recordId, registerField, updateFieldValue]
	);

	const childConditionRuntime = React.useMemo(() => {
		return applyConditions((config.ChildFormSteps || []) as any, {
			getFieldValue: (path: string) => getFieldValue(path),
		});
	}, [config.ChildFormSteps, getFieldValue]);

	React.useEffect(() => {
		childConditionRuntime.fieldUpdates.forEach(({ path, value }) => {
			const key = getFieldKey(path);
			setFormData((prev) => (prev?.[key] === value ? prev : { ...prev, [key]: value }));
		});
	}, [childConditionRuntime.fieldUpdates, getFieldKey]);

	const conditionedChildSteps = childConditionRuntime.steps;

	// Collect all actions from all steps
	const actionItems = React.useMemo(() => {
		const items: Array<{ action: FieldAction; entityName?: string }> = [];
		(conditionedChildSteps || []).forEach((step: any) => {
			(step.Actions || []).forEach((action: FieldAction) => {
				items.push({ action, entityName: step.EntityLogicalName });
			});
		});

		return items.sort((a, b) => (a.action.Order ?? 0) - (b.action.Order ?? 0));
	}, [conditionedChildSteps]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		const { id, _isNew, _isPending, ...cleanedFormData } = formData ?? {};

		// Add parent record reference
		const referencingKey = config.ReferencingNavigationProperty || config.ReferencingAttribute;
		const dataToSave =
			referencingKey && parentRecordId
				? {
						...cleanedFormData,
						[referencingKey]: parentRecordId,
					}
				: { ...cleanedFormData };

		const validationResults =
			onValidate?.({ actions: actionItems.map((item) => item.action), entityName: config.ChildEntityLogicalName, values: dataToSave }) ?? [];
		if (validationResults.length > 0) {
			setValidationMessages(validationResults.map((item) => item.message));
			return;
		}
		setValidationMessages([]);
		onSave(dataToSave);
	};

	const hasFieldInputs = actionItems.some((item) => item.action?.Type === ActionType.FieldInput);

	if (!hasFieldInputs) {
		return (
			<div className="table-entry-form">
				<p>No fields are configured for this form.</p>
				<div className="form-actions">
					<button type="button" className="btn btn-default" onClick={onCancel}>
						Close
					</button>
				</div>
			</div>
		);
	}

	return (
		<form onSubmit={handleSubmit} className="table-entry-form">
			<p className="control-label block text-right mb-4 required-legend">Required</p>
			{validationMessages.length > 0 && (
				<div className="alert alert-danger table-entry-validation" role="alert">
					<ul className="validation-summary-list">
						{validationMessages.map((message, index) => (
							<li key={`table-entry-validation-${index}`}>{message}</li>
						))}
					</ul>
				</div>
			)}
			<div className="form-fields">
				<StepActions actionItems={actionItems} formState={localFormState} />
			</div>

			<div className="table-entry-form-actions">
				<button type="button" className="btn btn-default" onClick={onCancel}>
					Cancel
				</button>
				<button type="submit" className="btn btn-primary">
					Save
				</button>
			</div>
		</form>
	);
};

export default TableEntryForm;
