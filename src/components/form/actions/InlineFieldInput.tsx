import React, { useState } from "react";
import { DataType } from "@constants/enums";
import { ChoiceInput, CurrencyInput, DateTimeInput, MultiLineTextInput, NumberInput, SingleLineTextInput, YesNoInput } from "@components";
import { CompactLookupControl } from "./lookup/CompactLookupControl";
import { getRealtimeValidationResult } from "@services/validation";

type InlineFieldInputProps = {
	properties: any;
	value: any;
	onChange: (newValue: any) => void;
	inputId: string;
};

const coerceValue = (dataType: number | undefined, raw: any): any => {
	switch (dataType) {
		case DataType.Decimal:
		case DataType.Currency: {
			const parsed = parseFloat(raw);
			return isNaN(parsed) ? null : parsed;
		}
		case DataType.WholeNumber: {
			const parsed = parseInt(raw, 10);
			return isNaN(parsed) ? null : parsed;
		}
		default:
			return raw;
	}
};

const getPlaceholder = (dataType: number | undefined): string | undefined => {
	switch (dataType) {
		case DataType.MultiLineText:
			return "Enter details...";
		case DataType.WholeNumber:
		case DataType.Decimal:
		case DataType.Currency:
			return "Enter a number...";
		case DataType.Lookup:
			return "Search...";
		case DataType.SingleLineText:
			return "Enter a value...";
		default:
			return [DataType.YesNo, DataType.Choice].includes(dataType as number) ? undefined : "Enter a value...";
	}
};

export const InlineFieldInput: React.FC<InlineFieldInputProps> = React.memo(({ properties, value, onChange, inputId }) => {
	const [validationMessage, setValidationMessage] = useState<string | null>(null);

	const handleChange = (eventOrValue: any) => {
		let newValue: any;
		if (typeof eventOrValue === "string" || eventOrValue === null || (typeof eventOrValue === "object" && eventOrValue?.id)) {
			newValue = eventOrValue;
		} else if (eventOrValue?.target) {
			newValue = eventOrValue.target.value;
		} else {
			newValue = eventOrValue;
		}

		const coerced = coerceValue(properties.DataType, newValue);
		const result = getRealtimeValidationResult(coerced, properties);
		setValidationMessage(result.IsValid ? null : result.Message || null);
		onChange(coerced);
	};

	const placeholder = getPlaceholder(properties.DataType);

	const commonProps: Record<string, any> = {
		id: inputId,
		name: properties.LogicalName ?? inputId,
		readOnly: properties.IsReadOnly,
		required: properties.IsRequired,
		className: "form-control",
		value: value ?? "",
		onChange: handleChange,
	};

	if (placeholder) {
		commonProps.placeholder = placeholder;
	}

	let input: React.ReactNode;

	switch (properties.DataType) {
		case DataType.MultiLineText:
			input = <MultiLineTextInput commonProps={{ ...commonProps, rows: 2 }} maxLength={properties.MaxLength} />;
			break;
		case DataType.YesNo:
			input = (
				<YesNoInput
					inputId={inputId}
					name={commonProps.name}
					value={value}
					isRequired={properties.IsRequired}
					isReadOnly={properties.IsReadOnly}
					onChange={handleChange}
				/>
			);
			break;
		case DataType.WholeNumber:
		case DataType.Decimal:
			input = <NumberInput commonProps={commonProps} minValue={properties.MinValue} maxValue={properties.MaxValue} />;
			break;
		case DataType.Currency:
			input = <CurrencyInput commonProps={commonProps} minValue={properties.MinValue} maxValue={properties.MaxValue} />;
			break;
		case DataType.SingleLineText:
			input = <SingleLineTextInput commonProps={commonProps} maxLength={properties.MaxLength} />;
			break;
		case DataType.Lookup:
			input = (
				<CompactLookupControl
					inputId={inputId}
					placeholder={placeholder}
					value={value}
					onChange={handleChange}
					targets={properties.Targets || []}
					isReadOnly={properties.IsReadOnly}
					isRequired={properties.IsRequired}
				/>
			);
			break;
		case DataType.Choice:
			input = (
				<ChoiceInput
					commonProps={commonProps}
					choices={properties.Choices || []}
					value={value}
					canSelectMultiple={properties.CanSelectMultiple}
					isReadOnly={properties.IsReadOnly}
				/>
			);
			break;
		case DataType.DateTime:
			input = <DateTimeInput commonProps={commonProps} dateTimeFormat={properties.DateTimeFormat} dateTimeBehavior={properties.DateTimeBehavior} />;
			break;
		default:
			input = <input {...commonProps} type="text" />;
			break;
	}

	const hasError = Boolean(validationMessage);

	return (
		<div className={`inline-field-input${hasError ? " has-error" : ""}`}>
			{input}
			{hasError && (
				<span className="inline-field-error" role="alert">
					{validationMessage}
				</span>
			)}
		</div>
	);
});

InlineFieldInput.displayName = "InlineFieldInput";

export default InlineFieldInput;
