import type { ReactActionConfiguration } from "./Action";
import type { ReactConditionConfiguration } from "./Condition";

export interface ReactFormStep {
	Id: string;
	Name: string;
	EntityLogicalName: string;
	ReferencingAttributeLogicalName?: string;
	ReferencingAttribute?: string;
	ReferencingNavigationProperty?: string;
	Description?: string;
	Order: number;
	Actions: ReactActionConfiguration[];
	Conditions: ReactConditionConfiguration[];
}
