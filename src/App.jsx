import React, { useCallback, useEffect, useState } from "react";
import formConfig from "./data/formConfigv5.json";
import FormBuilder from "./components/FormBuilder.jsx";
import { retrieveFormInstance, retrieveFormVersion, retrieveUserFormSessions } from "./queries/version";
import { loadRecordData } from "./services/dataLoader";

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

			if (recordId && recordLogicalName) {
				const formInstance = await retrieveFormInstance(recordId, recordLogicalName, versionId);
				if (!formInstance && versionId) {
					const version = await retrieveFormVersion(versionId);
					const formConfiguration = JSON.parse(version.FormContent);
					setConfig(formConfiguration);
					setRecordData(null); // No record data for new records
					setIsDebugData(false);
					return;
				}

				// check secondaryRecords field for any linked records and load them as well
				if (formInstance.SecondaryRecords && formInstance.SecondaryRecords.length > 0) {
					// TO-DO: Retrieve each secondary record data - in parallel if possible
				}

				// retrieve user form session for the current user
				// TO-DO: not tracking current step info anymore, so this can be loaded asynchronously
				var userFormSessions = await retrieveUserFormSessions(formInstance.Id);

				const formConfiguration = JSON.parse(formInstance.Version.FormContent);
				setConfig(formConfiguration);

				// TODO: Load record data using dataLoader service
				// Load secondary record data within this method as well
				const data = await loadRecordData(recordLogicalName, recordId, formConfiguration);

				// setRecordData(data);
				setRecordData(null); // Placeholder until dataLoader is implemented

				setIsDebugData(false);
			} else if (versionId) {
				const version = await retrieveFormVersion(versionId);
				const formConfiguration = JSON.parse(version.FormContent);
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
				versionId: null,
				recordLogicalName: null,
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
							<FormBuilder config={config} recordData={recordData} urlParams={urlParams} />
						</>
					)}
				</div>
			</main>
		</div>
	);
};

export default App;
