import React from "react";
import { Alert, ConfirmationModal, LoadingIndicator } from "@components";
import { retrieveEygaConfiguration } from "@utilities";
import { generateTempId, isTempId } from "@utilities/common";
import type { DocumentMetadata } from "@utilities/eygaApi";
import { deleteDocument, downloadDocument, retrieveDocuments, uploadDocumentForRecord } from "@services/documentService";

/*
	For non-persisted parents, we need to stage uploads  (similar to table entry)
		- on file select, upload to temp storage with a generated temp id
		- store the temp id and file info in state
		- on parent save, associate the temp uploads with the new parent record

	For persisted parents, we can upload directly
		- on file select, upload document immediately
		- refresh the list of uploaded documents

	Notes:

    1. Document Uploads require a Document Path to work
        Document Path is available on some records, to determine if there is a value
        	This can be retrieved via the table metadata under "ConfigurationIdentifierMetadata" via FieldLogicalName
        	We need to use this to retrieve the document path value
    2. The control should allow upload multiple documents
		Documents are displayed in a table format below the upload file button
    3. The control should show existing documents in a table view with options to either download or delete
		These should use the appropriate eyga api actions to perform these operations
    4. To initially validate uploads, there are some settings on eyga configuration we can retrieve
        - allowed file types
        - max file size
	5. If upload fails, display an error banner
		If success, display a success banner
*/

export interface DocumentUploadControlProps {
	config: DocumentUploadControlConfig;
	formState?: any;
	entityName?: string;
}

interface DocumentUploadControlConfig {
	FolderName: string;
	Description?: string;
	ValidationType?: number;
	ValidationMessage?: string;
}

type AlertState = {
	type: "success" | "danger" | "warning" | "info";
	message: string;
};

type DeleteTarget = { type: "pending"; id: string; name: string } | { type: "persisted"; fullName: string; name: string; restrictDelete?: boolean };

const formatUploadDate = (date: Date): string => {
	const month = date.getUTCMonth() + 1;
	const day = date.getUTCDate();
	const year = date.getUTCFullYear();
	const hours = date.getUTCHours();
	const minutes = date.getUTCMinutes();
	const seconds = date.getUTCSeconds();
	const displayHours = hours % 12 || 12;
	const suffix = hours >= 12 ? "PM" : "AM";

	return `${month}/${day}/${year} ${displayHours}-${minutes.toString().padStart(2, "0")}-${seconds.toString().padStart(2, "0")} ${suffix}`;
};

export const DocumentUploadControl: React.FC<DocumentUploadControlProps> = ({ config, formState, entityName }) => {
	const [allowedFileTypes, setAllowedFileTypes] = React.useState<string[] | null>(null);
	const [maxFileSizeMB, setMaxFileSizeMB] = React.useState<number | null>(null);
	const [documents, setDocuments] = React.useState<DocumentMetadata[]>([]);
	const [alertState, setAlertState] = React.useState<AlertState | null>(null);
	const [isLoading, setIsLoading] = React.useState(false);
	const [isUploading, setIsUploading] = React.useState(false);
	const [isDeleting, setIsDeleting] = React.useState(false);
	const [deleteTarget, setDeleteTarget] = React.useState<DeleteTarget | null>(null);
	const inputRef = React.useRef<HTMLInputElement | null>(null);

	const primaryEntityName = formState?.primaryEntityName;
	const resolvedEntityName = entityName || primaryEntityName || "";
	const relatedRecord = resolvedEntityName && resolvedEntityName !== primaryEntityName ? formState?.getRelatedRecord?.(resolvedEntityName) : undefined;
	const recordId = resolvedEntityName === primaryEntityName ? formState?.recordId : relatedRecord?.recordId;
	const isTableEntry = formState?.type === "tableEntry";
	const childRecordId = isTableEntry ? recordId : undefined;
	const contextEntityName = resolvedEntityName;
	const contextRecordId = recordId;
	const isPersistedRecord = Boolean(contextRecordId && !isTempId(contextRecordId));

	const pendingUploads = formState?.getPendingDocumentUploads?.(contextEntityName, config.FolderName, childRecordId) ?? [];
	const uploadChildId = childRecordId && contextRecordId !== childRecordId ? childRecordId : undefined;

	const normalizedAllowedTypes = React.useMemo(() => {
		if (!allowedFileTypes) {
			return null;
		}

		return allowedFileTypes.map((type) => (type.startsWith(".") ? type.toLowerCase() : `.${type.toLowerCase()}`));
	}, [allowedFileTypes]);

	const loadDocuments = React.useCallback(async () => {
		if (!contextRecordId || !contextEntityName || !isPersistedRecord) {
			setDocuments([]);
			return;
		}

		setIsLoading(true);
		try {
			const response = await retrieveDocuments(contextEntityName, contextRecordId, config.FolderName, uploadChildId);
			setDocuments(response || []);
		} catch (error) {
			console.error("Failed to load documents:", error);
			setAlertState({ type: "danger", message: "Failed to load documents." });
		} finally {
			setIsLoading(false);
		}
	}, [config.FolderName, contextEntityName, contextRecordId, isPersistedRecord, uploadChildId]);

	React.useEffect(() => {
		const fetchConfiguration = async () => {
			try {
				const eygaConfiguration = await retrieveEygaConfiguration();
				setAllowedFileTypes(eygaConfiguration.AllowedFileTypes.map((fileType) => fileType.Extensions).flat());
				setMaxFileSizeMB(eygaConfiguration.MaxFileSizeMB);
			} catch (error) {
				console.error("Failed to fetch document upload configuration:", error);
				setAlertState({ type: "danger", message: "Failed to load upload configuration." });
			}
		};

		fetchConfiguration();
	}, []);

	React.useEffect(() => {
		loadDocuments();
	}, [loadDocuments]);

	const validateFiles = (files: File[]) => {
		if (!files.length) {
			return null;
		}

		for (const file of files) {
			if (maxFileSizeMB && file.size / 1_000_000 > maxFileSizeMB) {
				return `You are attempting to upload a file larger than ${maxFileSizeMB} MB.`;
			}

			if (normalizedAllowedTypes && normalizedAllowedTypes.length > 0) {
				const extension = file.name.includes(".") ? `.${file.name.split(".").pop()?.toLowerCase()}` : "";
				if (!extension || !normalizedAllowedTypes.includes(extension)) {
					return `The file type ${extension || "(none)"} is not allowed.`;
				}
			}
		}

		return null;
	};

	const handleFilesSelected = async (files: File[]) => {
		const validationError = validateFiles(files);
		if (validationError) {
			setAlertState({ type: "danger", message: validationError });
			return;
		}

		if (!files.length) {
			return;
		}

		setAlertState(null);

		if (!contextRecordId || !isPersistedRecord) {
			files.forEach((file) => {
				formState?.addPendingDocumentUpload?.({
					id: generateTempId(),
					entityName: contextEntityName,
					recordId: isTableEntry && childRecordId ? undefined : contextRecordId,
					childRecordId,
					folderName: config.FolderName,
					file,
					uploadDate: formatUploadDate(new Date()),
				});
			});
			setAlertState({ type: "success", message: "Files staged. They will be uploaded after saving the record." });
			return;
		}

		setIsUploading(true);
		try {
			// TO-DO: Consider parallel uploads with Promise.all if needed
			for (const file of files) {
				await uploadDocumentForRecord({
					entityName: contextEntityName,
					recordId: contextRecordId,
					folderName: config.FolderName,
					file,
					uploadDate: formatUploadDate(new Date()),
					childId: uploadChildId,
				});
			}
			setAlertState({ type: "success", message: "Files uploaded successfully." });
			// Due to azure latency, we may need to wait a moment before reloading
			// Currently, after an upload, the new document is not appearing immediately
			await loadDocuments();
		} catch (error) {
			console.error("Upload failed:", error);
			setAlertState({ type: "danger", message: "File upload failed. Please try again." });
		} finally {
			setIsUploading(false);
		}
	};

	const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const files = event.target.files ? Array.from(event.target.files) : [];
		event.target.value = "";
		void handleFilesSelected(files);
	};

	const handleDeleteRequest = (target: DeleteTarget) => {
		if (target.type === "persisted" && target.restrictDelete) {
			setAlertState({ type: "warning", message: "You do not have permission to delete this file." });
			return;
		}

		setDeleteTarget(target);
	};

	const handleConfirmDelete = async () => {
		if (!deleteTarget) {
			return;
		}

		if (deleteTarget.type === "pending") {
			const key = `${resolvedEntityName}_${deleteTarget.id}`;
			formState?.deletePendingDocumentUpload?.(key);
			setAlertState({ type: "success", message: "Pending file removed." });
			setDeleteTarget(null);
			return;
		}

		if (!contextRecordId || !isPersistedRecord) {
			setDeleteTarget(null);
			return;
		}

		setIsDeleting(true);
		try {
			await deleteDocument(contextEntityName, contextRecordId, deleteTarget.fullName);
			setAlertState({ type: "success", message: "File deleted successfully." });
			await loadDocuments();
		} catch (error) {
			console.error("Delete failed:", error);
			setAlertState({ type: "danger", message: "Failed to delete file." });
		} finally {
			setIsDeleting(false);
			setDeleteTarget(null);
		}
	};

	const handleDownload = async (fullName: string) => {
		if (!contextRecordId || !isPersistedRecord) {
			return;
		}

		try {
			await downloadDocument(contextEntityName, contextRecordId, fullName);
		} catch (error) {
			console.error("Download failed:", error);
			setAlertState({ type: "danger", message: "Failed to download file." });
		}
	};

	const busyMessage = isUploading ? "Uploading files..." : isDeleting ? "Deleting file..." : "Loading files...";
	const rows = [
		...pendingUploads.map((upload) => ({
			key: `pending-${upload.id}`,
			name: upload.file.name,
			isPending: true,
			id: upload.id,
		})),
		...documents.map((doc) => ({
			key: doc.fullName,
			name: doc.name || doc.fullName.split("/").pop() || doc.fullName,
			fullName: doc.fullName,
			restrictDelete: doc.tags?.RestrictDelete === true,
			isPending: false,
		})),
	];

	return (
		<>
			{config.Description && <h3 className="h3" dangerouslySetInnerHTML={{ __html: config.Description }} />}
			{alertState && (
				<Alert type={alertState.type} dismissible onDismiss={() => setAlertState(null)}>
					<p>{alertState.message}</p>
				</Alert>
			)}
			<div className="form-field-file-upload">
				<input
					ref={inputRef}
					className="file-upload-core"
					type="file"
					style={{ display: "none" }}
					accept={normalizedAllowedTypes ? normalizedAllowedTypes.join(",") : undefined}
					multiple
					onChange={handleInputChange}
				/>
				<button type="button" className="btn btn-default" aria-required="true" onClick={() => inputRef.current?.click()} disabled={isUploading}>
					Choose File
				</button>
			</div>
			<div className="file-upload-table contextual-loading-container mt-3">
				<LoadingIndicator visible={isLoading || isUploading || isDeleting} variant="contextual" message={busyMessage} />
				<table id="file-upload-table" aria-live="polite" role="grid" className="table table-custom table-header-bg table-border-bottom table-hover">
					<thead>
						<tr>
							<th scope="col" style={{ width: "100%" }}>
								File Name
							</th>
							<th scope="col" className="actions-menu">
								Remove
							</th>
						</tr>
					</thead>
					<tbody>
						{rows.length > 0 ? (
							rows.map((row) => (
								<tr key={row.key}>
									<td>
										{row.isPending ? (
											<span style={{ fontStyle: "italic", opacity: 0.8 }}>{row.name} (Pending)</span>
										) : (
											<button type="button" className="btn btn-link-inline" onClick={() => handleDownload(row.fullName || "")}>
												<p>{row.name}</p>
											</button>
										)}
									</td>
									<td className="actions-menu">
										<button
											type="button"
											className="btn btn-link btn-md btn-icon-only"
											aria-label="remove"
											disabled={row.isPending ? false : row.restrictDelete}
											onClick={() =>
												handleDeleteRequest(
													row.isPending
														? { type: "pending", id: row.id, name: row.name }
														: {
																type: "persisted",
																fullName: row.fullName || "",
																name: row.name,
																restrictDelete: row.restrictDelete,
															}
												)
											}>
											<span className="glyphicon glyphicon-trash icon-size-md"></span>
										</button>
									</td>
								</tr>
							))
						) : (
							<tr>
								<td colSpan={2} className="no-data">
									{isLoading ? "" : "No documents available"}
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
			<ConfirmationModal
				isOpen={Boolean(deleteTarget)}
				title="Delete File"
				message="Are you sure you want to remove this file?"
				confirmText="Delete"
				cancelText="Cancel"
				onConfirm={handleConfirmDelete}
				onCancel={() => setDeleteTarget(null)}
				modalSize="md"
			/>
		</>
	);
};

export default DocumentUploadControl;
