export interface ValidationResult {
	IsValid: boolean;
	Message?: string;
}

export type ValidatorFunction = (value: any, ...args: any[]) => ValidationResult;

export interface FieldValidationConfig {
	ValidationType?: number;
	ValidationValue?: string;
	ValidationMessage?: string;
	IsRequired?: boolean;
	DataType?: number;
	MinValue?: number;
	MaxValue?: number;
	MaxLength?: number;
}
