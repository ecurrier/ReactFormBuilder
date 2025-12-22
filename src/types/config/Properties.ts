import type { ReactFormStep } from "./Step";
import type { ReactActionConfiguration } from "./Action";

/**
 * Properties for FieldInput action type (203300000).
 * Represents a single form field with full metadata.
 */
export interface FieldInputProperties {
	/** Field logical name */
	LogicalName?: string;
	/** Field schema name */
	SchemaName?: string;
	/** Field display label */
	Label?: string;
	/** Dataverse data type */
	DataType?: number;
	/** Whether field is required */
	IsRequired?: boolean;
	/** Whether field is read-only */
	IsReadOnly?: boolean;
	/** Whether field is hidden */
	IsHidden?: boolean;
	/** Validation type (RegEx, MinMax, etc.) */
	ValidationType?: number;
	/** Validation value/pattern */
	ValidationValue?: string;
	/** Validation error message */
	ValidationMessage?: string;
	/** Field description/help text */
	Description?: string;

	// Choice/Picklist fields
	/** Whether multiple values can be selected */
	CanSelectMultiple?: boolean;
	/** Available choices */
	Choices?: Array<{ Value?: number; Label: string }>;
	/** Default picklist value */
	DefaultValue?: number | boolean;

	// Numeric fields (Currency, Decimal, WholeNumber)
	/** Minimum value */
	MinValue?: number;
	/** Maximum value */
	MaxValue?: number;
	/** Decimal precision */
	Precision?: number;

	// Date/Time fields
	/** Date/time format (DateOnly, DateAndTime) */
	DateTimeFormat?: string;
	/** Date/time behavior (UserLocal, TimeZoneIndependent) */
	DateTimeBehavior?: string;

	// Text fields
	/** Maximum length for text fields */
	MaxLength?: number;
	/** String format (Text, Email, Phone, etc.) */
	Format?: string;

	// Lookup fields
	/** Target entities for lookup */
	Targets?: Array<{
		EntityLogicalName: string;
		Columns: string[];
		NavigationProperty?: string;
		ReferencingAttribute?: string;
	}>;

	// Nested child actions (for grouped fields)
	/** Child actions nested under this field */
	ChildActions?: ReactActionConfiguration[];
}

/**
 * Properties for FileUpload action type (203300001).
 */
export interface FileUploadProperties {
	/** Folder name for uploaded files */
	FolderName?: string;
	/** Description/instructions */
	Description?: string;
	/** Validation error message */
	ValidationMessage?: string;
}

/**
 * Properties for TableEntry action type (203300002).
 * Represents a child table with CRUD operations.
 */
export interface TableEntryProperties {
	/** Display name for the table */
	DisplayName?: string;
	/** Child entity logical name */
	ChildEntityLogicalName?: string;
	/** Relationship logical name */
	RelationshipName?: string;
	/** Referencing attribute (lookup field on child) */
	ReferencingAttribute?: string;
	/** Validation type */
	ValidationType?: number;
	/** Validation error message */
	ValidationMessage?: string;
	/** Whether create operation is enabled */
	CreateEnabled?: boolean;
	/** Whether edit operation is enabled */
	EditEnabled?: boolean;
	/** Whether delete operation is enabled */
	DeleteEnabled?: boolean;
	/** Child view steps (columns to display in table) */
	ChildViewSteps?: ReactFormStep[];
	/** Child form steps (fields for create/edit) */
	ChildFormSteps?: ReactFormStep[];
}

/**
 * Properties for PlainText action type.
 * Displays static text/HTML content.
 */
export interface PlainTextProperties {
	/** Description/instructions */
	Description?: string;
	/** Free-form HTML content */
	FreeFormTextContent?: string;
	/** CSS styling for content */
	FreeFormTextStyling?: string;
}

/**
 * Properties for QuickView action type.
 * Displays read-only related entity data.
 */
export interface QuickViewProperties {
	/** Display name */
	DisplayName?: string;
	/** Parent lookup field name */
	ParentLookup?: string;
	/** Quick view steps (fields to display) */
	QuickViewSteps?: ReactFormStep[];
}
