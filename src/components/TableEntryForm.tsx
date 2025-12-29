import React, { useState } from "react";
import FieldInput from "./fields/FieldInput.jsx";
import DocumentUpload from "./fields/DocumentUpload";
import { ActionType } from "../constants/enums.js";

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
	formState?: any;
	formConfig?: any;
	onSave: (data: any) => void;
	onCancel: () => void;
}

export const TableEntryForm: React.FC<TableEntryFormProps> = ({ config, initialData, parentRecordId, formState, formConfig, onSave, onCancel }) => {
	const [formData, setFormData] = useState<any>(initialData || {});
	const metadataRef = React.useRef<Record<string, any>>({});
	const getFieldKey = React.useCallback((path: string) => {
		const parts = String(path).split(".");
		return parts[parts.length - 1] || path;
	}, []);

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
			primaryEntityName: config.ChildEntityLogicalName,
			registerField,
			updateFieldValue,
			getFieldValue,
			getFieldMetadata: (path: string) => metadataRef.current[path],
		}),
		[config.ChildEntityLogicalName, getFieldValue, registerField, updateFieldValue]
	);

	// Collect all field actions from all steps
	const allFieldActions = React.useMemo(() => {
		const actions: Array<{ action: FieldAction; entityName?: string }> = [];
		(config.ChildFormSteps || []).forEach((step) => {
			(step.Actions || []).forEach((action) => {
				if (action.Type === ActionType.FieldInput || action.Type === ActionType.FileUpload) {
					actions.push({ action, entityName: step.EntityLogicalName });
				}
			});
		});
		return actions.sort((a, b) => (a.action.Order ?? 0) - (b.action.Order ?? 0));
	}, [config.ChildFormSteps]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		// Add parent record reference
		const referencingKey = config.ReferencingNavigationProperty || config.ReferencingAttribute;
		const dataToSave =
			referencingKey && parentRecordId
				? {
						...formData,
						[referencingKey]: parentRecordId,
					}
				: { ...formData };

		onSave(dataToSave);
	};

	if (allFieldActions.length === 0) {
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
				{allFieldActions.map(({ action, entityName }) => {
					if (action.Type === ActionType.FileUpload) {
						if (!formConfig) {
							return null;
						}
						return (
							<DocumentUpload
								key={action.Id ?? action.Name}
								action={action}
								entityName={entityName}
								recordId={initialData?.id}
								formState={formState}
								formConfig={formConfig}
							/>
						);
					}

					return (
						<FieldInput key={action.Id ?? action.Name} action={action} formState={localFormState} entityName={entityName} />
					);
				})}
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
