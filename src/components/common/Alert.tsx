import React from "react";

export type AlertType = "success" | "danger" | "warning" | "info";

export interface AlertProps {
	type: AlertType;
	title?: string;
	children: React.ReactNode;
	showIcon?: boolean;
	dismissible?: boolean;
	contained?: boolean;
	validationSummary?: boolean;
	onDismiss?: () => void;
	className?: string;
}

export const Alert: React.FC<AlertProps> = ({
	type = "info",
	title,
	children,
	showIcon = true,
	dismissible = false,
	contained = false,
	validationSummary = false,
	onDismiss,
	className = "",
}) => {
	const getIconClass = () => {
		switch (type) {
			case "success":
				return "glyphicon glyphicon-ok-circle";
			case "danger":
				return "glyphicon glyphicon-exclamation-sign";
			case "warning":
				return "glyphicon glyphicon-warning-sign";
			case "info":
			default:
				return "glyphicon glyphicon-info-sign";
		}
	};

	return (
		<div
			className={`alert alert-${type}${dismissible ? " alert-dismissible" : ""}${contained ? " alert-contained" : ""}${
				validationSummary ? " validation-summary" : ""
			} ${className}`}
			role="alert">
			{contained ? (
				<div className="container">
					{dismissible && (
						<button type="button" className="close" aria-label="Close" onClick={onDismiss}>
							×
						</button>
					)}
					<div className="alert-content">
						{title ? (
							<h2 className="validation-header">
								{showIcon && <span className={getIconClass()} role="presentation"></span>}
								{title}
							</h2>
						) : (
							showIcon && <span className={getIconClass()} role="presentation"></span>
						)}
						{children}
					</div>
				</div>
			) : (
				<>
					{dismissible && (
						<button type="button" className="close" aria-label="Close" onClick={onDismiss}>
							×
						</button>
					)}
					{title ? (
						<h2 className="validation-header">
							{showIcon && <span className={getIconClass()} role="presentation"></span>}
							{title}
						</h2>
					) : (
						showIcon && <span className={getIconClass()} role="presentation"></span>
					)}
					{children}
				</>
			)}
		</div>
	);
};

export default Alert;
