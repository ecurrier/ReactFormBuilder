import type { ReactFormStep } from "./Step";
import type { ReactActionConfiguration } from "./Action";

export interface FieldInputProperties {
	LogicalName?: string;
	SchemaName?: string;
	Label?: string;
	DataType?: number;
	IsRequired?: boolean;
	IsReadOnly?: boolean;
	IsHidden?: boolean;
	ValidationType?: number;
	ValidationValue?: string;
	ValidationMessage?: string;
	Description?: string;
	DescriptionType?: number;

	// Choice/Picklist fields
	CanSelectMultiple?: boolean;
	Choices?: Array<{ Value?: number; Label: string }>;
	DefaultValue?: number | boolean;

	// Numeric fields (Currency, Decimal, WholeNumber)
	MinValue?: number;
	MaxValue?: number;
	Precision?: number;

	// Date/Time fields
	DateTimeFormat?: string;
	DateTimeBehavior?: string;

	// Text fields
	MaxLength?: number;
	Format?: string;

	// Lookup fields
	Targets?: Array<{
		EntityLogicalName: string;
		Columns: Array<
			| string
			| {
					LogicalName: string;
					DataType?: number;
					DateTimeFormat?: string | number;
					DateTimeBehavior?: string;
			  }
		>;
		NavigationProperty?: string;
		ReferencingAttribute?: string;
		EntitySetName?: string;
		PrimaryIdAttribute?: string;
		PrimaryNameAttribute?: string;
	}>;

	// Nested child actions (for grouped fields)
	ChildActions?: ReactActionConfiguration[];
}

export interface FileUploadProperties {
	FolderName?: string;
	Description?: string;
	ValidationMessage?: string;
}

export interface TableEntryProperties {
	DisplayName?: string;
	ChildEntityLogicalName?: string;
	RelationshipName?: string;
	ReferencingAttribute?: string;
	ReferencingNavigationProperty?: string;
	ValidationType?: number;
	ValidationMessage?: string;
	CreateEnabled?: boolean;
	EditEnabled?: boolean;
	DeleteEnabled?: boolean;
	InlineEditEnabled?: boolean;
	ChildViewSteps?: ReactFormStep[];
	ChildFormSteps?: ReactFormStep[];
}

export interface PlainTextProperties {
	Description?: string;
	FreeFormTextContent?: string;
	FreeFormTextStyling?: string;
}

export interface QuickViewProperties {
	DisplayName?: string;
	ParentLookup?: string;
	QuickViewSteps?: ReactFormStep[];
}
