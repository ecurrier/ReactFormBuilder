import { DataType } from "@constants/enums";
import { ConditionOperator } from "./types";

const hasData = (value: any): boolean => {
	if (value === null || value === undefined) {
		return false;
	}

	if (typeof value === "string") {
		return value.trim().length > 0;
	}

	if (Array.isArray(value)) {
		return value.length > 0;
	}

	return true;
};

/**
 * Compares two values based on the specified operator
 */
export const compareValues = (fieldValue: any, conditionValue: any, operator: ConditionOperator, fieldDataType?: number): boolean => {
	switch (operator) {
		case ConditionOperator.Equal:
			return fieldValue == conditionValue; // Loose equality for type coercion

		case ConditionOperator.NotEqual:
			return fieldValue != conditionValue;

		case ConditionOperator.GreaterThan:
			return Number(fieldValue) > Number(conditionValue);

		case ConditionOperator.LessThan:
			return Number(fieldValue) < Number(conditionValue);

		case ConditionOperator.GreaterThanOrEqual:
			return Number(fieldValue) >= Number(conditionValue);

		case ConditionOperator.LessThanOrEqual:
			return Number(fieldValue) <= Number(conditionValue);

		case ConditionOperator.Contains:
			if (Array.isArray(fieldValue)) {
				return fieldValue.some((value) => String(value).toLowerCase() === String(conditionValue).toLowerCase());
			}
			if (fieldDataType === DataType.Choice && Array.isArray(conditionValue)) {
				return conditionValue.every((value) => Array.isArray(fieldValue) && fieldValue.includes(value));
			}
			return String(fieldValue ?? "")
				.toLowerCase()
				.includes(String(conditionValue ?? "").toLowerCase());

		case ConditionOperator.DoesNotContain:
			if (Array.isArray(fieldValue)) {
				return !fieldValue.some((value) => String(value).toLowerCase() === String(conditionValue).toLowerCase());
			}
			return !String(fieldValue ?? "")
				.toLowerCase()
				.includes(String(conditionValue ?? "").toLowerCase());

		case ConditionOperator.ContainsData:
			return hasData(fieldValue);

		case ConditionOperator.DoesNotContainData:
			return !hasData(fieldValue);

		default:
			console.warn(`Unknown condition operator: ${operator}`);
			return false;
	}
};
