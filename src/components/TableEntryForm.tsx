import React, { useState } from "react";
import FieldInput from "./fields/FieldInput.jsx";
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
	ChildFormSteps: FormStep[];
	ChildViewSteps: FormStep[];
}

interface TableEntryFormProps {
	config: TableEntryActionConfig;
	initialData: any | null;
	parentRecordId?: string;
	onSave: (data: any) => void;
	onCancel: () => void;
}

export const TableEntryForm: React.FC<TableEntryFormProps> = ({ config, initialData, parentRecordId, onSave, onCancel }) => {
	const [formData, setFormData] = useState<any>(initialData || {});

	// Collect all field actions from all steps
	const allFieldActions = React.useMemo(() => {
		const actions: FieldAction[] = [];
		config.ChildFormSteps.forEach((step) => {
			step.Actions.forEach((action) => {
				if (action.Type === ActionType.FieldInput) {
					actions.push(action);
				}
			});
		});
		return actions.sort((a, b) => a.Order - b.Order);
	}, [config]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		// Add parent record reference
		const dataToSave = {
			...formData,
			[config.ReferencingAttribute]: parentRecordId,
		};

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
				{allFieldActions.map((action) => (
					<FieldInput key={action.Id ?? action.Name} action={action} />
				))}
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
