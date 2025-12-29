import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactFormConfiguration, ReactActionConfiguration } from "../../types/config";
import { DocumentValidationType } from "../../constants/enums";
import { getDocumentIdentifierFields } from "../../utilities/documentUpload";
import { buildFetchXmlForRecord } from "../../utilities/FetchXmlBuilder";
import { retrieveRecord } from "../../hooks/api/Api";
import { deleteDocument, downloadDocument, listDocuments, uploadDocument, validateFile } from "../../services/documentUploadService";

interface DocumentUploadProps {
	action: ReactActionConfiguration;
	entityName?: string;
	recordId?: string | null;
	formState?: any;
	formConfig: ReactFormConfiguration;
	readOnly?: boolean;
}

const formatDescription = (description?: string | null) => {
	if (!description) {
		return null;
	}

	const trimmed = description.trim();
	if (trimmed.startsWith("<")) {
		return <span className="help-block" dangerouslySetInnerHTML={{ __html: trimmed }} />;
	}

	return <span className="help-block">{trimmed}</span>;
};

const buildUploadKey = (actionId: string, entityName?: string, recordId?: string | null) => {
	return `${actionId}:${entityName ?? "unknown"}:${recordId ?? "new"}`;
};

const resolveDocumentContext = async (
	entityName: string,
	recordId: string,
	formConfig: ReactFormConfiguration,
	formState: any
) => {
	const { documentPathField, applicationNumberField } = getDocumentIdentifierFields(formConfig, entityName);

	if (!documentPathField) {
		return null;
	}

	const existingPath = formState?.getFieldValue?.(`${entityName}.${documentPathField}`);
	const existingIdTag = applicationNumberField ? formState?.getFieldValue?.(`${entityName}.${applicationNumberField}`) : undefined;

	if (existingPath) {
		return {
			documentPath: existingPath,
			idTag: existingIdTag ?? recordId,
		};
	}

	const columns = [documentPathField, applicationNumberField].filter(Boolean) as string[];
	const fetchXml = buildFetchXmlForRecord(entityName, recordId, columns);
	const record = await retrieveRecord<Record<string, any>>(entityName, fetchXml);
	if (!record || !record[documentPathField]) {
		return null;
	}

	return {
		documentPath: record[documentPathField],
		idTag: applicationNumberField ? record[applicationNumberField] : recordId,
	};
};

const DocumentUpload: React.FC<DocumentUploadProps> = ({ action, entityName, recordId, formState, formConfig, readOnly = false }) => {
	const properties = action?.Properties ?? {};
	const folderName = properties.FolderName ?? action.Name ?? "Documents";
	const validationType = properties.ValidationType ?? properties.validationType ?? DocumentValidationType.NoValidation;
	const validationMessage = properties.ValidationMessage;
	const actionId = action.Id ?? action.Name ?? folderName;

	const [documentContext, setDocumentContext] = useState<{ documentPath: string; idTag: string } | null>(null);
	const [files, setFiles] = useState<Array<{ name: string; fullName: string }>>([]);
	const [pendingFiles, setPendingFiles] = useState<Array<{ id: string; name: string }>>([]);
	const [isBusy, setIsBusy] = useState(false);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const uploadKey = useMemo(() => buildUploadKey(actionId, entityName, recordId), [actionId, entityName, recordId]);
	const resolvedEntityName = entityName ?? formState?.primaryEntityName;
	const resolvedRecordId = recordId ?? formState?.recordId;
	const getFieldValue = formState?.getFieldValue;
	const getPendingDocumentUploads = formState?.getPendingDocumentUploads;
	const setDocumentUploadState = formState?.setDocumentUploadState;
	const addPendingDocumentUpload = formState?.addPendingDocumentUpload;

	const syncUploadState = useCallback(() => {
		setDocumentUploadState?.(uploadKey, {
			files,
			pendingFiles: pendingFiles.map((file) => ({ name: file.name })),
		});
	}, [files, pendingFiles, setDocumentUploadState, uploadKey]);

	const loadFiles = useCallback(
		async (context: { documentPath: string; idTag: string }) => {
			if (!context || !resolvedRecordId || !resolvedEntityName) {
				return;
			}

			setIsBusy(true);
			setErrorMessage(null);
			try {
				const response = await listDocuments(folderName, context, resolvedRecordId, resolvedEntityName);
				setFiles(response.map((file) => ({ name: file.name, fullName: file.fullName })));
			} catch (error) {
				setErrorMessage(error instanceof Error ? error.message : String(error));
			} finally {
				setIsBusy(false);
			}
		},
		[folderName, resolvedEntityName, resolvedRecordId]
	);

	useEffect(() => {
		let isMounted = true;
		if (!resolvedEntityName || !resolvedRecordId) {
			return;
		}

		resolveDocumentContext(resolvedEntityName, resolvedRecordId, formConfig, { getFieldValue })
			.then((context) => {
				if (!isMounted) {
					return;
				}
				setDocumentContext((prev) => {
					if (!context) {
						return prev;
					}
					if (prev?.documentPath === context.documentPath && prev?.idTag === context.idTag) {
						return prev;
					}
					return context;
				});
			})
			.catch((error) => {
				if (isMounted) {
					setErrorMessage(error instanceof Error ? error.message : String(error));
				}
			});

		return () => {
			isMounted = false;
		};
	}, [formConfig, getFieldValue, resolvedEntityName, resolvedRecordId]);

	useEffect(() => {
		if (!documentContext) {
			return;
		}
		loadFiles(documentContext);
	}, [documentContext, loadFiles]);

	useEffect(() => {
		const pending = getPendingDocumentUploads?.(resolvedEntityName, resolvedRecordId) ?? [];
		const matchingPending = pending.filter((upload: any) => upload.actionId === actionId);
		const pendingList = matchingPending.map((upload: any) => ({ id: upload.id, name: upload.file.name }));
		setPendingFiles((prev) => {
			if (prev.length === pendingList.length && prev.every((file, index) => file.id === pendingList[index]?.id)) {
				return prev;
			}
			return pendingList;
		});
	}, [actionId, getPendingDocumentUploads, resolvedEntityName, resolvedRecordId]);

	useEffect(() => {
		syncUploadState();
	}, [syncUploadState]);

	const handleDownload = async (fullName: string) => {
		if (!resolvedRecordId || !resolvedEntityName) {
			return;
		}

		try {
			const blob = await downloadDocument(fullName, resolvedRecordId, resolvedEntityName);
			const link = document.createElement("a");
			link.href = window.URL.createObjectURL(blob);
			link.download = fullName.split("/").pop() || "download";
			link.click();
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : String(error));
		}
	};

	const handleDelete = async (fullName: string) => {
		if (readOnly || !resolvedRecordId || !resolvedEntityName) {
			return;
		}

		if (!confirm("Are you sure you want to remove this file?")) {
			return;
		}

		setIsBusy(true);
		setErrorMessage(null);
		try {
			await deleteDocument(fullName, resolvedRecordId, resolvedEntityName);
			await loadFiles();
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : String(error));
		} finally {
			setIsBusy(false);
		}
	};

	const queuePendingUpload = useCallback(
		(file: File) => {
			if (!resolvedEntityName) {
				return;
			}

			const uploadId = crypto.randomUUID();
			addPendingDocumentUpload?.({
				id: uploadId,
				entityName: resolvedEntityName,
				recordId: resolvedRecordId ?? null,
				actionId,
				folderName,
				file,
				validationType,
			});

			setPendingFiles((prev) => [...prev, { id: uploadId, name: file.name }]);
			setStatusMessage("File queued for upload once the record is saved.");
		},
		[actionId, addPendingDocumentUpload, folderName, resolvedEntityName, resolvedRecordId, validationType]
	);

	const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) {
			return;
		}

		setErrorMessage(null);
		const validationError = await validateFile(file);
		if (validationError) {
			setErrorMessage(validationError);
			return;
		}

		if (!documentContext || !resolvedRecordId || !resolvedEntityName) {
			queuePendingUpload(file);
			return;
		}

		setIsBusy(true);
		setStatusMessage("Uploading file...");
		try {
			if (validationType === DocumentValidationType.OneFileOnly && files.length > 0) {
				for (const existing of files) {
					await deleteDocument(existing.fullName, resolvedRecordId, resolvedEntityName);
				}
			}

			await uploadDocument({ folderName, file, documentContext }, resolvedRecordId, resolvedEntityName);
			await loadFiles();
			setStatusMessage("File uploaded successfully.");
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : String(error));
		} finally {
			setIsBusy(false);
		}
	};

	const totalCount = files.length + pendingFiles.length;
	const showValidationError =
		(validationType === DocumentValidationType.OneFileOnly || validationType === DocumentValidationType.AtLeastOneFile) && totalCount === 0;

	return (
		<div className="field form-group form-field-file-upload">
			<label className={showValidationError ? "control-label required" : "control-label"}>{folderName}</label>
			<input id={`document-upload-${actionId}`} type="file" onChange={handleFileChange} disabled={readOnly || isBusy} />
			{formatDescription(properties.Description)}
			{statusMessage && <span className="help-block">{statusMessage}</span>}
			{errorMessage && (
				<span className="help-block" role="alert">
					{errorMessage}
				</span>
			)}
			{showValidationError && (
				<span className="help-block" role="alert">
					{validationMessage ?? `You must attach one or more required documents for this category: ${folderName}`}
				</span>
			)}
			{isBusy && <span className="help-block">Processing documents...</span>}
			{files.length > 0 || pendingFiles.length > 0 ? (
				<table className="table">
					<thead>
						<tr>
							<th>File</th>
							<th className="text-right">Actions</th>
						</tr>
					</thead>
					<tbody>
						{pendingFiles.map((file) => (
							<tr key={file.id}>
								<td>
									<span style={{ fontStyle: "italic" }}>{file.name}</span> <span className="text-muted">(pending)</span>
								</td>
								<td className="text-right">Save the record to upload</td>
							</tr>
						))}
						{files.map((file) => (
							<tr key={file.fullName}>
								<td>
									<button type="button" className="btn btn-link" onClick={() => handleDownload(file.fullName)}>
										{file.name}
									</button>
								</td>
								<td className="text-right">
									<button type="button" className="btn btn-link" onClick={() => handleDelete(file.fullName)} disabled={readOnly}>
										Delete
									</button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			) : null}
		</div>
	);
};

export default DocumentUpload;
