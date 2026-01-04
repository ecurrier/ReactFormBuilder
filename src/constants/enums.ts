/**
 * Action Type enumeration for form actions
 */
export const ActionType = {
	FieldInput: 203300000,
	FileUpload: 203300001,
	TableEntry: 203300002,
};

/**
 * Data Type enumeration for field inputs
 */
export const DataType = {
	SingleLineText: 643260000,
	MultiLineText: 643260001,
	Currency: 643260002,
	WholeNumber: 643260003,
	Decimal: 643260004,
	Choice: 643260006,
	YesNo: 643260007,
	DateTime: 643260008,
	Lookup: 643260009,
};

export const DateTimeFormat = {
	DateOnly: 0,
	DateAndTime: 1,
};

/**
 * Validation Type enumeration
 */
export const ValidationType = {
	RegEx: 643260000,
	MinMax: 643260001,
};

/**
 * Table Validation Type enumeration
 */
export const TableValidationType = {
	AtLeastOneRecord: 643260000,
	NoValidation: 643260001,
};

/**
 * Document Validation Type enumeration
 */
export const DocumentValidationType = {
	NoValidation: 203300000,
	OneFileOnly: 203300001,
	AtLeastOneFile: 203300002,
};

/**
 * Condition Type enumeration
 */
export const ConditionType = {
	RequireFieldBasedOnCondition: 643260006,
};

export const FormInstanceEventType = {
	ValidationFailed: 643260000,
	SubmitSucceeded: 643260001,
	SubmitFailed: 643260002,
	Navigation: 643260003,
};

export type FormInstanceEventTypeValue = (typeof FormInstanceEventType)[keyof typeof FormInstanceEventType];

/**
 * Helper function to get a readable name for a DataType value
 * @param {number} value - The numeric DataType value
 * @returns {string} - Human-readable name or 'Unknown'
 */
export const getDataTypeName = (value: number) => {
	const entry = Object.entries(DataType).find(([, val]) => val === value);
	return entry ? entry[0] : "Unknown";
};

/**
 * Helper function to get a readable name for an ActionType value
 * @param {number} value - The numeric ActionType value
 * @returns {string} - Human-readable name or 'Unknown'
 */
export const getActionTypeName = (value: number) => {
	const entry = Object.entries(ActionType).find(([, val]) => val === value);
	return entry ? entry[0] : "Unknown";
};
