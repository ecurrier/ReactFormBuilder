export interface ReactFormConfiguration {
	Version: string;
	Program?: ReactProgramConfiguration;
	FundingOpportunity: ReactFundingOpportunityConfiguration;
	Form: ReactForm;
	TableMetadata?: Record<string, ReactTableMetadataEntry>;
}

export interface ReactProgramConfiguration {
	Id: string;
}

export interface ReactFundingOpportunityConfiguration {
	Id: string;
	Name: string;
	FullName: string;
	Settings: ReactFundingOpportunitySettings;
	ApplicationTable: ReactApplicationTableConfiguration;
}

export interface ReactFundingOpportunitySettings {
	IdentityVerificationEnabled: boolean;
	LateSubmissionAllowedUntil?: string;
}

export interface ReactApplicationTableConfiguration {
	Id: string;
	Name: string;
	TableLogicalName: string;
	Description?: string;
	Usage?: number;
}

export interface ReactForm {
	Id: string;
	Name: string;
	PrimaryApplicationTable: ReactApplicationTableConfiguration;
	Introduction?: string;
	Settings: ReactFormSettings;
	Steps: ReactFormStep[];
	TableMetadata?: Record<string, ReactTableMetadataEntry>;
}

export interface ReactFormSettings {
	IncludeInApplicationPackage?: boolean;
	ApplicationPackageTypesToIncludeOn: (number | null)[];
	RequireFormForApplicant: boolean;
	EstimatedCompletionTime?: string;
}

export interface ReactTableMetadataEntry {
	EntityLogicalName: string;
	EntitySchemaName?: string;
	EntitySetName?: string;
	EntityDisplayName?: string;
	EntityDescription?: string;
	PrimaryIdAttribute?: string;
	PrimaryNameAttribute?: string;
	DefaultOnCreateActions?: ReactDefaultOnCreateAction[];
}

export interface ReactDefaultOnCreateAction {
	ConfigurationIdentifierMetadata: ReactConfigurationIdentifierMetadata | ReactConfigurationIdentifierMetadata[];
}

export interface ReactConfigurationIdentifierMetadata {
	ConfigurationIdentifier: string;
	FieldLogicalName: string;
	NavigationPropertyName?: string;
}

export type { ReactFormStep } from "./Step";
