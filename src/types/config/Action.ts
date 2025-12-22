import type { ReactFormStep } from "./Step";
import type {
	FieldInputProperties,
	FileUploadProperties,
	TableEntryProperties,
	PlainTextProperties,
	QuickViewProperties,
} from "./Properties";

/**
 * Action configuration with polymorphic properties.
 * Different action types have different properties stored in the Properties dictionary.
 */
export interface ReactActionConfiguration {
	/** Action record ID */
	Id: string;
	/** Action name */
	Name: string;
	/** Display order within step */
	Order: number;
	/** Child display order (for nested actions) */
	ChildOrder: number;
	/** Action type (FieldInput, FileUpload, TableEntry, etc.) */
	Type?: number;
	/** Polymorphic properties based on action type */
	Properties: ActionProperties;
}

/**
 * Union type of all possible action property structures.
 */
export type ActionProperties =
	| FieldInputProperties
	| FileUploadProperties
	| TableEntryProperties
	| PlainTextProperties
	| QuickViewProperties
	| Record<string, any>; // Fallback for unknown action types
