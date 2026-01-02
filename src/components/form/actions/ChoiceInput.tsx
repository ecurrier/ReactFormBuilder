import React from "react";
import PropTypes from "prop-types";

export const ChoiceInput = ({ commonProps, choices, value, canSelectMultiple, isReadOnly }) => {
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

ChoiceInput.propTypes = {
	commonProps: PropTypes.shape({
		id: PropTypes.string,
		name: PropTypes.string,
		readOnly: PropTypes.bool,
		required: PropTypes.bool,
		className: PropTypes.string,
		value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.array]),
		onChange: PropTypes.func,
		placeholder: PropTypes.string,
	}).isRequired,
	choices: PropTypes.arrayOf(
		PropTypes.shape({
			Value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
			Label: PropTypes.string,
		})
	).isRequired,
	value: PropTypes.any,
	canSelectMultiple: PropTypes.bool,
	isReadOnly: PropTypes.bool,
};

export default ChoiceInput;
