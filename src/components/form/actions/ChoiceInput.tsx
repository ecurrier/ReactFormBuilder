import React from "react";

type Choice = {
	Value?: string | number;
	Label?: string;
};

type CommonSelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

type ChoiceInputProps = {
	commonProps: CommonSelectProps;
	choices: Choice[];
	value?: string | number | Array<string | number> | null;
	canSelectMultiple?: boolean;
	isReadOnly?: boolean;
};

export const ChoiceInput = ({ commonProps, choices, value, canSelectMultiple, isReadOnly }: ChoiceInputProps) => {
	if (choices.length === 0) {
		return (
			<div className="choice-placeholder" role="note">
				No options are configured for this field yet.
			</div>
		);
	}

	const multiSelect = Boolean(canSelectMultiple);
	const selectProps = {
		...commonProps,
		value: multiSelect ? (Array.isArray(value) ? value : []) : (value ?? ""),
		multiple: multiSelect,
	};

	if (isReadOnly) {
		selectProps.disabled = true;
	}

	// Temporary until we implement a better UI for multi-select with options to search, filter
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
};

export default ChoiceInput;
