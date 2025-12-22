/**
 * Validation result returned by validator functions.
 */
export interface ValidationResult {
	/** Whether the validation passed */
	isValid: boolean;
	/** Error message if validation failed */
	message?: string;
}

/**
 * Function signature for field validators.
 */
export type ValidatorFunction = (value: any, ...args: any[]) => ValidationResult;

/**
 * Configuration for field validation.
 */
export interface FieldValidationConfig {
	/** Validation type from configuration */
	validationType?: number;
	/** Validation value/pattern */
	validationValue?: string;
	/** Custom validation message */
	validationMessage?: string;
	/** Whether field is required */
	isRequired?: boolean;
	/** Field data type */
	dataType?: number;
	/** Min value (for numeric fields) */
	minValue?: number;
	/** Max value (for numeric fields) */
	maxValue?: number;
	/** Max length (for text fields) */
	maxLength?: number;
}
