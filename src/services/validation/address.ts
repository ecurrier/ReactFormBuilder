import { SubAddressType } from "@constants/enums";

const getChildValue = (child: any, step: any, formState: any) => {
	const logicalName = child?.Properties?.LogicalName;
	if (!logicalName) return "";
	const entityName = step?.EntityLogicalName || formState?.primaryEntityName || "";
	return formState?.getFieldValue?.(`${entityName}.${logicalName}`) ?? "";
};

export const buildAddressRequest = (action: any, step: any, formState: any) => {
	const childActions: any[] = action?.Properties?.ChildActions || [];

	const addressLines = childActions
		.filter((child) => child?.Properties?.SubAddressType === SubAddressType.AddressLine)
		.sort((a, b) => (a.Order ?? 0) - (b.Order ?? 0))
		.map((child) => getChildValue(child, step, formState));

	const findValue = (subType: number) => {
		const child = childActions.find((c) => c?.Properties?.SubAddressType === subType);
		return child ? getChildValue(child, step, formState) : "";
	};

	return {
		AddressLines: addressLines,
		Locality: findValue(SubAddressType.Locality),
		AdministrativeArea: findValue(SubAddressType.AdministrativeArea),
		PostalCode: findValue(SubAddressType.PostalCode),
		RegionCode: findValue(SubAddressType.RegionCode),
	};
};

export const addressesEqual = (request: any, responseAddress: any) => {
	const equals = (left?: string, right?: string) => (left || "").trim().toLowerCase() === (right || "").trim().toLowerCase();
	return (
		request.AddressLines.every((line: string, index: number) => equals(line, responseAddress?.AddressLines?.[index])) &&
		equals(request.Locality, responseAddress?.Locality) &&
		equals(request.AdministrativeArea, responseAddress?.AdministrativeArea) &&
		equals(request.PostalCode, responseAddress?.PostalCode) &&
		equals(request.RegionCode, responseAddress?.RegionCode)
	);
};
