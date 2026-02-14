import React from "react";

type YesNoInputProps = {
	inputId: string;
	name: string;
	value?: string | boolean | null;
	isRequired?: boolean;
	isReadOnly?: boolean;
	onChange: (nextValue: boolean) => void;
};

export const YesNoInput = ({ inputId, name, value, isRequired, isReadOnly, onChange }: YesNoInputProps) => (
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

export default YesNoInput;
