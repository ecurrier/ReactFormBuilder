import { ActionType, FieldValidationType, TableValidationType, DocumentValidationType, DataType } from "@constants/enums";
import { EygaApiClient } from "@utilities/eygaApi";
import { validateEmail, validatePhone, validateRegex } from "./validators";
import { buildAddressRequest, addressesEqual } from "./address";

export type ValidationIssue = {
	stepId: string;
	fieldId?: string;
	anchorId?: string;
	message: string;
	severity: "error" | "warning";
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[\d\s\-()\+]+$/;

const isEmptyValue = (value: unknown) => value === null || value === undefined || value === "";
const toComparable = (value: unknown, dataType?: number) => {
	if (dataType === DataType.YesNo) {
		if (value === true || value === "true" || value === "yes" || value === 1 || value === "1") return "1";
		if (value === false || value === "false" || value === "no" || value === 0 || value === "0") return "0";
	}
	return String(value ?? "").trim();
};

const makeFieldAnchorId = (fieldId: string) => `field-${fieldId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
const makeActionAnchorId = (action: any) => `action-${action?.Id ?? action?.Name ?? "unknown"}`;

const flattenFieldActions = (actions: any[] = []): any[] => {
	const fields: any[] = [];
	actions.forEach((action) => {
		if (!action?.Properties || action?.Properties?.__conditionHidden) return;
		if (action.Type === ActionType.FieldInput) {
			fields.push(action);
			fields.push(...flattenFieldActions(action.Properties.ChildActions || []));
		}
	});
	return fields;
};

const getFieldPath = (action: any, step: any, formState: any) => {
	const props = action?.Properties ?? {};
	const entityName = props.EntityName || step?.EntityLogicalName || formState?.primaryEntityName || "";
	return `${entityName}.${props.LogicalName}`;
};

export const validateFieldRules = ({
	steps,
	formState,
	limitToFieldPaths,
}: {
	steps: any[];
	formState: any;
	limitToFieldPaths?: Set<string>;
}): ValidationIssue[] => {
	const issues: ValidationIssue[] = [];

	steps.forEach((step) => {
		flattenFieldActions(step.Actions || []).forEach((action) => {
			const props = action.Properties || {};
			if (!props.LogicalName || props.IsHidden) {
				return;
			}

			const fieldPath = getFieldPath(action, step, formState);
			if (limitToFieldPaths && !limitToFieldPaths.has(fieldPath)) {
				return;
			}

			const value = formState?.getFieldValue?.(fieldPath);
			const issueBase = {
				stepId: step.Id ?? step.Name,
				fieldId: fieldPath,
				anchorId: makeFieldAnchorId(fieldPath),
				severity: "error" as const,
			};

			if (props.IsRequired && !props.IsReadOnly && isEmptyValue(value)) {
				issues.push({ ...issueBase, message: props.ValidationMessage || `${props.Label || props.LogicalName} is required.` });
				return;
			}

			// Commenting out for now since we may want validations to run even if a field is empty
			/*
			if (isEmptyValue(value)) {
				return;
			}
			*/

			switch (props.ValidationType) {
				case FieldValidationType.Equals: {
					if (toComparable(value, props.DataType) !== toComparable(props.ValidationValue, props.DataType)) {
						issues.push({ ...issueBase, message: props.ValidationMessage || `${props.Label || props.LogicalName} does not match expected value.` });
					}
					break;
				}
				case FieldValidationType.LessThan: {
					if (!(Number(value) < Number(props.ValidationValue))) {
						issues.push({
							...issueBase,
							message: props.ValidationMessage || `${props.Label || props.LogicalName} must be less than ${props.ValidationValue}.`,
						});
					}
					break;
				}
				case FieldValidationType.GreaterThan: {
					if (!(Number(value) > Number(props.ValidationValue))) {
						issues.push({
							...issueBase,
							message: props.ValidationMessage || `${props.Label || props.LogicalName} must be greater than ${props.ValidationValue}.`,
						});
					}
					break;
				}
				case FieldValidationType.PhoneNumber: {
					const result = validatePhone(value, props.ValidationMessage || "Please enter a valid phone number.");
					if (!result.IsValid) issues.push({ ...issueBase, message: result.Message || "Please enter a valid phone number." });
					break;
				}
				case FieldValidationType.EmailAddress: {
					const result = validateEmail(value, props.ValidationMessage || "Please enter a valid email address.");
					if (!result.IsValid) issues.push({ ...issueBase, message: result.Message || "Please enter a valid email address." });
					break;
				}
				case FieldValidationType.RegularExpression: {
					const result = validateRegex(value, props.ValidationValue || EMAIL_REGEX, props.ValidationMessage || "Please enter a valid value.");
					if (!result.IsValid) issues.push({ ...issueBase, message: result.Message || "Please enter a valid value." });
					break;
				}
				default:
					if (props.ValidationType === FieldValidationType.PhoneNumber && !PHONE_REGEX.test(String(value))) {
						issues.push({ ...issueBase, message: props.ValidationMessage || "Please enter a valid phone number." });
					}
					break;
			}
		});
	});

	return issues;
};

export const validateSubmitRules = async ({ steps, formState, config }: { steps: any[]; formState: any; config: any }): Promise<ValidationIssue[]> => {
	const issues: ValidationIssue[] = [];
	const primaryEntity = config?.Form?.PrimaryApplicationTable?.TableLogicalName;

	for (const step of steps) {
		for (const action of step.Actions || []) {
			if (action?.Properties?.__conditionHidden) {
				continue;
			}

			if (action.Type === ActionType.FieldInput && action.Properties?.ValidationType === FieldValidationType.ValidAddress) {
				const request = buildAddressRequest(action, step, formState);
				const isEmptyAddress =
					!request.AddressLines?.[0] && !request.AddressLines?.[1] && !request.Locality && !request.AdministrativeArea && !request.PostalCode;
				if (isEmptyAddress) {
					continue;
				}

				try {
					const response = await EygaApiClient.Address.Validate(request, {
						RegardingId: formState?.recordId || undefined,
						RegardingLogicalName: primaryEntity,
						ApiAction: "Validate Address",
					});

					/*
						TO-DO: Depending on how we want to do address validation, need to modify how we handle responses
					*/
					if (response?.ValidationLevel === "Invalid" || !response?.Address || !addressesEqual(request, response.Address)) {
						const fieldPath = getFieldPath(action, step, formState);
						issues.push({
							stepId: step.Id ?? step.Name,
							fieldId: fieldPath,
							anchorId: makeFieldAnchorId(fieldPath),
							message:
								action.Properties.ValidationMessage ||
								`${action.Properties.Label || action.Properties.LogicalName} address could not be validated.`,
							severity: "error",
						});
					}
				} catch {
					issues.push({
						stepId: step.Id ?? step.Name,
						anchorId: makeActionAnchorId(action),
						message: action.Properties.ValidationMessage || "Address validation service is unavailable.",
						severity: "error",
					});
				}
			}

			if (action.Type === ActionType.TableEntry && action.Properties?.ValidationType === TableValidationType.AtLeastOneRecord) {
				const entityName = action.Properties.ChildEntityLogicalName;
				const pendingCount = formState?.getChildNodes?.(entityName)?.length ?? 0;
				const persistedCount = formState?.getChildRecords?.(entityName)?.length ?? 0;
				if (pendingCount + persistedCount < 1) {
					issues.push({
						stepId: step.Id ?? step.Name,
						anchorId: makeActionAnchorId(action),
						message: action.Properties.ValidationMessage || `Please add at least one ${action.Properties.DisplayName || "entry"}.`,
						severity: "error",
					});
				}
			}

			if (action.Type === ActionType.FileUpload && action.Properties?.ValidationType === DocumentValidationType.AtLeastOneFile) {
				const uploads =
					formState?.getUploadNodes?.({ entityName: step.EntityLogicalName || primaryEntity, folderName: action.Properties.FolderName }) ?? [];
				if (uploads.length < 1) {
					issues.push({
						stepId: step.Id ?? step.Name,
						anchorId: makeActionAnchorId(action),
						message: action.Properties.ValidationMessage || "Please upload at least one document.",
						severity: "error",
					});
				}
			}
		}
	}

	return issues;
};

export const validateApplication = async ({ steps, formState, config }: { steps: any[]; formState: any; config: any }): Promise<ValidationIssue[]> => {
	const fieldIssues = validateFieldRules({ steps, formState });
	const submitIssues = await validateSubmitRules({ steps, formState, config });
	return [...fieldIssues, ...submitIssues];
};

export const createValidationSelectors = (issues: ValidationIssue[]) => ({
	getIssuesForStep: (stepId: string) => issues.filter((issue) => issue.stepId === stepId),
	getErrorCountForStep: (stepId: string) => issues.filter((issue) => issue.stepId === stepId && issue.severity === "error").length,
	getFieldIssues: (fieldId: string) => issues.filter((issue) => issue.fieldId === fieldId),
});

export const getFieldAnchorId = makeFieldAnchorId;
export const getActionAnchorId = makeActionAnchorId;
