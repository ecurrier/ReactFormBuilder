import React from "react";
import PropTypes from "prop-types";

export const YesNoInput = ({ inputId, name, value, isRequired, isReadOnly, onChange }) => (
	<fieldset required={isRequired} role="radiogroup">
		<div className="radio-inline">
			<label>
				<input
					type="radio"
					name={name}
					id={`${inputId}-yes`}
					value="yes"
					checked={value === true || value === "yes"}
					onChange={() => onChange(true)}
					required={isRequired}
					disabled={isReadOnly}
				/>
				Yes
				<span className="ui"></span>
			</label>
		</div>
		<div className="radio-inline">
			<label>
				<input
					type="radio"
					name={name}
					id={`${inputId}-no`}
					value="no"
					checked={value === false || value === "no"}
					onChange={() => onChange(false)}
					required={isRequired}
					disabled={isReadOnly}
				/>
				No
				<span className="ui"></span>
			</label>
		</div>
	</fieldset>
);

YesNoInput.propTypes = {
	inputId: PropTypes.string.isRequired,
	name: PropTypes.string.isRequired,
	value: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
	isRequired: PropTypes.bool,
	isReadOnly: PropTypes.bool,
	onChange: PropTypes.func.isRequired,
};

export default YesNoInput;
