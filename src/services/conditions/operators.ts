import { ConditionOperator } from "./types";

/**
 * Compares two values based on the specified operator
 */
export const compareValues = (fieldValue: any, conditionValue: any, operator: ConditionOperator): boolean => {
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
			return String(fieldValue).toLowerCase().includes(String(conditionValue).toLowerCase());

		case ConditionOperator.DoesNotContain:
			return !String(fieldValue).toLowerCase().includes(String(conditionValue).toLowerCase());

		case ConditionOperator.IsNull:
			return fieldValue === null || fieldValue === undefined || fieldValue === "";

		case ConditionOperator.IsNotNull:
			return fieldValue !== null && fieldValue !== undefined && fieldValue !== "";

		default:
			console.warn(`Unknown condition operator: ${operator}`);
			return false;
	}
};
