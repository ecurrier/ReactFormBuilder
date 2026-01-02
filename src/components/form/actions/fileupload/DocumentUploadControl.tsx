import React from "react";
import { Alert } from "@components";
import { retrieveEygaConfiguration } from "@utilities";

/*
    Implementation plan:

    1. Document Uploads require a Document Path to work
        Document Path is available on App/Secondary Report/Award at the moment
        This can be retrieved via the table metadata under "ConfigurationIdentifierMetadata" via FieldLogicalName
        We need to use this to retrieve the document path value
        once we know theres a value, we can render the document upload control and allow uploads
    2. The control should allow upload multiple documents
    3. The control should show existing documents in a table view with options to download or delete
    4. The control will retrieve from eyga configuration to determine: (consider building an eyga config service/cache)
        - documents endpoint
        - allowed file types
        - max file size
    5. Control should be useable even when parent is not persisted yet. Need to stage uploads like we do with table entries
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
