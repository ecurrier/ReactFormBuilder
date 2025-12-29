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
					setIsFormConfigurationLoading(false);
					setRecordData(null); // No record data for new records
					setIsDebugData(false);
					return;
				}

				const formConfiguration = JSON.parse(formInstance.Version.FormContent);
				setConfig(formConfiguration);
				setIsFormConfigurationLoading(false);
				setFormSessionInfo((prev) => ({ ...prev, formInstanceId: formInstance.Id }));
				setUrlParams((prev) => ({
					...prev,
					versionId: prev?.versionId || formInstance.Version?.Id,
				}));

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
			} else if (versionId) {
				const version = await retrieveFormVersion(versionId);
				const formConfiguration = JSON.parse(version.FormContent);
				setConfig(formConfiguration);
				setRecordData(null); // No record data for new records
				setRecordDataByEntity({});
				setIsFormConfigurationLoading(false);
				setIsRecordDataLoading(false);
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
			setRecordDataByEntity({});
			setIsFormConfigurationLoading(false);
			setIsRecordDataLoading(false);
		} finally {
			setIsFormConfigurationLoading(false);
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
