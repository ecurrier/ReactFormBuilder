import { retrieveRecord } from "@/services/api";
import type { DocumentMetadata, EygaApiContext } from "@utilities/eygaApi";
import { EygaApiClient } from "@utilities/eygaApi";
import type { ReactConfigurationIdentifierMetadata, ReactTableMetadataEntry } from "@types/config";
import { buildFetchXmlForRecord } from "@utilities/fetchXml";
import { getEntityMetadata } from "@utilities/metadata";
import { resolveRequestorId } from "@utilities/session";

export interface DocumentContext {
	documentPath: string;
	applicationNumber: string;
}

export interface DocumentUploadInput {
	entityName: string;
	recordId: string;
	folderName: string;
	file: File;
	uploadDate: string;
	childId?: string;
}

const identifierFieldCache = new Map<string, Map<string, string | null>>();
const documentContextCache = new Map<string, Map<string, DocumentContext>>();

const normalizeIdentifierMetadata = (metadata?: ReactConfigurationIdentifierMetadata | ReactConfigurationIdentifierMetadata[]) => {
	if (!metadata) {
		return [] as ReactConfigurationIdentifierMetadata[];
	}

	return Array.isArray(metadata) ? metadata : [metadata];
};

const getIdentifierFieldName = (entityName: string, identifier: string): string | null => {
	if (!entityName || !identifier) {
		return null;
	}

	if (!identifierFieldCache.has(entityName)) {
		identifierFieldCache.set(entityName, new Map());
	}

	const cached = identifierFieldCache.get(entityName);
	if (cached?.has(identifier)) {
		return cached.get(identifier) ?? null;
	}

	// for eyfrcc_childapplicationtest, the identifierFieldCache is storing nulls
	// need to find out why
	const metadata = getEntityMetadata(entityName) as ReactTableMetadataEntry | undefined;
	const identifierMetadata = normalizeIdentifierMetadata(metadata?.ConfigurationIdentifierMetadata);
	const match = identifierMetadata.find((entry) => entry.ConfigurationIdentifier === identifier);
	const fieldName = match?.FieldLogicalName ?? null;

	cached?.set(identifier, fieldName);
	return fieldName;
};

export const retrieveDocumentContext = async (entityName: string, recordId: string): Promise<DocumentContext | null> => {
	if (!entityName || !recordId) {
		return null;
	}

	if (!documentContextCache.has(entityName)) {
		documentContextCache.set(entityName, new Map());
	}

	const cache = documentContextCache.get(entityName);
	const cached = cache?.get(recordId);
	if (cached) {
		return cached;
	}

	const documentPathField = getIdentifierFieldName(entityName, "DocumentPath");
	const applicationNumberField = getIdentifierFieldName(entityName, "ApplicationNumber");

	if (!documentPathField || !applicationNumberField) {
		return null;
	}

	const fields = Array.from(new Set([documentPathField, applicationNumberField]));
	const fetchXml = buildFetchXmlForRecord(entityName, recordId, fields);
	const record = await retrieveRecord<Record<string, any>>(entityName, fetchXml);

	const documentPath = record?.[documentPathField];
	const applicationNumber = record?.[applicationNumberField];

	if (!documentPath || !applicationNumber) {
		return null;
	}

	const context = { documentPath, applicationNumber };
	cache?.set(recordId, context);
	return context;
};

const buildEygaContext = (entityName: string, recordId: string, apiAction: string): EygaApiContext => ({
	RegardingId: recordId,
	RegardingLogicalName: entityName,
	UserId: resolveRequestorId() ?? undefined,
	ApiAction: apiAction,
});

const buildUploadTags = (applicationNumber: string, folderName: string, uploadDate: string, childId?: string) => {
	const tags: Record<string, any> = {
		Id: applicationNumber,
		Folder: folderName,
		"Upload Date": uploadDate,
		Status: "Accepted",
		RestrictDelete: false,
	};

	if (childId) {
		tags.ChildId = childId;
	}

	return tags;
};

export const uploadDocumentForRecord = async ({ entityName, recordId, folderName, file, uploadDate, childId }: DocumentUploadInput): Promise<void> => {
	const context = await retrieveDocumentContext(entityName, recordId);
	if (!context) {
		throw new Error("Document path or application number not found for upload.");
	}

	const tags = buildUploadTags(context.applicationNumber, folderName, uploadDate, childId);

	await EygaApiClient.Documents.Upload(
		{
			FileName: file.name,
			DocumentFolder: folderName,
			RecordFolder: context.documentPath,
			Tags: tags,
			File: file,
		},
		buildEygaContext(entityName, recordId, "Upload Document")
	);
};

export const retrieveDocuments = async (entityName: string, recordId: string, folderName: string, childId?: string): Promise<DocumentMetadata[]> => {
	const context = await retrieveDocumentContext(entityName, recordId);
	if (!context) {
		return [];
	}

	const payload = {
		Id: context.applicationNumber,
		Folder: folderName,
		Status: "Accepted",
	} as { Id: string; Folder: string; Status: string; ChildId?: string };

	if (childId) {
		payload.ChildId = childId;
	}

	return EygaApiClient.Documents.SearchByTags(payload, buildEygaContext(entityName, recordId, "Search Documents"));
};

export const downloadDocument = async (entityName: string, recordId: string, fullName: string): Promise<void> => {
	const blob = await EygaApiClient.Documents.Download(fullName, buildEygaContext(entityName, recordId, "Download Document"));
	const link = document.createElement("a");
	link.href = window.URL.createObjectURL(blob);
	link.download = fullName.split("/").pop() || "document";
	link.click();
};

export const deleteDocument = async (entityName: string, recordId: string, fullName: string): Promise<void> => {
	await EygaApiClient.Documents.Delete(fullName, buildEygaContext(entityName, recordId, "Delete Document"));
};
