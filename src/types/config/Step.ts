import type { ReactActionConfiguration } from "./Action";
import type { ReactConditionConfiguration } from "./Condition";

/**
 * Form step configuration.
 * Represents a single step in a multi-step form.
 */
export interface ReactFormStep {
	/** Step record ID */
	Id: string;
	/** Step name/title */
	Name: string;
	/** Dataverse entity logical name for this step */
	EntityLogicalName: string;
	/** Referencing attribute (lookup field) for child entity relationships */
	ReferencingAttributeLogicalName?: string;
	/** Step description */
	Description?: string;
	/** Display order */
	Order: number;
	/** Actions (fields, tables, etc.) in this step */
	Actions: ReactActionConfiguration[];
	/** Conditions for step visibility/requirements */
	Conditions: ReactConditionConfiguration[];
}
