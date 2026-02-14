import React from "react";

type CommonInputProps = React.InputHTMLAttributes<HTMLInputElement>;

type NumberInputProps = {
	commonProps: CommonInputProps;
	minValue?: number;
	maxValue?: number;
};

export const NumberInput = ({ commonProps, minValue, maxValue }: NumberInputProps) => {
	return (
		<>
			<input {...commonProps} type="number" step="any" min={minValue} max={maxValue} />
		</>
	);
};

export default NumberInput;
