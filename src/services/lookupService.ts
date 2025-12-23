import { retrieveMultipleRecords } from "../hooks/api/Api";
import { buildFetchXmlForLookup, buildFetchXmlWithFilter } from "../utilities/FetchXmlBuilder";

export interface LookupTargetConfig {
	EntityLogicalName: string;
	Columns: string[];
	NavigationProperty?: string;
	ReferencingAttribute?: string;
}

export interface LookupSearchResult {
	id: string;
	logicalName: string;
	name: string;
	columns: Record<string, any>;
}

const getPrimaryColumn = (target: LookupTargetConfig): string => {
	if (target.Columns && target.Columns.length > 0) {
		return target.Columns[0];
	}

	return `${target.EntityLogicalName}name`;
};

const buildLookupColumns = (target: LookupTargetConfig): string[] => {
	const primaryColumn = getPrimaryColumn(target);
	const idColumn = `${target.EntityLogicalName}id`;
	const columnSet = new Set<string>([idColumn, primaryColumn, ...(target.Columns || [])]);
	return Array.from(columnSet);
};

const mapLookupResults = (target: LookupTargetConfig, rows: Record<string, any>[]): LookupSearchResult[] => {
	const idColumn = `${target.EntityLogicalName}id`;
	const primaryColumn = getPrimaryColumn(target);

	return rows
		.map((row) => {
			const id = row[idColumn];
			if (!id) {
				return null;
			}

			return {
				id,
				logicalName: target.EntityLogicalName,
				name: row[primaryColumn] ?? id,
				columns: row,
			};
		})
		.filter(Boolean) as LookupSearchResult[];
};

export const searchLookupQuick = async (
	target: LookupTargetConfig,
	query: string,
	top: number = 8
): Promise<LookupSearchResult[]> => {
	const trimmed = query?.trim();
	if (!trimmed) {
		return [];
	}

	const columns = buildLookupColumns(target);
	const filters = (target.Columns || [getPrimaryColumn(target)]).map((column) => ({
		attribute: column,
		operator: "like",
		value: `%${trimmed}%`,
	}));

	const fetchXml = buildFetchXmlWithFilter(target.EntityLogicalName, columns, filters, "or");
	const response = await retrieveMultipleRecords(target.EntityLogicalName, fetchXml, {
		top,
	});

	return mapLookupResults(target, response.results || []);
};

export const searchLookupAdvanced = async (
	target: LookupTargetConfig,
	query: string,
	pagination: { page: number; pageSize: number },
	sortColumn?: string
): Promise<{ results: LookupSearchResult[]; totalRecordCount?: number }> => {
	const columns = buildLookupColumns(target);
	const trimmed = query?.trim();
	const primaryColumn = getPrimaryColumn(target);
	let fetchXml = buildFetchXmlForLookup(
		target.EntityLogicalName,
		primaryColumn,
		columns.filter((column) => column !== primaryColumn)
	);

	if (trimmed) {
		const filters = (target.Columns || [getPrimaryColumn(target)]).map((column) => ({
			attribute: column,
			operator: "like",
			value: `%${trimmed}%`,
		}));
		fetchXml = buildFetchXmlWithFilter(target.EntityLogicalName, columns, filters, "or");
	}

	const response = await retrieveMultipleRecords(target.EntityLogicalName, fetchXml, {
		pagination,
		orderBy: `${sortColumn || primaryColumn} asc`,
	});

	return {
		results: mapLookupResults(target, response.results || []),
		totalRecordCount: response.totalRecordCount,
	};
};
