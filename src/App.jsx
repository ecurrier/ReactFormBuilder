import React, { useCallback, useEffect, useState } from "react";
import formConfig from "./data/formConfigv5.json";
import FormBuilder from "./components/FormBuilder.jsx";
import { retrieveFormInstance, retrieveFormVersion, retrieveUserFormSessions } from "./queries/version";
import { loadRecordData } from "./services/dataLoader";
import { resolveRequestorId } from "./utilities/session";
import LoadingIndicator from "@components/LoadingIndicator";

const App = () => {
	const [config, setConfig] = useState(null);
	const [recordData, setRecordData] = useState(null);
	const [recordDataByEntity, setRecordDataByEntity] = useState({});
	const [urlParams, setUrlParams] = useState(null);
	const [formSessionInfo, setFormSessionInfo] = useState({ formInstanceId: null, userFormSessionId: null });
	const [isFormConfigurationLoading, setIsFormConfigurationLoading] = useState(true);
	const [isRecordDataLoading, setIsRecordDataLoading] = useState(true);
	const [errorMessage, setErrorMessage] = useState("");
	const [isDebugData, setIsDebugData] = useState(false);
	const env = import.meta.env ?? {};
	const isDebugMode = env.VITE_USE_DEBUG_CONFIG === "true" || env.DEV;

	const loadConfig = useCallback(async () => {
		setIsFormConfigurationLoading(true);
		setErrorMessage("");
		setRecordDataByEntity({});
		setFormSessionInfo({ formInstanceId: null, userFormSessionId: null });

		try {
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

			// SCENARIO 1: New record (no recordId)
			if (!recordId && versionId) {
				const version = await retrieveFormVersion(versionId);
				const formConfiguration = JSON.parse(version.FormContent);
				setConfig(formConfiguration);
				setRecordData(null);
				setRecordDataByEntity({});
				setIsFormConfigurationLoading(false);
				setIsRecordDataLoading(false);
				setIsDebugData(false);
				return;
			}

			// SCENARIO 2 & 3: Existing record
			if (recordId && recordLogicalName) {
				let formInstance;

				// Determine which version to use
				if (versionId) {
					// CASE A: User explicitly wants a specific version
					formInstance = await retrieveFormInstance(recordId, recordLogicalName, versionId);
					if (!formInstance) {
						// this should be a hard error case for now... this means that the user is trying
						// to access a specific version of a record that doesnt exist
						// we should provide a message and not attempt to load any data
						// in the future we can prompt them to start a new form for the latest version instead.
						// if no, then do nothing except a message
						// if yes, then create a new form instance for the latest version and use that
						return;
					}
				} else {
					// CASE B: No versionId - get/create formInstance for latest active version

					// This will either return existing formInstance for latest version
					// or create a new one (copying secondary records from old version if it exists)
					formInstance = await retrieveOrCreateFormInstanceForLatestVersion(recordId, recordLogicalName);
					// if this is null, then this should be a hard error case... unable to load or create form instance
					// this means that we were unable to generate or find a form instance for the latest version
					// which indicates a deeper issue (no active versions?) Which means we should not proceed
					// we should prompt the user to start a new form for the latest version instead.
					// if no, then do nothing except a message
					// if yes, then create a new form instance for the latest version and use that
				}

				// At this point, formInstance is guaranteed to exist
				const formConfiguration = JSON.parse(formInstance.Version.FormContent);
				setConfig(formConfiguration);
				setIsFormConfigurationLoading(false);
				setFormSessionInfo((prev) => ({ ...prev, formInstanceId: formInstance.Id }));
				setUrlParams((prev) => ({
					...prev,
					versionId: formInstance.Version.Id,
				}));

				// Load primary + secondary data
				setIsRecordDataLoading(true);
				const primaryDataPromise = loadRecordData(recordLogicalName, recordId, formConfiguration);
				const secondaryRecords = Array.isArray(formInstance.SecondaryRecords) ? formInstance.SecondaryRecords : [];
				const secondaryPromises = secondaryRecords.map((record) =>
					loadRecordData(record.LogicalName, record.Id, formConfiguration).then((data) => ({
						entityName: record.LogicalName,
						recordId: record.Id,
						data,
					}))
				);

				const primaryData = await primaryDataPromise;
				const secondaryResults = await Promise.allSettled(secondaryPromises);
				const secondaryDataMap = {};

				secondaryResults.forEach((result) => {
					if (result.status === "fulfilled" && result.value?.data) {
						secondaryDataMap[result.value.entityName] = result.value.data;
					} else if (result.status === "rejected") {
						console.warn("Failed to load secondary record data", result.reason);
					}
				});

				setRecordData(primaryData);
				setRecordDataByEntity(secondaryDataMap);
				setIsRecordDataLoading(false);
				setIsDebugData(false);

				// Load user form sessions
				retrieveUserFormSessions(formInstance.Id)
					.then((sessions) => {
						if (!Array.isArray(sessions) || sessions.length === 0) {
							return;
						}

						const requestorId = resolveRequestorId();
						const matchingSession = requestorId ? sessions.find((session) => session.ContactId === requestorId) : sessions[0];

						if (matchingSession) {
							setFormSessionInfo((prev) => ({ ...prev, userFormSessionId: matchingSession.Id }));
						}
					})
					.catch((error) => {
						console.warn("Failed to load user form sessions", error);
					});

				return;
			}

			throw new Error("Either versionId (for new records) or both recordId and recordLogicalName (for existing records) must be provided");
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
			setRecordDataByEntity({});
			setIsFormConfigurationLoading(false);
			setIsRecordDataLoading(false);
		}
	}, [isDebugMode]);

	useEffect(() => {
		loadConfig();
	}, [loadConfig]);

	const isLoading = isFormConfigurationLoading || isRecordDataLoading;
	const loadingMessage = isFormConfigurationLoading ? "Loading form configuration..." : isRecordDataLoading ? "Loading record data..." : "";

	return (
		<main className="page-content">
			{config ? (
				<>
					<FormBuilder
						config={config}
						recordData={recordData}
						recordDataByEntity={recordDataByEntity}
						formSessionInfo={formSessionInfo}
						urlParams={urlParams}
					/>
				</>
			) : null}
			<LoadingIndicator visible={isLoading} variant="full-screen" message={loadingMessage} />
		</main>
	);
};

export default App;
