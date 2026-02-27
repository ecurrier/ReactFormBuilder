import React from "react";
import { Alert, ConfirmationModal, LoadingIndicator, DropdownMenu, DropdownMenuItem, Badge } from "@components";
import { retrieveEygaConfiguration, isTempId, type DocumentMetadata } from "@utilities";
import { deleteDocument, downloadDocument, retrieveDocuments, uploadDocumentForRecord, getSASUrlForDocument } from "@services/documentService";
import { AZURE_LATENCY_DELAY_MS, BYTES_IN_MB } from "@/constants";
import { DocumentValidationType } from "@/constants/enums";

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
	const [isDragActive, setIsDragActive] = React.useState(false);
	const [deleteTarget, setDeleteTarget] = React.useState<DeleteTarget | null>(null);
	const inputRef = React.useRef<HTMLInputElement | null>(null);

	const primaryEntityName = formState?.primaryEntityName;
	const resolvedEntityName = entityName || primaryEntityName || "";
	const isTableEntry = formState?.type === "tableEntry";
	const ensureEntityNode = formState?.ensureEntityNode;
	const recordNode = isTableEntry
		? formState?.nodeId
			? formState?.getNodeById?.(formState.nodeId)
			: formState?.findNodeByRecordId?.(resolvedEntityName, formState?.recordId)
		: formState?.getEntityNode?.(resolvedEntityName);
	const recordId = recordNode?.recordId ?? (isTableEntry ? formState?.recordId : formState?.recordId);
	const contextEntityName = resolvedEntityName;
	const contextRecordId = recordId;
	const isPersistedRecord = Boolean(contextRecordId && !isTempId(contextRecordId));

	const pendingUploads = formState?.getUploadNodes?.({ parentNodeId: recordNode?.id, entityName: contextEntityName, folderName: config.FolderName }) ?? [];
	const uploadChildId = undefined;

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

	React.useEffect(() => {
		if (!recordNode && !isTableEntry && resolvedEntityName && ensureEntityNode) {
			ensureEntityNode(resolvedEntityName);
		}
	}, [ensureEntityNode, isTableEntry, recordNode, resolvedEntityName]);

	const validateFiles = (files: File[]) => {
		if (!files.length) {
			return null;
		}

		if (config.ValidationType === DocumentValidationType.OneFileOnly && rows.length + files.length > 1) {
			return "Exactly one file is required for this upload.";
		}

		for (const file of files) {
			if (maxFileSizeMB && file.size / BYTES_IN_MB > maxFileSizeMB) {
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
		if (!files.length) {
			return;
		}

		const validationError = validateFiles(files);
		if (validationError) {
			setAlertState({ type: "danger", message: validationError });
			return;
		}

		setAlertState(null);

		if (!contextRecordId || !isPersistedRecord) {
			if (!recordNode?.id) {
				setAlertState({ type: "danger", message: "Save the record before uploading files." });
				return;
			}

			files.forEach((file) => {
				formState?.addUploadNode?.({
					parentNodeId: recordNode.id,
					entityName: contextEntityName,
					folderName: config.FolderName,
					file,
					uploadDate: formatUploadDate(new Date()),
					childRecordId: undefined,
				});
			});

			return;
		}

		setIsUploading(true);
		try {
			const responses = await Promise.allSettled(
				files.map((file) =>
					uploadDocumentForRecord({
						entityName: contextEntityName,
						recordId: contextRecordId,
						folderName: config.FolderName,
						file,
						uploadDate: formatUploadDate(new Date()),
						childId: uploadChildId,
					})
				)
			);
			if (responses.every((res) => res.status === "fulfilled")) {
				await new Promise((resolve) => setTimeout(resolve, AZURE_LATENCY_DELAY_MS));
				setAlertState({ type: "success", message: "File(s) uploaded successfully." });
			} else if (responses.some((res) => res.status === "rejected") && responses.some((res) => res.status === "fulfilled")) {
				await new Promise((resolve) => setTimeout(resolve, AZURE_LATENCY_DELAY_MS));
				setAlertState({ type: "warning", message: "One or more file(s) failed to upload. Please try again." });
			} else if (responses.every((res) => res.status === "rejected")) {
				setAlertState({ type: "danger", message: "All file(s) failed to upload. Please try again." });
			}

			setIsUploading(false);
			await loadDocuments();
		} catch (error) {
			console.error("File upload failed:", error);
			setAlertState({ type: "danger", message: "File upload failed due to an unexpected error. Please try again." });
		} finally {
			setIsUploading(false);
		}
	};

	const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const files = event.target.files ? (Array.from(event.target.files) as File[]) : [];
		event.target.value = "";
		void handleFilesSelected(files);
	};

	const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		event.stopPropagation();
		setIsDragActive(true);
	};

	const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		event.stopPropagation();
		setIsDragActive(true);
	};

	const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		event.stopPropagation();
		if (event.currentTarget.contains(event.relatedTarget as Node)) {
			return;
		}
		setIsDragActive(false);
	};

	const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		event.stopPropagation();
		setIsDragActive(false);
		const files = event.dataTransfer?.files ? (Array.from(event.dataTransfer.files) as File[]) : [];
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
			formState?.deleteNode?.(deleteTarget.id);
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
			console.error("File deletion failed:", error);
			setAlertState({ type: "danger", message: "Failed to delete file due to an unexpected error. Please try again." });
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
			setAlertState({ type: "danger", message: "Failed to download file due to an unexpected error. Please try again." });
		}
	};

	const handleGetSASUrl = async (fullName: string) => {
		if (!contextRecordId || !isPersistedRecord) {
			return;
		}

		try {
			const sasUrl = await getSASUrlForDocument(contextEntityName, contextRecordId, fullName);
			window.open(sasUrl, "_blank");
		} catch (error) {
			console.error("Failed to get SAS URL:", error);
			setAlertState({ type: "danger", message: "Failed to open file due to an unexpected error. Please try again." });
		}
	};

	const getActionsForRow = (row: any): DropdownMenuItem[] => {
		const actions: DropdownMenuItem[] = [];

		if (row.isPending) {
			actions.push({
				label: "Remove",
				onClick: () => handleDeleteRequest({ type: "pending", id: row.id, name: row.name }),
			});
		} else {
			actions.push(
				{
					label: "Download",
					onClick: () => handleDownload(row.fullName || ""),
				},
				{
					label: "View",
					onClick: () => handleGetSASUrl(row.fullName || ""),
				},
				{
					label: "Delete",
					onClick: () =>
						handleDeleteRequest({
							type: "persisted",
							fullName: row.fullName || "",
							name: row.name,
							restrictDelete: row.restrictDelete,
						}),
					disabled: row.restrictDelete || false,
				}
			);
		}

		return actions;
	};

	const busyMessage = isUploading ? "Uploading files..." : isDeleting ? "Deleting file..." : "Loading files...";
	const requiresDocumentUpload =
		config.ValidationType === DocumentValidationType.AtLeastOneFile || config.ValidationType === DocumentValidationType.OneFileOnly;
	const validationHint =
		config.ValidationType === DocumentValidationType.OneFileOnly
			? "Upload exactly one file."
			: config.ValidationType === DocumentValidationType.AtLeastOneFile
				? "Upload at least one file."
				: null;
	const rows = [
		...pendingUploads.map((upload) => ({
			key: `pending-${upload.id}`,
			name: (upload.data as any)?.file?.name ?? "Pending upload",
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
			{config.Description && (
				<h3 className="h3 file-upload-heading">
					<span dangerouslySetInnerHTML={{ __html: config.Description }} />
					{requiresDocumentUpload && <span className="required-indicator">*</span>}
				</h3>
			)}
			{alertState && (
				<Alert type={alertState.type} dismissible onDismiss={() => setAlertState(null)}>
					<p>{alertState.message}</p>
				</Alert>
			)}
			<div
				className={`form-field-file-upload-dropzone ${isDragActive ? "drag-active" : ""}`}
				onDragEnter={handleDragEnter}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onDrop={handleDrop}>
				<input
					ref={inputRef}
					className="file-upload-core"
					type="file"
					style={{ display: "none" }}
					accept={normalizedAllowedTypes ? normalizedAllowedTypes.join(",") : undefined}
					multiple={config.ValidationType !== DocumentValidationType.OneFileOnly}
					onChange={handleInputChange}
				/>
				<p className="drag-drop-instruction mb-2">Drag &amp; drop files here</p>
				<p className="drag-drop-help-text">or</p>
				<button type="button" className="btn btn-default" onClick={() => inputRef.current?.click()} disabled={isUploading}>
					Select File
				</button>
			</div>
			{rows.length > 0 && (
				<div className="file-upload-table contextual-loading-container mt-3" style={{ minHeight: "250px" }}>
					<LoadingIndicator visible={isLoading || isUploading || isDeleting} variant="contextual" message={busyMessage} />
					<table id="file-upload-table" aria-live="polite" role="grid" className="table table-custom table-header-bg table-border-bottom table-hover">
						<thead>
							<tr>
								<th scope="col" style={{ width: "100%" }}>
									File Name
								</th>
								<th scope="col" className="actions-menu">
									Actions
								</th>
							</tr>
						</thead>
						<tbody>
							{rows.length > 0 &&
								rows.map((row) => (
									<tr key={row.key}>
										<td>
											{row.isPending ? (
												<>
													<span style={{ fontStyle: "italic", opacity: 0.8 }}>{row.name}</span>
													<span className="ml-2">
														<Badge type="warning" content="Pending" />
													</span>
												</>
											) : (
												<span>{row.name}</span>
											)}
										</td>
										<td className="text-right">
											<DropdownMenu actions={getActionsForRow(row)} />
										</td>
									</tr>
								))}
						</tbody>
					</table>
				</div>
			)}
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
