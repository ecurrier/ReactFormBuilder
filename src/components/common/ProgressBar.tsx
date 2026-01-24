import React from "react";

export interface ProgressBarProps {
	value: number;
	label?: string;
	variant?: "info" | "success" | "warning" | "danger";
	className?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ value, label, variant = "info", className }) => {
	const normalizedValue = Math.max(0, Math.min(100, value));
	const variantClass = variant ? `progress-bar-${variant}` : "";
	const combinedClassName = ["progress-bar", variantClass, className].filter(Boolean).join(" ");

	return (
		<div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={normalizedValue} aria-label={label}>
			<div className={combinedClassName} style={{ width: `${normalizedValue}%` }}>
				{label ? <span className="sr-only">{label}</span> : null}
			</div>
		</div>
	);
};

export default ProgressBar;
