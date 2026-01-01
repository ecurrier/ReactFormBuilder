export interface ReactConditionConfiguration {
	Id: string;
	Name: string;
	Type?: number;
	IsOr: boolean;
	Expressions: ReactConditionExpression[];
}

export interface ReactConditionExpression {
	FieldLogicalName: string;
	Value: string;
	Operator?: number;
}
