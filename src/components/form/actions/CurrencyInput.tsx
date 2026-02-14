import React from "react";

type CommonInputProps = React.InputHTMLAttributes<HTMLInputElement>;

type CurrencyInputProps = {
	commonProps: CommonInputProps;
	minValue?: number;
	maxValue?: number;
};

export const CurrencyInput = ({ commonProps, minValue, maxValue }: CurrencyInputProps) => {
	return (
		<>
			<div className="input-group input-group-md">
				<span className="input-group-addon input-md">$</span>
				<input {...commonProps} type="number" step="any" min={minValue} max={maxValue} />
			</div>
		</>
	);
};

export default CurrencyInput;
