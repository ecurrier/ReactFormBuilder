import React, { useState, useEffect } from "react";
import StepActions from "@components/form/StepActions";
import { ActionType } from "@constants/enums";

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
	onSave: (data: any) => void;
	onCancel: () => void;
}

export const TableEntryForm: React.FC<TableEntryFormProps> = ({
	config,
	initialData,
	parentRecordId,
	parentEntityName,
	parentFormState,
	onSave,
	onCancel,
}) => {
	const [formData, setFormData] = useState<any>(initialData || {});
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

	const addPendingDocumentUpload = React.useCallback(
		(upload: any) => {
			parentFormState?.addPendingDocumentUpload?.(upload);
		},
		[parentFormState]
	);

	const deletePendingDocumentUpload = React.useCallback(
		(key: string) => {
			parentFormState?.deletePendingDocumentUpload?.(key);
		},
		[parentFormState]
	);

	const getPendingDocumentUploads = React.useCallback(
		(entityName?: string, folderName?: string, childRecordId?: string) => {
			return parentFormState?.getPendingDocumentUploads?.(entityName, folderName, childRecordId) ?? [];
		},
		[parentFormState]
	);

	const clearPendingDocumentUploads = React.useCallback(
		(entityName?: string) => {
			parentFormState?.clearPendingDocumentUploads?.(entityName);
		},
		[parentFormState]
	);

	const localFormState = React.useMemo(
		() => ({
			type: "tableEntry",
			recordId,
			primaryEntityName: config.ChildEntityLogicalName,
			parentEntityName,
			parentRecordId,
			registerField,
			updateFieldValue,
			getFieldValue,
			getFieldMetadata: (path: string) => metadataRef.current[path],
			addPendingDocumentUpload,
			deletePendingDocumentUpload,
			getPendingDocumentUploads,
			clearPendingDocumentUploads,
		}),
		[
			addPendingDocumentUpload,
			clearPendingDocumentUploads,
			config.ChildEntityLogicalName,
			deletePendingDocumentUpload,
			getFieldValue,
			getPendingDocumentUploads,
			parentEntityName,
			parentRecordId,
			recordId,
			registerField,
			updateFieldValue,
		]
	);

	// Collect all actions from all steps
	const actionItems = React.useMemo(() => {
		const items: Array<{ action: FieldAction; entityName?: string }> = [];
		(config.ChildFormSteps || []).forEach((step) => {
			(step.Actions || []).forEach((action) => {
				items.push({ action, entityName: step.EntityLogicalName });
			});
		});

		return items.sort((a, b) => (a.action.Order ?? 0) - (b.action.Order ?? 0));
	}, [config.ChildFormSteps]);

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
