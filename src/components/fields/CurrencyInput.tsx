import React from "react";
import PropTypes from "prop-types";

export const CurrencyInput = ({ commonProps, minValue, maxValue }) => {
	return (
		<>
			<input {...commonProps} type="number" step="any" min={minValue} max={maxValue} />
		</>
	);
};

CurrencyInput.propTypes = {
	commonProps: PropTypes.shape({
		id: PropTypes.string,
		name: PropTypes.string,
		readOnly: PropTypes.bool,
		required: PropTypes.bool,
		className: PropTypes.string,
		value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
		onChange: PropTypes.func,
		placeholder: PropTypes.string,
	}).isRequired,
	minValue: PropTypes.number,
	maxValue: PropTypes.number,
};

export default CurrencyInput;
