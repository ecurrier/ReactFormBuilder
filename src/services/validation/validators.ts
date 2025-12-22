import type { ValidationResult, FieldValidationConfig } from "./types";

/**
 * Validates that a field has a value (not null, undefined, or empty string).
 *
 * @param value - Field value to validate
 * @param message - Custom error message
 * @returns Validation result
 */
export const validateRequired = (value: any, message?: string): ValidationResult => {
	const isValid = value !== null && value !== undefined && value !== "";

	return {
		isValid,
		message: isValid ? undefined : message || "This field is required.",
	};
};

/**
 * Validates a value against a regular expression pattern.
 *
 * @param value - Field value to validate
 * @param pattern - RegExp pattern or pattern string
 * @param message - Custom error message
 * @returns Validation result
 */
export const validateRegex = (value: any, pattern: string | RegExp, message?: string): ValidationResult => {
	if (value === null || value === undefined || value === "") {
		return { isValid: true }; // Empty values pass regex validation (use validateRequired separately)
	}

	const regex = typeof pattern === "string" ? new RegExp(pattern) : pattern;
	const isValid = regex.test(String(value));

	return {
		isValid,
		message: isValid ? undefined : message || "Please enter a valid value.",
	};
};

/**
 * Validates that a numeric value is within a specified range.
 *
 * @param value - Numeric value to validate
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 * @param message - Custom error message
 * @returns Validation result
 */
export const validateMinMax = (value: any, min?: number, max?: number, message?: string): ValidationResult => {
	if (value === null || value === undefined || value === "") {
		return { isValid: true }; // Empty values pass min/max validation
	}

	const numValue = Number(value);
	if (isNaN(numValue)) {
		return { isValid: false, message: "Please enter a valid number." };
	}

	let isValid = true;
	let defaultMessage = "";

	if (min !== undefined && numValue < min) {
		isValid = false;
		defaultMessage = `Value must be at least ${min}.`;
	}

	if (max !== undefined && numValue > max) {
		isValid = false;
		defaultMessage = `Value must be no more than ${max}.`;
	}

	if (min !== undefined && max !== undefined && !isValid) {
		defaultMessage = `Value must be between ${min} and ${max}.`;
	}

	return {
		isValid,
		message: isValid ? undefined : message || defaultMessage,
	};
};

/**
 * Validates that a string does not exceed a maximum length.
 *
 * @param value - String value to validate
 * @param maxLength - Maximum allowed length
 * @param message - Custom error message
 * @returns Validation result
 */
export const validateMaxLength = (value: any, maxLength: number, message?: string): ValidationResult => {
	if (value === null || value === undefined || value === "") {
		return { isValid: true }; // Empty values pass length validation
	}

	const strValue = String(value);
	const isValid = strValue.length <= maxLength;

	return {
		isValid,
		message: isValid ? undefined : message || `Maximum length is ${maxLength} characters.`,
	};
};

/**
 * Validates that a string meets a minimum length requirement.
 *
 * @param value - String value to validate
 * @param minLength - Minimum required length
 * @param message - Custom error message
 * @returns Validation result
 */
export const validateMinLength = (value: any, minLength: number, message?: string): ValidationResult => {
	if (value === null || value === undefined || value === "") {
		return { isValid: true }; // Empty values pass length validation (use validateRequired separately)
	}

	const strValue = String(value);
	const isValid = strValue.length >= minLength;

	return {
		isValid,
		message: isValid ? undefined : message || `Minimum length is ${minLength} characters.`,
	};
};

/**
 * Validates an email address format.
 *
 * @param value - Email string to validate
 * @param message - Custom error message
 * @returns Validation result
 */
export const validateEmail = (value: any, message?: string): ValidationResult => {
	if (value === null || value === undefined || value === "") {
		return { isValid: true }; // Empty values pass email validation
	}

	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return validateRegex(value, emailRegex, message || "Please enter a valid email address.");
};

/**
 * Validates a phone number format.
 *
 * @param value - Phone string to validate
 * @param message - Custom error message
 * @returns Validation result
 */
export const validatePhone = (value: any, message?: string): ValidationResult => {
	if (value === null || value === undefined || value === "") {
		return { isValid: true }; // Empty values pass phone validation
	}

	// Basic phone validation - allows various formats
	const phoneRegex = /^[\d\s\-\(\)\+]+$/;
	return validateRegex(value, phoneRegex, message || "Please enter a valid phone number.");
};

/**
 * Validates a URL format.
 *
 * @param value - URL string to validate
 * @param message - Custom error message
 * @returns Validation result
 */
export const validateUrl = (value: any, message?: string): ValidationResult => {
	if (value === null || value === undefined || value === "") {
		return { isValid: true }; // Empty values pass URL validation
	}

	try {
		new URL(String(value));
		return { isValid: true };
	} catch {
		return {
			isValid: false,
			message: message || "Please enter a valid URL.",
		};
	}
};

/**
 * Validates a field based on its configuration.
 * Orchestrates multiple validators based on field config.
 *
 * @param value - Field value to validate
 * @param config - Field validation configuration
 * @returns Validation result (first failing validator or success)
 */
export const validateField = (value: any, config: FieldValidationConfig): ValidationResult => {
	// Required validation
	if (config.isRequired) {
		const result = validateRequired(value, config.validationMessage);
		if (!result.isValid) return result;
	}

	// Empty values pass remaining validations
	if (value === null || value === undefined || value === "") {
		return { isValid: true };
	}

	// Regex validation (ValidationType = 643260000)
	if (config.validationType === 643260000 && config.validationValue) {
		const result = validateRegex(value, config.validationValue, config.validationMessage);
		if (!result.isValid) return result;
	}

	// Min/Max validation (ValidationType = 643260001)
	if (config.validationType === 643260001) {
		const result = validateMinMax(value, config.minValue, config.maxValue, config.validationMessage);
		if (!result.isValid) return result;
	}

	// Max length validation (for text fields)
	if (config.maxLength !== undefined) {
		const result = validateMaxLength(value, config.maxLength, config.validationMessage);
		if (!result.isValid) return result;
	}

	return { isValid: true };
};
