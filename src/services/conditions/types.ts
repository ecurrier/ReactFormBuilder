export interface ConditionResult {
	isMet: boolean;
}

export interface ConditionContext {
	formValues: Record<string, any>;
	currentValue?: any;
}

export enum ConditionOperator {
	Equal = 643260000,
	NotEqual = 643260001,
	GreaterThan = 643260002,
	LessThan = 643260003,
	GreaterThanOrEqual = 643260004,
	LessThanOrEqual = 643260005,
	Contains = 643260006,
	DoesNotContain = 643260007,
	ContainsData = 643260008,
	DoesNotContainData = 643260009,
}
