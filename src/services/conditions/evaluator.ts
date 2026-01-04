import type { ConditionResult, ConditionContext } from "./types";
import { compareValues } from "./operators";
import type { ReactConditionConfiguration, ReactConditionExpression } from "@app-types";

/**
 * Evaluates a single condition expression
 */
export const evaluateExpression = (expression: ReactConditionExpression, context: ConditionContext): boolean => {
	const fieldValue = context.formValues[expression.FieldLogicalName];
	const conditionValue = expression.Value;
	const operator = expression.Operator;

	if (operator === undefined) {
		console.warn("Condition expression has no operator:", expression);
		return false;
	}

	return compareValues(fieldValue, conditionValue, operator);
};

/**
 * Evaluates a complete condition configuration with multiple expressions
 */
export const evaluateCondition = (condition: ReactConditionConfiguration, context: ConditionContext): ConditionResult => {
	if (!condition.Expressions || condition.Expressions.length === 0) {
		return { isMet: true }; // No expressions means condition is always met
	}

	// Evaluate all expressions
	const expressionResults = condition.Expressions.map((expr) => evaluateExpression(expr, context));

	// Combine results based on IsOr flag
	let isMet: boolean;
	if (condition.IsOr) {
		// OR logic: at least one expression must be true
		isMet = expressionResults.some((result) => result === true);
	} else {
		// AND logic: all expressions must be true
		isMet = expressionResults.every((result) => result === true);
	}

	return { isMet };
};

/**
 * Evaluates multiple conditions and determines if all are met
 * Used to determine if a field should be shown or required
 */
export const evaluateConditions = (conditions: ReactConditionConfiguration[], context: ConditionContext): ConditionResult => {
	if (!conditions || conditions.length === 0) {
		return { isMet: true }; // No conditions means always met
	}

	// All conditions must be met (AND logic between conditions)
	const conditionResults = conditions.map((condition) => evaluateCondition(condition, context));
	const isMet = conditionResults.every((result) => result.isMet);

	return { isMet };
};
