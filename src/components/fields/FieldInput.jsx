import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { DataType, ActionType } from "../../constants/enums.js";

const formatDescription = (description) => {
	if (!description) {
		return null;
	}

	const trimmed = description.trim();

	if (trimmed.startsWith("<")) {
		return <span className="help-block" dangerouslySetInnerHTML={{ __html: trimmed }} />;
	}

	return <span className="help-block">{trimmed}</span>;
};

const getPlaceholder = (dataType) => {
	switch (dataType) {
		case DataType.MultiLineText:
			return "Please provide additional details...";
		case DataType.WholeNumber:
		case DataType.Decimal:
		case DataType.Currency:
			return "Please enter a numeric value...";
		case DataType.Lookup:
			return "Please search for a record...";
		case DataType.SingleLineText:
			return "Please enter a value...";
		default:
			return [DataType.YesNo, DataType.Choice].includes(dataType) ? undefined : "Please input a value...";
	}
};

const renderInput = (properties, inputId, placeholder, value, onChange) => {
	const commonProps = {
		id: inputId,
		name: properties.LogicalName ?? inputId,
		readOnly: properties.IsReadOnly,
		required: properties.IsRequired,
		className: "form-control",
		value: value ?? "",
		onChange: (e) => onChange(e.target.value),
	};

	if (placeholder) {
		commonProps.placeholder = placeholder;
	}

	switch (properties.DataType) {
		case DataType.MultiLineText:
			return (
				<>
					<textarea {...commonProps} rows={4} maxLength={properties.MaxLength} />
					<span className="ui"></span>
				</>
			);
		case DataType.YesNo:
			// Radio buttons for Yes/No
			return (
				<fieldset required={properties.IsRequired} role="radiogroup">
					<div className="radio-inline">
						<label>
							<input
								type="radio"
								name={commonProps.name}
								id={`${inputId}-yes`}
								value="yes"
								checked={value === true || value === "yes"}
								onChange={(e) => onChange(true)}
								required={properties.IsRequired}
								disabled={properties.IsReadOnly}
							/>
							Yes
							<span className="ui"></span>
						</label>
					</div>
					<div className="radio-inline">
						<label>
							<input
								type="radio"
								name={commonProps.name}
								id={`${inputId}-no`}
								value="no"
								checked={value === false || value === "no"}
								onChange={(e) => onChange(false)}
								required={properties.IsRequired}
								disabled={properties.IsReadOnly}
							/>
							No
							<span className="ui"></span>
						</label>
					</div>
				</fieldset>
			);
		case DataType.WholeNumber:
		case DataType.Decimal:
		case DataType.Currency:
			return (
				<>
					<input {...commonProps} type="number" step="any" />
					<span className="ui"></span>
				</>
			);
		case DataType.SingleLineText:
		case DataType.Lookup:
			return (
				<>
					<input {...commonProps} type="text" maxLength={properties.MaxLength} />
					<span className="ui"></span>
				</>
			);
		case DataType.Choice: {
			const choices = Array.isArray(properties.Choices) ? properties.Choices : [];
			if (choices.length === 0) {
				return (
					<div className="choice-placeholder" role="note">
						No options are configured for this field yet.
					</div>
				);
			}

			const multiSelect = Boolean(properties.CanSelectMultiple);
			const selectProps = {
				...commonProps,
				value: multiSelect ? (Array.isArray(value) ? value : []) : (value ?? ""),
				multiple: multiSelect,
			};

			if (properties.IsReadOnly) {
				selectProps.disabled = true;
			}

			if (multiSelect && choices.length > 3) {
				selectProps.size = Math.min(choices.length, 6);
			}

			return (
				<>
					<select {...selectProps}>
						{!multiSelect ? (
							<option value="" disabled hidden>
								Select an option...
							</option>
						) : null}
						{choices.map((choice) => (
							<option key={choice.Value ?? choice.Label} value={choice.Value ?? choice.Label}>
								{choice.Label ?? choice.Value ?? "Option"}
							</option>
						))}
					</select>
					<span className="ui"></span>
				</>
			);
		}
		default:
			return (
				<>
					<input {...commonProps} type="text" />
					<span className="ui"></span>
				</>
			);
	}
};

const FieldInput = ({ action, formState }) => {
	const properties = action?.Properties ?? {};
	const inputId = properties.LogicalName ?? action.Id ?? action.Name ?? "field-input";
	const label = properties.Label ?? action.Name ?? properties.LogicalName;
	const childFieldActions = Array.isArray(properties.ChildActions)
		? properties.ChildActions.filter((child) => child.Type === ActionType.FieldInput).sort((a, b) => (a.Order ?? 0) - (b.Order ?? 0))
		: [];
	const hasChildFieldInputs = childFieldActions.length > 0;
	const placeholder = hasChildFieldInputs ? undefined : getPlaceholder(properties.DataType);

	// Get entity name from properties or default to primary entity
	const entityName = properties.EntityName || formState?.primaryEntityName || "";
	const fieldPath = `${entityName}.${properties.LogicalName}`;

	// Get field value from formState
	const fieldValue = formState?.getFieldValue(fieldPath);

	// Register field with formState on mount (only once)
	useEffect(() => {
		if (formState && properties.LogicalName && !hasChildFieldInputs) {
			// Check if field is already registered to avoid re-registration
			const existingMetadata = formState.getFieldMetadata?.(fieldPath);
			if (!existingMetadata) {
				formState.registerField(fieldPath, {
					entityName,
					logicalName: properties.LogicalName,
					schemaName: properties.SchemaName || properties.LogicalName,
					dataType: properties.DataType,
					navigationProperty: properties.NavigationProperty,
					referencingAttribute: properties.ReferencingAttribute,
				});
			}
		}
		// Only run once on mount - eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Handle field value change
	const handleChange = (newValue) => {
		if (formState) {
			formState.updateFieldValue(fieldPath, newValue);
		}
	};

	if (hasChildFieldInputs) {
		return (
			<div className={`field-collection${properties.IsHidden ? " hidden-field" : ""}`} role="group" aria-label={label ?? "Nested fields"}>
				{label ? <p className="field-collection-title">{label}</p> : null}
				{formatDescription(properties.Description)}
				<div className="child-action-group">
					{childFieldActions.map((child) => (
						<FieldInput key={child.Id ?? child.Name} action={child} formState={formState} />
					))}
				</div>
			</div>
		);
	}

	const fieldClassNames = ["field", "form-group"];
	if (properties.IsHidden) {
		fieldClassNames.push("hidden-field");
	}
	if (properties.IsReadOnly) {
		fieldClassNames.push("readonly-field");
	}

	const labelClassNames = ["control-label"];
	if (properties.IsRequired) {
		labelClassNames.push("required");
	}

	// Check if this is a YesNo field to use fieldset/legend instead of label
	const isYesNo = properties.DataType === DataType.YesNo;

	return (
		<div className={fieldClassNames.join(" ")}>
			{isYesNo ? (
				// For radio buttons, use legend instead of label
				label && (
					<fieldset required={properties.IsRequired} role="radiogroup">
						<legend className={`legend--label ${labelClassNames.join(" ")}`}>{label}</legend>
						{renderInput(properties, inputId, placeholder, fieldValue, handleChange)}
					</fieldset>
				)
			) : (
				<>
					{label && (
						<label htmlFor={inputId} className={labelClassNames.join(" ")}>
							{label}
						</label>
					)}
					{renderInput(properties, inputId, placeholder, fieldValue, handleChange)}
				</>
			)}
			{formatDescription(properties.Description)}
			{properties.ValidationMessage ? (
				<span className="help-block" role="alert">
					{properties.ValidationMessage}
				</span>
			) : null}
		</div>
	);
};

FieldInput.propTypes = {
	action: PropTypes.shape({
		Id: PropTypes.string,
		Name: PropTypes.string,
		Properties: PropTypes.shape({
			LogicalName: PropTypes.string,
			Label: PropTypes.string,
			DataType: PropTypes.number,
			Description: PropTypes.string,
			IsRequired: PropTypes.bool,
			IsReadOnly: PropTypes.bool,
			IsHidden: PropTypes.bool,
			ValidationMessage: PropTypes.string,
			ChildActions: PropTypes.arrayOf(PropTypes.object),
			Choices: PropTypes.arrayOf(
				PropTypes.shape({
					Value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
					Label: PropTypes.string,
				})
			),
			CanSelectMultiple: PropTypes.bool,
		}),
	}).isRequired,
};

export default FieldInput;
