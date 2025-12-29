import { buildFetchXmlForRecord } from "../utilities/FetchXmlBuilder";
import { retrieveRecord } from "../hooks/api";
import type { ReactFormConfiguration } from "../types/config";
import { getDocumentIdentifierFields } from "../utilities/documentUpload";
import { ApiCall, buildEygaApiContext, callEygaApi, getEYGAConfigurationSetting } from "./eygaApi";

export interface DocumentContext {
	documentPath: string;
	idTag: string;
}

export interface DocumentFile {
	name: string;
	fullName: string;
	tags?: Record<string, any>;
}

export interface DocumentUploadPayload {
	folderName: string;
	file: File;
	documentContext: DocumentContext;
	childId?: string | null;
}

export const fetchDocumentContext = async (
	entityName: string,
	recordId: string,
	config: ReactFormConfiguration
): Promise<DocumentContext | null> => {
	const { documentPathField, applicationNumberField } = getDocumentIdentifierFields(config, entityName);
	const columns = [documentPathField, applicationNumberField].filter(Boolean) as string[];

	if (columns.length === 0) {
		return null;
	}

	const fetchXml = buildFetchXmlForRecord(entityName, recordId, columns);
	const record = await retrieveRecord<Record<string, any>>(entityName, fetchXml);

	if (!record || !documentPathField || !record[documentPathField]) {
		return null;
	}

	const idTag = applicationNumberField ? record[applicationNumberField] : recordId;

	return {
		documentPath: record[documentPathField],
		idTag: idTag ?? recordId,
	};
};

export const listDocuments = async (
	folderName: string,
	documentContext: DocumentContext,
	recordId: string,
	entityName: string
): Promise<DocumentFile[]> => {
	const payload = {
		Id: documentContext.idTag,
		Folder: folderName,
		Status: "Accepted",
	};

	const response = await callEygaApi<DocumentFile[]>(ApiCall.GetDocumentsById, buildEygaApiContext(recordId, entityName), payload);
	return Array.isArray(response) ? response : [];
};

export const uploadDocument = async ({ folderName, file, documentContext, childId }: DocumentUploadPayload, recordId: string, entityName: string) => {
	const now = new Date();
	const uploadDate = `${now.getUTCMonth() + 1}/${now.getUTCDate()}/${now.getUTCFullYear()} ${now.getUTCHours() % 12 || 12}-${now
		.getUTCMinutes()
		.toString()
		.padStart(2, "0")}-${now.getUTCSeconds().toString().padStart(2, "0")} ${now.getUTCHours() >= 12 ? "PM" : "AM"}`;

	const tags: Record<string, any> = {
		Id: documentContext.idTag,
		Folder: folderName,
		"Upload Date": uploadDate,
		Status: "Accepted",
		RestrictDelete: false,
	};

	if (childId) {
		tags.ChildId = childId;
	}

	const payload = new FormData();
	payload.append(
		"json",
		JSON.stringify({
			Name: file.name,
			DocumentFolder: folderName,
			RecordFolder: documentContext.documentPath,
			Tags: tags,
		})
	);
	payload.append("file", file);

	await callEygaApi(ApiCall.UploadDocument, buildEygaApiContext(recordId, entityName), payload);
};

export const deleteDocument = async (fullName: string, recordId: string, entityName: string) => {
	return callEygaApi(ApiCall.DeleteDocument, buildEygaApiContext(recordId, entityName), fullName);
};

export const downloadDocument = async (fullName: string, recordId: string, entityName: string) => {
	return callEygaApi<Blob>(ApiCall.DownloadDocument, buildEygaApiContext(recordId, entityName), fullName);
};

export const validateFile = async (file: File) => {
	const maxSize = await getEYGAConfigurationSetting("eyfrcc_maxfilesizemb");
	const validExtensions = await getEYGAConfigurationSetting("eyfrcc_allowedextensions");

	const maxFileSize = maxSize ?? 100;
	if (file.size / 1000000 > maxFileSize) {
		return `ERROR: You are attempting to upload a file larger than ${maxFileSize}mb`;
	}

	if (!/^[\w,\s()\-]+\.[A-Za-z0-9]{3,4}$/i.test(file.name)) {
		return "ERROR: You are attempting to upload an invalid filename.";
	}

	const fileExtension = file.name.split(".").pop()?.toLowerCase();
	const fileMimetype = file.type;

	if (!fileMimetype && !fileExtension) {
		return "ERROR: No input given.";
	}

	if (validExtensions) {
		const validExtensionsJson = JSON.parse(validExtensions);
		const validFileTypes = validExtensionsJson.ValidFileTypes || [];
		const matchingType = validFileTypes.find((type: any) => type.m?.toLowerCase() === fileMimetype?.toLowerCase());

		if (!matchingType) {
			if (fileExtension !== "heic" && fileExtension !== "heif") {
				return `ERROR: ${fileMimetype} is not a valid mimeType.`;
			}
		} else {
			const allowedExtensions = matchingType.e?.toLowerCase() ?? "";
			if (fileExtension && !allowedExtensions.includes(fileExtension.toLowerCase())) {
				return `ERROR: ${fileExtension} is not a valid extension for ${fileMimetype}.`;
			}
		}
	}

	return null;
};
