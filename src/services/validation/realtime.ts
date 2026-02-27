import { DataType } from "@constants/enums";
import type { FieldInputProperties } from "@app-types/config/Properties";
import type { ValidationResult } from "./types";
import { validateMaxLength, validateMinMax } from "./validators";

const emptyResult: ValidationResult = { IsValid: true };

export const getRealtimeValidationResult = (value: unknown, properties: FieldInputProperties): ValidationResult => {
	const dataType = properties.DataType;

	switch (dataType) {
		case DataType.SingleLineText: {
			if (properties.MaxLength === undefined) {
				return emptyResult;
			}

			return validateMaxLength(value, properties.MaxLength);
		}
		case DataType.WholeNumber:
		case DataType.Decimal:
		case DataType.Currency: {
			if (properties.MinValue === undefined && properties.MaxValue === undefined) {
				return emptyResult;
			}

			return validateMinMax(value, properties.MinValue, properties.MaxValue);
		}
		default:
			return emptyResult;
	}
};
