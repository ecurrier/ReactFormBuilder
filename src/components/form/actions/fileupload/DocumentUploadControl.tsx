import React from "react";
import { Alert } from "@components";
import { retrieveEygaConfiguration } from "@utilities";

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
}

interface DocumentUploadControlConfig {
	FolderName: string;
	Description?: string;
	ValidationType?: number;
	ValidationMessage?: string;
}

export const DocumentUploadControl: React.FC<DocumentUploadControlProps> = ({ config }) => {
	const [allowedFileTypes, setAllowedFileTypes] = React.useState<string[] | null>(null);
	const [maxFileSizeMB, setMaxFileSizeMB] = React.useState<number | null>(null);

	React.useEffect(() => {
		const fetchConfiguration = async () => {
			try {
				// Placeholder for fetching configuration logic
				const eygaConfiguration = await retrieveEygaConfiguration();
				setAllowedFileTypes(eygaConfiguration.AllowedFileTypes.map((fileType) => fileType.Extensions).flat());
				setMaxFileSizeMB(eygaConfiguration.MaxFileSizeMB);

				// Retrieve Document Path? Or do i do that at the time of upload?
				// probably better at the time of upload to ensure the parent record is created
			} catch (error) {
				console.error("Failed to fetch document upload configuration:", error);
			}
		};

		fetchConfiguration();
	}, []);

	return (
		<>
			<h3 className="h3">{config.Description}</h3>
			<div className="form-field-file-upload">
				<input
					className="file-upload-core"
					type="file"
					style={{ display: "none" }}
					accept={allowedFileTypes ? allowedFileTypes.join(",") : undefined}
				/>
				<button type="button" className="btn btn-default" aria-required="true">
					Choose File
				</button>
			</div>
			<div className="file-upload-table mt-3">
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
						<tr></tr>
					</thead>
					<tbody></tbody>
				</table>
			</div>
		</>
	);
};

export default DocumentUploadControl;
