/**
 * Condition configuration for dynamic form behavior.
 * Controls field visibility, requirements, etc.
 */
export interface ReactConditionConfiguration {
	/** Condition record ID */
	Id: string;
	/** Condition name */
	Name: string;
	/** Condition type (RequireFieldBasedOnCondition, etc.) */
	Type?: number;
	/** Whether expressions are combined with OR (true) or AND (false) */
	IsOr: boolean;
	/** Condition expressions to evaluate */
	Expressions: ReactConditionExpression[];
}

/**
 * Individual condition expression.
 * Compares a field value against an expected value.
 */
export interface ReactConditionExpression {
	/** Field logical name to evaluate */
	FieldLogicalName: string;
	/** Expected value to compare against */
	Value: string;
	/** Comparison operator (eq, ne, gt, lt, etc.) */
	Operator?: number;
}
