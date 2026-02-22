import { retrieveMultipleRecords } from "@/services/api/Api";
import { buildFetchXmlWithFilter } from "@utilities/fetchXml";
import { resolvePrimaryIdAttribute, resolvePrimaryNameAttribute } from "@utilities/metadata";

export interface LookupTargetConfig {
	EntityLogicalName: string;
	Attributes: Array<
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
}

export interface LookupSearchResult {
	id: string;
	logicalName: string;
	name: string;
	attributes: Record<string, any>;
}

// TO-DO: If primary name attribute is not defined and there are no attributes, we should probably hard error
const getPrimaryNameAttribute = (target: LookupTargetConfig): string => {
	if (target.PrimaryNameAttribute) {
		return target.PrimaryNameAttribute;
	}

	const primaryNameAttribute = resolvePrimaryNameAttribute(target.EntityLogicalName);
	if (primaryNameAttribute) {
		return primaryNameAttribute;
	}

	if (target.Attributes && target.Attributes.length > 0) {
		const firstAttribute = target.Attributes[0];
		return typeof firstAttribute === "string" ? firstAttribute : firstAttribute.LogicalName;
	}

	return "createdon";
};

const buildLookupAttributes = (target: LookupTargetConfig): string[] => {
	const primaryNameAttribute = target.PrimaryNameAttribute || getPrimaryNameAttribute(target);
	const primaryIdAttribute = target.PrimaryIdAttribute || resolvePrimaryIdAttribute(target.EntityLogicalName);
	const normalizedAttributes = (target.Attributes || []).map((attribute) => (typeof attribute === "string" ? attribute : attribute?.LogicalName));
	const attributeSet = new Set<string>([primaryIdAttribute, primaryNameAttribute, ...normalizedAttributes.filter(Boolean)]);

	return Array.from(attributeSet);
};

const buildFetchXmlForLookupResults = (entityName: string, primaryNameAttribute: string, additionalAttributes: string[] = [], orderBy?: string): string => {
	const attributes = [primaryNameAttribute, "createdon", ...additionalAttributes];
	const attributeElements = attributes.map((attr) => `<attribute name="${attr}" />`).join("");
	const orderByAttr = orderBy || primaryNameAttribute;

	return `
		<fetch>
			<entity name="${entityName}">
				${attributeElements}
				<order attribute="${orderByAttr}" descending="false" />
			</entity>
		</fetch>`;
};

const mapLookupResults = (target: LookupTargetConfig, rows: Record<string, any>[]): LookupSearchResult[] => {
	const primaryIdAttribute = target.PrimaryIdAttribute || resolvePrimaryIdAttribute(target.EntityLogicalName);
	const primaryNameAttribute = target.PrimaryNameAttribute || getPrimaryNameAttribute(target);

	return rows
		.map((row) => {
			const id = row[primaryIdAttribute];
			if (!id) {
				return null;
			}

			return {
				id,
				logicalName: target.EntityLogicalName,
				name: row[primaryNameAttribute] ?? id,
				attributes: row,
			};
		})
		.filter(Boolean) as LookupSearchResult[];
};

export const quickSearchLookup = async (target: LookupTargetConfig, query: string, top: number = 10): Promise<LookupSearchResult[]> => {
	const attributes = buildLookupAttributes(target);
	const primaryNameAttribute = getPrimaryNameAttribute(target);

	const searchText = query?.trim();
	if (!searchText) {
		const fetchXml = buildFetchXmlForLookupResults(
			target.EntityLogicalName,
			primaryNameAttribute,
			attributes.filter((attribute) => attribute !== primaryNameAttribute)
		);
		const response = await retrieveMultipleRecords(target.EntityLogicalName, fetchXml, {
			top,
		});

		return mapLookupResults(target, response.results || []);
	}

	// TO-DO: Right now quick search is only searching the primary name, but in the future way may want to expand this and show additional information
	// in the quick search results.
	const filters = [getPrimaryNameAttribute(target)].map((attribute) => ({
		attribute,
		operator: "like",
		value: `%${searchText}%`,
	}));

	const fetchXml = buildFetchXmlWithFilter(target.EntityLogicalName, attributes, filters, "or");
	const response = await retrieveMultipleRecords(target.EntityLogicalName, fetchXml, {
		top,
		orderBy: `${primaryNameAttribute} asc`,
	});

	return mapLookupResults(target, response.results || []);
};

export const advancedSearchLookup = async (
	target: LookupTargetConfig,
	query: string,
	pagination: { page: number; pageSize: number },
	sortAttribute?: string
): Promise<{ results: LookupSearchResult[]; totalRecordCount?: number }> => {
	const attributes = buildLookupAttributes(target);
	const primaryNameAttribute = getPrimaryNameAttribute(target);
	let fetchXml = buildFetchXmlForLookupResults(
		target.EntityLogicalName,
		primaryNameAttribute,
		attributes.filter((attribute) => attribute !== primaryNameAttribute)
	);

	const searchText = query?.trim();
	if (searchText) {
		// TO-DO: Right now advanced search is only searching the primary name, but in the future way may want a better way to configure this.
		const filters = [getPrimaryNameAttribute(target)].map((attribute) => ({
			attribute,
			operator: "like",
			value: `%${searchText}%`,
		}));
		fetchXml = buildFetchXmlWithFilter(target.EntityLogicalName, attributes, filters, "or");
	}

	const response = await retrieveMultipleRecords(target.EntityLogicalName, fetchXml, {
		pagination,
		orderBy: `${sortAttribute || primaryNameAttribute} asc`,
	});

	return {
		results: mapLookupResults(target, response.results || []),
		totalRecordCount: response.totalRecordCount,
	};
};
