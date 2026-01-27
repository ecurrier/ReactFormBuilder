export type Entity = Record<string, any>;

export interface EntityReference {
	id: string;
	logicalName: string;
	name?: string;
	navigationProperty?: string;
}

export interface LookupValue {
	"@odata.type": string;
	"@odata.id": string;
}

export interface OptionSetValue {
	Value: number;
	Label?: string;
}

export interface MultiSelectOptionSetValue {
	Value: number[];
}
