import { ActionType } from "@constants/enums";
import type { ReactFormStep, ReactActionConfiguration, ReactConditionConfiguration, ReactConditionExpression } from "@app-types";
import { compareValues } from "./operators";
import { ConditionOperator } from "./types";

export const ConditionTypes = {
	AllFieldsEntered: 203300000,
	ShowFieldBasedonCondition: 643260000,
	EnableDisableFieldBasedonCondition: 643260001,
	SetValueBasedonCondition: 643260002,
	ShowDocumentUploadBasedonCondition: 643260003,
	ShowTableEntryBasedonCondition: 643260004,
	RequireDocumentBasedonCondition: 643260005,
	RequireFieldBasedOnCondition: 643260006,
	RequireTableEntryBasedonCondition: 643260007,
} as const;

export interface ConditionRuntimeContext {
	getFieldValue: (path: string) => any;
}

export interface ConditionRuntimeResult {
	steps: ReactFormStep[];
	fieldUpdates: Array<{ path: string; value: any }>;
}

type ActionReference = {
	stepIndex: number;
	actionIndex: number;
	action: ReactActionConfiguration;
	entityName?: string;
};

type FieldReference = {
	path: string;
	dataType?: number;
};

const cloneAction = (action: ReactActionConfiguration): ReactActionConfiguration => ({
	...action,
	Properties: { ...((action.Properties as any) || {}) },
});

const cloneStep = (step: ReactFormStep): ReactFormStep => ({
	...step,
	Actions: Array.isArray(step.Actions) ? step.Actions.map((action) => cloneAction(action)) : [],
	Conditions: Array.isArray(step.Conditions) ? [...step.Conditions] : [],
});

const getExpressionFieldValue = (expression: ReactConditionExpression, fieldReferences: Map<string, FieldReference[]>, context: ConditionRuntimeContext) => {
	const fieldLogicalName = expression.FieldLogicalName;
	if (!fieldLogicalName) {
		return { value: null, dataType: undefined };
	}

	if (fieldLogicalName.includes(".")) {
		return {
			value: context.getFieldValue(fieldLogicalName),
			dataType: undefined,
		};
	}

	const references = fieldReferences.get(fieldLogicalName);
	if (!references || references.length === 0) {
		return { value: null, dataType: undefined };
	}

	const [reference] = references;
	return {
		value: context.getFieldValue(reference.path),
		dataType: reference.dataType,
	};
};

const evaluateExpression = (
	expression: ReactConditionExpression,
	fieldReferences: Map<string, FieldReference[]>,
	context: ConditionRuntimeContext
): boolean => {
	const operator = expression.Operator;
	if (operator === undefined) {
		return false;
	}

	const { value: fieldValue, dataType } = getExpressionFieldValue(expression, fieldReferences, context);
	return compareValues(fieldValue, expression.Value, operator as ConditionOperator, dataType);
};

const evaluateCondition = (
	condition: ReactConditionConfiguration,
	fieldReferences: Map<string, FieldReference[]>,
	context: ConditionRuntimeContext
): boolean => {
	if (!Array.isArray(condition.Expressions) || condition.Expressions.length === 0) {
		return true;
	}

	const expressionResults = condition.Expressions.map((expression) => evaluateExpression(expression, fieldReferences, context));
	return condition.IsOr ? expressionResults.some(Boolean) : expressionResults.every(Boolean);
};

const resolveSetValue = (condition: ReactConditionConfiguration) => {
	const conditionWithOptionalValue = condition as ReactConditionConfiguration & { Value?: any; SetValue?: any };
	if (conditionWithOptionalValue.SetValue !== undefined) {
		return conditionWithOptionalValue.SetValue;
	}
	if (conditionWithOptionalValue.Value !== undefined) {
		return conditionWithOptionalValue.Value;
	}
	return condition.Expressions?.[0]?.Value;
};

export const applyConditions = (steps: ReactFormStep[], context: ConditionRuntimeContext): ConditionRuntimeResult => {
	const runtimeSteps = steps.map((step) => cloneStep(step));
	const actionReferences = new Map<string, ActionReference>();
	const fieldReferences = new Map<string, FieldReference[]>();

	runtimeSteps.forEach((step, stepIndex) => {
		step.Actions.forEach((action, actionIndex) => {
			const actionId = action.Id;
			if (actionId) {
				actionReferences.set(actionId, { stepIndex, actionIndex, action, entityName: step.EntityLogicalName });
			}

			if (action.Type === ActionType.FieldInput) {
				const logicalName = (action.Properties as any)?.LogicalName;
				if (logicalName) {
					const path = `${step.EntityLogicalName}.${logicalName}`;
					const existing = fieldReferences.get(logicalName) ?? [];
					existing.push({ path, dataType: (action.Properties as any)?.DataType });
					fieldReferences.set(logicalName, existing);
				}
			}
		});
	});

	const setValueUpdates = new Map<string, any>();

	runtimeSteps.forEach((step) => {
		(step.Conditions ?? []).forEach((condition) => {
			const conditionMet = evaluateCondition(condition, fieldReferences, context);
			const targetActionId = (condition as ReactConditionConfiguration & { TargetActionId?: string }).TargetActionId;
			if (!targetActionId) {
				return;
			}

			const targetReference = actionReferences.get(targetActionId);
			if (!targetReference) {
				return;
			}

			const targetAction = runtimeSteps[targetReference.stepIndex]?.Actions?.[targetReference.actionIndex];
			if (!targetAction) {
				return;
			}

			switch (condition.Type) {
				case ConditionTypes.ShowFieldBasedonCondition:
					if (targetAction.Type === ActionType.FieldInput) {
						(targetAction.Properties as any).IsHidden = !conditionMet;
					}
					break;
				case ConditionTypes.EnableDisableFieldBasedonCondition:
					if (targetAction.Type === ActionType.FieldInput) {
						(targetAction.Properties as any).IsReadOnly = !conditionMet;
					}
					break;
				case ConditionTypes.SetValueBasedonCondition:
					if (conditionMet && targetAction.Type === ActionType.FieldInput && (targetAction.Properties as any)?.LogicalName) {
						const targetPath = `${targetReference.entityName}.${(targetAction.Properties as any).LogicalName}`;
						setValueUpdates.set(targetPath, resolveSetValue(condition));
					}
					break;
				case ConditionTypes.ShowDocumentUploadBasedonCondition:
					if (targetAction.Type === ActionType.FileUpload) {
						(targetAction.Properties as any).__conditionHidden = !conditionMet;
					}
					break;
				case ConditionTypes.ShowTableEntryBasedonCondition:
					if (targetAction.Type === ActionType.TableEntry) {
						(targetAction.Properties as any).__conditionHidden = !conditionMet;
					}
					break;
				case ConditionTypes.RequireDocumentBasedonCondition:
					if (targetAction.Type === ActionType.FileUpload) {
						(targetAction.Properties as any).__conditionRequired = conditionMet;
					}
					break;
				case ConditionTypes.RequireFieldBasedOnCondition:
					if (targetAction.Type === ActionType.FieldInput) {
						(targetAction.Properties as any).IsRequired = conditionMet;
					}
					break;
				case ConditionTypes.RequireTableEntryBasedonCondition:
					if (targetAction.Type === ActionType.TableEntry) {
						(targetAction.Properties as any).__conditionRequired = conditionMet;
					}
					break;
				default:
					break;
			}
		});
	});

	const fieldUpdates = Array.from(setValueUpdates.entries()).map(([path, value]) => ({ path, value }));
	return { steps: runtimeSteps, fieldUpdates };
};
