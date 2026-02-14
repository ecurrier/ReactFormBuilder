export interface ReactConditionConfiguration {
	Id: string;
	Name: string;
	Type?: number;
	IsOr: boolean;
	Expressions: ReactConditionExpression[];
	TargetActionId?: string;
	Value?: any;
	SetValue?: any;
}

export interface ReactConditionExpression {
	FieldLogicalName: string;
	Value: any;
	Operator?: number;
}
