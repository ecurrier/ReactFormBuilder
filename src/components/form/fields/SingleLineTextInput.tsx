import React from "react";
import PropTypes from "prop-types";

export const SingleLineTextInput = ({ commonProps, maxLength }) => {
	return (
		<>
			<input {...commonProps} type="text" maxLength={maxLength} />
		</>
	);
};

SingleLineTextInput.propTypes = {
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
	maxLength: PropTypes.number,
};

export default SingleLineTextInput;
