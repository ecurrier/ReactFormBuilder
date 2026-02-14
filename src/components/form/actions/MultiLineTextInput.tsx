import React from "react";

type CommonInputProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

type MultiLineTextInputProps = {
	commonProps: CommonInputProps;
	maxLength?: number;
};

export const MultiLineTextInput = ({ commonProps, maxLength }: MultiLineTextInputProps) => <textarea {...commonProps} rows={4} maxLength={maxLength} />;

export default MultiLineTextInput;
