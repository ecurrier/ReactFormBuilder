import type { ReactFormConfiguration } from "../types/config";

export interface DocumentIdentifierFields {
	documentPathField?: string;
	applicationNumberField?: string;
}

const normalizeIdentifierMetadata = (metadata: unknown): Array<{ ConfigurationIdentifier?: string; FieldLogicalName?: string }> => {
	if (!metadata) {
		return [];
	}

	if (Array.isArray(metadata)) {
		return metadata;
	}

	return [metadata as { ConfigurationIdentifier?: string; FieldLogicalName?: string }];
};

export const getDocumentIdentifierFields = (config: ReactFormConfiguration, entityName?: string): DocumentIdentifierFields => {
	if (!config || !entityName) {
		return {};
	}

	const tableMetadata = config.Form?.TableMetadata?.[entityName] ?? config.TableMetadata?.[entityName];
	const identifierMetadata = normalizeIdentifierMetadata(tableMetadata?.ConfigurationIdentifierMetadata);

	let documentPathField: string | undefined;
	let applicationNumberField: string | undefined;

	identifierMetadata.forEach((entry) => {
		if (!entry?.ConfigurationIdentifier || !entry?.FieldLogicalName) {
			return;
		}

		if (entry.ConfigurationIdentifier === "DocumentPath") {
			documentPathField = entry.FieldLogicalName;
		}

		if (entry.ConfigurationIdentifier === "ApplicationNumber") {
			applicationNumberField = entry.FieldLogicalName;
		}
	});

	return { documentPathField, applicationNumberField };
};
