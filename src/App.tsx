import React, { useCallback, useEffect, useState } from "react";
import formConfig from "@/data/formConfigv5.json";
import FormBuilder from "@components/form/FormBuilder";
import { ConfirmationModal } from "@components/common/ConfirmationModal";
import LoadingIndicator from "@components/common/LoadingIndicator";
import { loadRecordData } from "@services/dataLoader";
import {
	resolveFormVersion,
	resolveFormVersionFromExistingVersion,
	retrieveOrCreateFormInstanceForLatestVersion,
	retrieveFormInstance,
	retrieveUserFormSessions,
	createUserFormSession,
} from "@services/formInstanceManagement";
import { resolveRequestorId } from "@utilities/session";

interface ConfirmationModalState {
	isOpen: boolean;
	title: string;
	message: string;
	confirmText?: string;
	cancelText?: string;
	onConfirm: () => void;
	onCancel: () => void;
}

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
	const [modalState, setModalState] = useState<ConfirmationModalState>({
		isOpen: false,
		title: "",
		message: "",
		confirmText: "Yes",
		cancelText: "No",
		onConfirm: () => {},
		onCancel: () => {},
	});

	const env = import.meta.env ?? {};
	const isDebugMode = env.VITE_USE_DEBUG_CONFIG === "true" || env.DEV;

	const showConfirmation = (title: string, message: string, confirmText = "Yes", cancelText = "No") => {
		return new Promise((resolve) => {
			setModalState({
				isOpen: true,
				title,
				message,
				confirmText,
				cancelText,
				onConfirm: () => {
					setModalState((prev) => ({ ...prev, isOpen: false }));
					resolve(true);
				},
				onCancel: () => {
					setModalState((prev) => ({ ...prev, isOpen: false }));
					resolve(false);
				},
			});
		});
	};

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

			// scenario 0: neither recordId nor versionId provided - error/warning
			if (!recordId && !versionId) {
				throw new Error("Either recordId or versionId must be provided in the URL parameters");
			}

			// SCENARIO 1: New record (no recordId)
			if (!recordId && versionId) {
				let version = await resolveFormVersion(versionId);
				if (!version) {
					throw new Error(`Form version with ID ${versionId} not found`);
							const useLatestVersion = await showConfirmation(
								"Form Version Not Found",
								`The specified form version (ID: ${versionId}) could not be found. Would you like to use the latest version instead?`,
								"Use Latest",
								"Cancel"
							);

					if (useLatestVersion) {
						version = await resolveFormVersionFromExistingVersion(versionId);
						if (!version) {
							throw new Error("No active form versions found");
						}
					} else {
						setErrorMessage(`Form version with ID ${versionId} not found`);
						setIsFormConfigurationLoading(false);
						setIsRecordDataLoading(false);
						return;
					}
				}

				setConfig(version.FormContent);
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
						const useLatestVersion = await showConfirmation(
							"Form Instance Not Found",
							`A form instance for the specified record and version could not be found. Would you like to start a new form for the latest version instead?`,
							"Use Latest",
							"Cancel"
						);

						if (useLatestVersion) {
							formInstance = await retrieveOrCreateFormInstanceForLatestVersion(recordId, recordLogicalName, versionId);
							if (!formInstance) {
								throw new Error("No active form versions found");
							}
						} else {
							setErrorMessage(`Form version with ID ${versionId} not found`);
							setIsFormConfigurationLoading(false);
							setIsRecordDataLoading(false);
						}

						return;
					}
				} else {
					// CASE B: No versionId - get/create formInstance for latest active version
					formInstance = await retrieveOrCreateFormInstanceForLatestVersion(recordId, recordLogicalName);
					if (!formInstance) {
						throw new Error("No active form versions found");
					}
				}

				// At this point, formInstance is guaranteed to exist
				const formConfiguration = formInstance.Version.FormContent;
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
					.then(async (sessions) => {
						if (!sessions) {
							return;
						}

						const requestorId = resolveRequestorId();

						const matchingSession = requestorId ? sessions.find((session) => session.ContactId === requestorId) : null;
						if (matchingSession) {
							setFormSessionInfo((prev) => ({ ...prev, userFormSessionId: matchingSession.Id }));
						} else {
							const sessionId = await createUserFormSession({
								formInstanceId: formInstance.Id,
								contactId: requestorId,
								lastActive: new Date(),
							});
							setFormSessionInfo((prev) => ({ ...prev, userFormSessionId: sessionId }));
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
			if (isDebugMode) {
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
			} else {
				// TO-DO: Handle this better in the UI
				setErrorMessage(`Unable to load the form configuration: ${error.message}`);
			}
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
			<ConfirmationModal
				isOpen={modalState.isOpen}
				title={modalState.title}
				message={modalState.message}
				confirmText={modalState.confirmText}
				cancelText={modalState.cancelText}
				onConfirm={modalState.onConfirm}
				onCancel={modalState.onCancel}
			/>
		</main>
	);
};

export default App;
