import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { ActionType, DataType, DescriptionType } from "@constants/enums";
import { ChoiceInput, CurrencyInput, DateTimeInput, LookupControl, MultiLineTextInput, NumberInput, SingleLineTextInput, YesNoInput } from "@components";
import { getRealtimeValidationResult } from "@services/validation";

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

const getDescriptionType = (descriptionType, hasLabel) => {
	if (!descriptionType) {
		return DescriptionType.ShowBelowField;
	}

	if (!hasLabel && descriptionType === DescriptionType.ShowAboveLabel) {
		return DescriptionType.ShowAboveField;
	}

	return descriptionType;
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

const renderInput = (properties, inputId, placeholder, value, onChange, label) => {
	const commonProps: Record<string, any> = {
		id: inputId,
		name: properties.LogicalName ?? inputId,
		readOnly: properties.IsReadOnly,
		required: properties.IsRequired,
		className: "form-control",
		value: value ?? "",
		onChange: (eventOrValue) => {
			if (typeof eventOrValue === "string" || eventOrValue === null) {
				onChange(eventOrValue);
				return;
			}

			onChange(eventOrValue.target.value);
		},
	};

	if (placeholder) {
		commonProps.placeholder = placeholder;
	}

	switch (properties.DataType) {
		case DataType.MultiLineText:
			return <MultiLineTextInput commonProps={commonProps} maxLength={properties.MaxLength} />;
		case DataType.YesNo:
			return (
				<YesNoInput
					inputId={inputId}
					name={commonProps.name}
					value={value}
					isRequired={properties.IsRequired}
					isReadOnly={properties.IsReadOnly}
					onChange={onChange}
				/>
			);
		case DataType.WholeNumber:
		case DataType.Decimal:
			return <NumberInput commonProps={commonProps} minValue={properties.MinValue} maxValue={properties.MaxValue} />;
		case DataType.Currency:
			return <CurrencyInput commonProps={commonProps} minValue={properties.MinValue} maxValue={properties.MaxValue} />;
		case DataType.SingleLineText:
			return <SingleLineTextInput commonProps={commonProps} maxLength={properties.MaxLength} />;
		case DataType.Lookup:
			return (
				<>
					<LookupControl
						inputId={inputId}
						label={label}
						placeholder={placeholder}
						value={value}
						onChange={onChange}
						targets={properties.Targets || []}
						isReadOnly={properties.IsReadOnly}
						isRequired={properties.IsRequired}
					/>
					<span className="ui"></span>
				</>
			);
		case DataType.Choice: {
			return (
				<ChoiceInput
					commonProps={commonProps}
					choices={properties.Choices || []}
					value={value}
					canSelectMultiple={properties.CanSelectMultiple}
					isReadOnly={properties.IsReadOnly}
				/>
			);
		}
		case DataType.DateTime: {
			return <DateTimeInput commonProps={commonProps} dateTimeFormat={properties.DateTimeFormat} dateTimeBehavior={properties.DateTimeBehavior} />;
		}
		default:
			// This should be a hard error case, present an error alert in place of an input
			return (
				<>
					<input {...commonProps} type="text" />
					<span className="ui"></span>
				</>
			);
	}
};

export const FieldInput = ({ action, formState, entityName: stepEntityName }: { action: any; formState: any; entityName?: string; key?: string | number }) => {
	const properties = action?.Properties ?? {};
	const inputId = properties.LogicalName ?? action.Id ?? action.Name ?? "field-input";
	const label = properties.Label ?? action.Name ?? properties.LogicalName;
	const childFieldActions = Array.isArray(properties.ChildActions)
		? properties.ChildActions.filter((child) => child.Type === ActionType.FieldInput).sort((a, b) => (a.Order ?? 0) - (b.Order ?? 0))
		: [];
	const hasChildFieldInputs = childFieldActions.length > 0;
	const placeholder = hasChildFieldInputs ? undefined : getPlaceholder(properties.DataType);
	const descriptionElement = formatDescription(properties.Description);
	const resolvedDescriptionType = getDescriptionType(properties.DescriptionType, Boolean(label));
	const renderDescription = (placement) => (descriptionElement && resolvedDescriptionType === placement ? descriptionElement : null);
	const [hasBeenTouched, setHasBeenTouched] = useState(false);
	const [realtimeValidationMessage, setRealtimeValidationMessage] = useState<string | null>(null);

	// Get entity name from properties or default to primary entity
	const entityName = properties.EntityName || stepEntityName || formState?.primaryEntityName || "";
	const fieldPath = `${entityName}.${properties.LogicalName}`;

	// Get field value from formState
	const fieldValue = formState?.getFieldValue(fieldPath);

	useEffect(() => {
		setHasBeenTouched(false);
		setRealtimeValidationMessage(null);
	}, [fieldPath]);

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
			if (!hasBeenTouched) {
				setHasBeenTouched(true);
			}

			switch (properties.DataType) {
				case DataType.Decimal:
				case DataType.Currency:
					// TO-DO: Handle precision
					const parsedValue = parseFloat(newValue);
					newValue = isNaN(parsedValue) ? null : parsedValue;
					break;
				case DataType.WholeNumber:
					const intValue = parseInt(newValue, 10);
					newValue = isNaN(intValue) ? null : intValue;
					break;
				default:
					break;
			}

			const validationResult = getRealtimeValidationResult(newValue, properties);
			const nextMessage = validationResult.isValid ? null : validationResult.message || null;
			setRealtimeValidationMessage(nextMessage);

			formState.updateFieldValue(fieldPath, newValue);
		}
	};

	if (hasChildFieldInputs) {
		return (
			<div className={`field-collection${properties.IsHidden ? " hidden" : ""}`} role="group" aria-label={label ?? "Nested fields"}>
				{renderDescription(DescriptionType.ShowAboveLabel)}
				{label ? <p className="field-collection-title">{label}</p> : null}
				{renderDescription(DescriptionType.ShowAboveField)}
				<div className="child-action-group">
					{childFieldActions.map((child) => (
						<FieldInput key={child.Id ?? child.Name} action={child} formState={formState} entityName={entityName} />
					))}
				</div>
				{renderDescription(DescriptionType.ShowBelowField)}
			</div>
		);
	}

	const fieldClassNames = ["field", "form-group"];
	if (properties.IsHidden) {
		fieldClassNames.push("hidden");
	}
	if (properties.IsReadOnly) {
		fieldClassNames.push("readonly");
	}

	const labelClassNames = ["control-label"];
	if (properties.IsRequired) {
		labelClassNames.push("required");
	}

	// Check if this is a YesNo field to use fieldset/legend instead of label
	const isYesNo = properties.DataType === DataType.YesNo;

	return (
		<div className={fieldClassNames.join(" ")}>
			{renderDescription(DescriptionType.ShowAboveLabel)}
			{isYesNo ? (
				// For radio buttons, use legend instead of label
				label && (
					<fieldset required={properties.IsRequired} role="radiogroup">
						<legend className={`legend--label ${labelClassNames.join(" ")}`}>{label}</legend>
						{renderDescription(DescriptionType.ShowAboveField)}
						{renderInput(properties, inputId, placeholder, fieldValue, handleChange, label)}
					</fieldset>
				)
			) : (
				<>
					{label && (
						<label htmlFor={inputId} className={labelClassNames.join(" ")}>
							{label}
						</label>
					)}
					{renderDescription(DescriptionType.ShowAboveField)}
					{renderInput(properties, inputId, placeholder, fieldValue, handleChange, label)}
				</>
			)}
			{renderDescription(DescriptionType.ShowBelowField)}
			{hasBeenTouched && realtimeValidationMessage ? (
				<span className="help-block text-danger" role="alert">
					{realtimeValidationMessage}
				</span>
			) : null}
			{properties.ValidationMessage ? (
				<span className="help-block text-danger" role="alert">
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
			DescriptionType: PropTypes.number,
			IsRequired: PropTypes.bool,
			IsReadOnly: PropTypes.bool,
			IsHidden: PropTypes.bool,
			ValidationMessage: PropTypes.string,
			ChildActions: PropTypes.arrayOf(PropTypes.object),
			Targets: PropTypes.arrayOf(
				PropTypes.shape({
					EntityLogicalName: PropTypes.string,
					Columns: PropTypes.arrayOf(PropTypes.string),
					NavigationProperty: PropTypes.string,
					ReferencingAttribute: PropTypes.string,
				})
			),
			Choices: PropTypes.arrayOf(
				PropTypes.shape({
					Value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
					Label: PropTypes.string,
				})
			),
			CanSelectMultiple: PropTypes.bool,
		}),
	}).isRequired,
	entityName: PropTypes.string,
};

export default FieldInput;
