import { ActionType, DataType } from "@constants/enums";
import type { ReactFormConfiguration } from "@app-types/config";

export interface TableMetadataEntry {
	EntityLogicalName: string;
	EntitySchemaName?: string;
	EntitySetName?: string;
	EntityDisplayName?: string;
	EntityDescription?: string;
	PrimaryIdAttribute?: string;
	PrimaryNameAttribute?: string;
	PrimaryNameAttributeDisplayName?: string;
}

let entityMetadataCache = new Map<string, TableMetadataEntry>();

const mergeMetadata = (map: Map<string, TableMetadataEntry>, logicalName: string, updates: Partial<TableMetadataEntry>) => {
	const existing = map.get(logicalName) ?? { EntityLogicalName: logicalName };
	map.set(logicalName, { ...existing, ...updates, EntityLogicalName: logicalName });
};

const addLookupTargets = (map: Map<string, TableMetadataEntry>, config?: ReactFormConfiguration) => {
	if (!config?.Form?.Steps) {
		return;
	}

	config.Form.Steps.forEach((step) => {
		step.Actions?.forEach((action) => {
			const actionsToCheck = [action, ...(((action as any).ChildActions ?? []) as (typeof action)[])];

			actionsToCheck.forEach((currentAction) => {
				const properties = currentAction.Properties as any;
				if (currentAction.Type !== ActionType.FieldInput || properties?.DataType !== DataType.Lookup) {
					return;
				}

				properties?.Targets?.forEach((target: any) => {
					const logicalName = target?.EntityLogicalName;
					if (!logicalName) {
						return;
					}

					mergeMetadata(map, logicalName, {
						EntityLogicalName: logicalName,
						EntitySetName: target.EntitySetName,
						PrimaryIdAttribute: target.PrimaryIdAttribute,
						PrimaryNameAttribute: target.PrimaryNameAttribute,
					});
				});
			});
		});
	});
};

export const buildEntityMetadataMap = (config?: ReactFormConfiguration): Map<string, TableMetadataEntry> => {
	const map = new Map<string, TableMetadataEntry>();
	const tableMetadata = config?.Form?.TableMetadata ?? (config as ReactFormConfiguration | undefined)?.TableMetadata;

	if (tableMetadata) {
		Object.entries(tableMetadata).forEach(([key, value]) => {
			if (!value && !key) {
				return;
			}

			const logicalName = value?.EntityLogicalName || key;
			if (!logicalName) {
				return;
			}

			mergeMetadata(map, logicalName, { ...value, EntityLogicalName: logicalName });
		});
	}

	addLookupTargets(map, config);

	return map;
};

export const setEntityMetadataCache = (map: Map<string, TableMetadataEntry>) => {
	entityMetadataCache = map ?? new Map<string, TableMetadataEntry>();
};

export const getEntityMetadata = (entityName: string, map?: Map<string, TableMetadataEntry>): TableMetadataEntry | undefined => {
	if (!entityName) {
		return undefined;
	}

	return map?.get(entityName) ?? entityMetadataCache.get(entityName);
};

const fallbackEntitySetName = (entityName: string): string => {
	if (!entityName) {
		return entityName;
	}

	const lastChar = entityName[entityName.length - 1].toLowerCase();
	switch (lastChar) {
		case "s":
			return `${entityName}es`;
		case "y":
			return `${entityName.slice(0, -1)}ies`;
		default:
			return `${entityName}s`;
	}
};

export const resolveEntitySetName = (entityName: string, map?: Map<string, TableMetadataEntry>): string => {
	if (!entityName) {
		return entityName;
	}

	const metadata = getEntityMetadata(entityName, map);
	return metadata?.EntitySetName || fallbackEntitySetName(entityName);
};

export const resolvePrimaryIdAttribute = (entityName: string, map?: Map<string, TableMetadataEntry>): string => {
	if (!entityName) {
		return entityName;
	}

	const metadata = getEntityMetadata(entityName, map);
	return metadata?.PrimaryIdAttribute || `${entityName}id`;
};

export const resolvePrimaryNameAttribute = (entityName: string, map?: Map<string, TableMetadataEntry>): string => {
	if (!entityName) {
		return entityName;
	}

	const metadata = getEntityMetadata(entityName, map);
	return metadata?.PrimaryNameAttribute || `${entityName}name`;
};

export const resolvePrimaryNameAttributeDisplayName = (entityName: string, map?: Map<string, TableMetadataEntry>): string => {
	if (!entityName) {
		return entityName;
	}

	const metadata = getEntityMetadata(entityName, map);
	return metadata?.PrimaryNameAttributeDisplayName || `Name`;
};

export const resolveEntityDisplayName = (entityName: string, map?: Map<string, TableMetadataEntry>): string => {
	if (!entityName) {
		return entityName;
	}

	const metadata = getEntityMetadata(entityName, map);
	return metadata?.EntityDisplayName || entityName;
};
