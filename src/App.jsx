import React, { useCallback, useEffect, useState } from "react";
import formConfig from "./data/formConfigv3.json";
import FormBuilder from "./components/FormBuilder.jsx";

const App = () => {
	const [config, setConfig] = useState(null);
	const [recordData, setRecordData] = useState(null);
	const [urlParams, setUrlParams] = useState(null);
	const [isLoading, setIsLoading] = useState(true);
	const [errorMessage, setErrorMessage] = useState("");
	const [isDebugData, setIsDebugData] = useState(false);
	const env = import.meta.env ?? {};
	const isDebugMode = env.VITE_USE_DEBUG_CONFIG === "true" || env.DEV;

	const loadConfig = useCallback(async () => {
		setIsLoading(true);
		setErrorMessage("");

		try {
			/*
			if (isDebugMode) {
				setConfig(formConfig);
				setIsDebugData(true);
				// In debug mode, simulate URL params for testing
				setUrlParams({
					recordId: null,
					versionId: "debug-version-id",
					recordLogicalName: formConfig?.Form?.PrimaryApplicationTable?.TableLogicalName,
					parentRecordLogicalName: null,
					parentRecordFieldLogicalName: null,
					parentRecordId: null,
				});
				setRecordData(null);
				return;
			}
				*/

			// Extract URL parameters
			const searchParams = new URLSearchParams(window.location.search);
			const recordId = searchParams.get("recordId");
			const versionId = searchParams.get("versionId");
			const recordLogicalName = searchParams.get("recordLogicalName");
			const parentRecordLogicalName = searchParams.get("parentRecordLogicalName");
			const parentRecordFieldLogicalName = searchParams.get("parentRecordFieldLogicalName");
			const parentRecordId = searchParams.get("parentRecordId");

			setUrlParams({
				recordId,
				versionId,
				recordLogicalName,
				parentRecordLogicalName,
				parentRecordFieldLogicalName,
				parentRecordId,
			});

			// Dual loading path logic
			if (recordId && recordLogicalName) {
				// Path 1: Existing record - load record data and form config
				// TODO: Implement loadRecordWithForm() in dataLoader service
				// For now, just load the version directly if provided, or throw error
				/*
				if (!versionId) {
					throw new Error("versionId is required when recordId is provided (temporary limitation)");
				}
				*/

				// big to-do: Load form configuration from version
				// use recordId and recordLogicalName to load record data
				// execute fetch that will retrieve record along with the active version linked to it
				// do we retrieve all fields for the record, or just those in the form config?

				// created form instance query to get form instance and version in /queries
				// need to pass that record id and logicalname to load record with form instance and version

				// once we have the version form content, we can render the form

				// we also need to retrieve the record itself to populate the form fields

				if (!versionResponse.ok) {
					throw new Error(`Failed to load version: ${versionResponse.status}`);
				}

				const versionRecord = await versionResponse.json();
				if (!versionRecord.eyfrcc_formcontent) {
					throw new Error("Form content field is empty");
				}

				const formConfiguration = JSON.parse(versionRecord.eyfrcc_formcontent);
				setConfig(formConfiguration);
				
				// TODO: Load record data using dataLoader service
				// const data = await loadRecordData(recordLogicalName, recordId, formConfiguration);
				// setRecordData(data);
				setRecordData(null); // Placeholder until dataLoader is implemented
				
				setIsDebugData(false);
			} else if (versionId) {
				// Path 2: New record - load form config only
				const versionUrl = `${window.location.origin}/_api/eyfrcc_versions(${versionId})/?$select=eyfrcc_formcontent,eyfrcc_regardingid`;
				const versionResponse = await fetch(versionUrl, {
					method: "GET",
					headers: {
						Accept: "application/json",
						"Content-Type": "application/json",
						"OData-MaxVersion": "4.0",
						"OData-Version": "4.0",
					},
				});

				if (!versionResponse.ok) {
					throw new Error(`Failed to load version: ${versionResponse.status}`);
				}

				const versionRecord = await versionResponse.json();
				if (!versionRecord.eyfrcc_formcontent) {
					throw new Error("Form content field is empty");
				}

				const formConfiguration = JSON.parse(versionRecord.eyfrcc_formcontent);
				setConfig(formConfiguration);
				setRecordData(null); // No record data for new records
				setIsDebugData(false);
			} else {
				throw new Error("Either versionId (for new records) or both recordId and recordLogicalName (for existing records) must be provided");
			}
		} catch (error) {
			console.error("Failed to load form configuration", error);
			setErrorMessage(`Unable to load the form configuration: ${error.message}. Showing debug data instead.`);
			setConfig(formConfig);
			setIsDebugData(true);
			setUrlParams({
				recordId: null,
				versionId: "debug-version-id",
				recordLogicalName: formConfig?.Form?.PrimaryApplicationTable?.TableLogicalName,
				parentRecordLogicalName: null,
				parentRecordFieldLogicalName: null,
				parentRecordId: null,
			});
			setRecordData(null);
		} finally {
			setIsLoading(false);
		}
	}, [isDebugMode]);

	useEffect(() => {
		loadConfig();
	}, [loadConfig]);

	return (
		<div className="app-shell">
			<main className="site-main">
				<div className="app">
					{isLoading || !config ? (
						<div className="form-loader" role="status">
							<span className="loader-spinner" aria-hidden="true" />
							Loading form configuration...
						</div>
					) : (
						<>
							{errorMessage ? (
								<div className="form-alert" role="alert">
									<div>
										<strong>Connection issue</strong>
										<p>{errorMessage}</p>
									</div>
									{!isDebugMode ? (
										<button type="button" className="retry-button" onClick={loadConfig}>
											Try again
										</button>
									) : null}
								</div>
							) : null}
							{isDebugData ? <span className="debug-badge">Debug data</span> : null}
							<FormBuilder 
								config={config} 
								recordData={recordData}
								urlParams={urlParams}
							/>
						</>
					)}
				</div>
			</main>
		</div>
	);
};

export default App;
