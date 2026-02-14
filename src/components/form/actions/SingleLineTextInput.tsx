import React from "react";

type CommonInputProps = React.InputHTMLAttributes<HTMLInputElement>;

type SingleLineTextInputProps = {
	commonProps: CommonInputProps;
	maxLength?: number;
};

export const SingleLineTextInput = ({ commonProps, maxLength }: SingleLineTextInputProps) => {
	return (
		<>
			<input {...commonProps} type="text" maxLength={maxLength} />
		</>
	);
};

export default SingleLineTextInput;
