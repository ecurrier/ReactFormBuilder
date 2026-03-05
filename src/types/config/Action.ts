import type { ReactFormStep } from "./Step";
import type { FieldInputProperties, FileUploadProperties, TableEntryProperties, FreeFormTextProperties, QuickViewProperties } from "./Properties";

export interface ReactActionConfiguration {
	Id: string;
	Name: string;
	Order: number;
	ChildOrder: number;
	Type?: number;
	Properties: ActionProperties;
}

export type ActionProperties =
	| FieldInputProperties
	| FileUploadProperties
	| TableEntryProperties
	| FreeFormTextProperties
	| QuickViewProperties
	| Record<string, any>; // Fallback for unknown action types
