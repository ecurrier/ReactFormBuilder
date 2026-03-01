import React, { useCallback, useEffect, useState } from "react";
import formConfig from "@/testing/formConfigs/formConfigv1.json";
import { Alert, ConfirmationModal, FormBuilder, FormConfigSkeleton, LoadingIndicator } from "@components";
import {
	loadRecordData,
	resolveFormVersion,
	resolveFormVersionFromExistingVersion,
	retrieveOrCreateFormInstanceForLatestVersion,
	retrieveFormInstance,
	retrieveUserFormSessions,
	createUserFormSession,
} from "@services";
import {
	isPowerPlatformFormBuild,
	isPowerPlatformVersionBuild,
	resolveEmbeddedRecordId,
	resolveEmbeddedRecordLogicalName,
	resolveEmbeddedVersionFormContent,
	resolveEmbeddedVersionId,
	resolveRequestorId,
} from "@utilities";

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
	const [modalState, setModalState] = useState<ConfirmationModalState>({
		isOpen: false,
		title: "",
		message: "",
		confirmText: "Yes",
		cancelText: "No",
		onConfirm: () => {},
		onCancel: () => {},
	});

	const parseUrlParams = () => {
		const searchParams = new URLSearchParams(window.location.search);
		const recordId = searchParams.get("recordId");
		const versionId = searchParams.get("versionId");
		const recordLogicalName = searchParams.get("recordLogicalName");
		const parentRecordLogicalName = searchParams.get("parentRecordLogicalName");
		const parentRecordFieldLogicalName = searchParams.get("parentRecordFieldLogicalName");
		const parentRecordId = searchParams.get("parentRecordId");
		const isDebugMode = searchParams.has("debug");

		return {
			recordId,
			versionId,
			recordLogicalName,
			parentRecordLogicalName,
			parentRecordFieldLogicalName,
			parentRecordId,
			isDebugMode,
		};
	};

	const resetStateForNewLoad = () => {
		setIsFormConfigurationLoading(true);
		setErrorMessage("");
		setRecordDataByEntity({});
		setFormSessionInfo({ formInstanceId: null, userFormSessionId: null });
	};

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

	const handleDebugMode = () => {
		setConfig(formConfig);
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
	};

	const resolveNewRecordConfig = async (versionId: string) => {
		let version = await resolveFormVersion(versionId);
		if (!version) {
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
				throw new Error(`Form version with ID ${versionId} not found`);
			}
		}

		return version.FormContent;
	};

	const getFormInstanceForRecord = async (recordId: string, recordLogicalName: string, versionId?: string) => {
		if (versionId) {
			let formInstance = await retrieveFormInstance(recordId, recordLogicalName, versionId);
			if (!formInstance) {
				const useLatestVersion = await showConfirmation(
					"Form Instance Not Found",
					"A form instance for the specified record and version could not be found. Would you like to start a new form for the latest version instead?",
					"Use Latest",
					"Cancel"
				);

				if (useLatestVersion) {
					formInstance = await retrieveOrCreateFormInstanceForLatestVersion(recordId, recordLogicalName, versionId);
					if (!formInstance) {
						throw new Error("No active form versions found");
					}
				} else {
					throw new Error(`Form version with ID ${versionId} not found`);
				}
			}

			return formInstance;
		}

		const formInstance = await retrieveOrCreateFormInstanceForLatestVersion(recordId, recordLogicalName);
		if (!formInstance) {
			throw new Error("No active form versions found");
		}

		return formInstance;
	};

	const loadRecordDataForInstance = async (formInstance, recordId: string, recordLogicalName: string, formConfiguration) => {
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

		return { primaryData, secondaryDataMap };
	};

	const ensureUserFormSession = async (formInstanceId: string) => {
		try {
			const sessions = await retrieveUserFormSessions(formInstanceId);
			if (!sessions) {
				return;
			}

			const requestorId = resolveRequestorId();
			const matchingSession = requestorId ? sessions.find((session) => session.ContactId === requestorId) : null;
			if (matchingSession) {
				setFormSessionInfo((prev) => ({ ...prev, userFormSessionId: matchingSession.Id }));
				return;
			}

			if (!requestorId) {
				return;
			}

			const sessionId = await createUserFormSession({
				formInstanceId,
				contactId: requestorId,
				lastActive: new Date(),
			});
			setFormSessionInfo((prev) => ({ ...prev, userFormSessionId: sessionId }));
		} catch (error) {
			console.warn("Failed to load user form sessions", error);
		}
	};

	const loadEmbeddedPowerPlatformConfig = () => {
		const rawFormContent = resolveEmbeddedVersionFormContent();
		if (!rawFormContent || typeof rawFormContent !== "string") {
			throw new Error("Unable to read eyfrcc_formcontent from the parent Power Platform form.");
		}

		try {
			return JSON.parse(rawFormContent);
		} catch (error) {
			console.error("Failed to parse eyfrcc_formcontent", error);
			throw new Error("The eyfrcc_formcontent field does not contain valid JSON.");
		}
	};

	const toErrorMessage = (error: unknown) => {
		if (error instanceof Error) {
			return error.message;
		}

		if (typeof error === "string") {
			return error;
		}

		return "Unknown error";
	};

	const setEmbeddedUrlParams = (params: { recordId: string | null; versionId: string | null; recordLogicalName: string | null }) => {
		setUrlParams({
			recordId: params.recordId,
			versionId: params.versionId,
			recordLogicalName: params.recordLogicalName,
			parentRecordLogicalName: null,
			parentRecordFieldLogicalName: null,
			parentRecordId: null,
		});
	};

	const applyNewRecordState = (formConfiguration) => {
		setConfig(formConfiguration);
		setRecordData(null);
		setRecordDataByEntity({});
		setIsFormConfigurationLoading(false);
		setIsRecordDataLoading(false);
	};

	const applyExistingRecordState = async (formInstance, recordId: string, recordLogicalName: string, persistVersionIdToUrl = true) => {
		const formConfiguration = formInstance.Version.FormContent;

		setConfig(formConfiguration);
		setIsFormConfigurationLoading(false);
		setFormSessionInfo((prev) => ({ ...prev, formInstanceId: formInstance.Id }));

		if (persistVersionIdToUrl) {
			setUrlParams((prev) => ({
				...prev,
				versionId: formInstance.Version.Id,
			}));
		}

		const { primaryData, secondaryDataMap } = await loadRecordDataForInstance(formInstance, recordId, recordLogicalName, formConfiguration);
		setRecordData(primaryData);
		setRecordDataByEntity(secondaryDataMap);
		setIsRecordDataLoading(false);

		await ensureUserFormSession(formInstance.Id);
	};

	const loadPowerPlatformVersionMode = async () => {
		const embeddedVersionId = resolveEmbeddedVersionId();
		const formConfiguration = loadEmbeddedPowerPlatformConfig();

		setConfig(formConfiguration);
		setRecordData(null);
		setRecordDataByEntity({});
		setEmbeddedUrlParams({
			recordId: null,
			versionId: embeddedVersionId,
			recordLogicalName: null,
		});
		setIsFormConfigurationLoading(false);
		setIsRecordDataLoading(false);
	};

	const loadPowerPlatformFormMode = async () => {
		const embeddedRecordId = resolveEmbeddedRecordId();
		const embeddedRecordLogicalName = resolveEmbeddedRecordLogicalName();
		if (!embeddedRecordLogicalName) {
			throw new Error("Unable to resolve record logical name from the parent Power Platform form.");
		}

		// TO-DO: Currently only support existing records, need to add support for create
		if (!embeddedRecordId) {
			throw new Error("Unable to resolve record id from the parent Power Platform form.");
		}

		const formInstance = await getFormInstanceForRecord(embeddedRecordId, embeddedRecordLogicalName);
		if (!formInstance) {
			throw new Error("No active form versions found");
		}

		setEmbeddedUrlParams({
			recordId: embeddedRecordId,
			versionId: formInstance.Version.Id,
			recordLogicalName: embeddedRecordLogicalName,
		});

		await applyExistingRecordState(formInstance, embeddedRecordId, embeddedRecordLogicalName, false);
	};

	const loadPowerPagesStandardMode = async () => {
		const { recordId, versionId, recordLogicalName, parentRecordLogicalName, parentRecordFieldLogicalName, parentRecordId, isDebugMode } = parseUrlParams();

		setUrlParams({
			recordId,
			versionId,
			recordLogicalName,
			parentRecordLogicalName,
			parentRecordFieldLogicalName,
			parentRecordId,
		});

		if (isDebugMode) {
			handleDebugMode();
			return;
		}

		if (!recordId && !versionId) {
			throw new Error("Either recordId or versionId must be provided in the URL parameters");
		}

		if (!recordId && versionId) {
			const formConfiguration = await resolveNewRecordConfig(versionId);
			applyNewRecordState(formConfiguration);
			return;
		}

		if (recordId && recordLogicalName) {
			const formInstance = await getFormInstanceForRecord(recordId, recordLogicalName, versionId ?? undefined);
			await applyExistingRecordState(formInstance, recordId, recordLogicalName);
			return;
		}

		throw new Error("Either versionId (for new records) or both recordId and recordLogicalName (for existing records) must be provided");
	};

	const loadConfig = useCallback(async () => {
		resetStateForNewLoad();

		try {
			if (isPowerPlatformVersionBuild()) {
				await loadPowerPlatformVersionMode();
				return;
			} else if (isPowerPlatformFormBuild()) {
				await loadPowerPlatformFormMode();
				return;
			}

			await loadPowerPagesStandardMode();
		} catch (error) {
			console.error("Failed to load form configuration", error);
			setErrorMessage(`Unable to load the form configuration: ${toErrorMessage(error)}`);
			setIsFormConfigurationLoading(false);
			setIsRecordDataLoading(false);
		}
	}, []);

	useEffect(() => {
		loadConfig();
	}, [loadConfig]);

	const showInitialSkeleton = isFormConfigurationLoading && !config;
	const showRecordLoading = isRecordDataLoading && !!config;
	const loadingMessage = showRecordLoading ? "Loading data..." : showInitialSkeleton ? "Loading form..." : "";

	return (
		<main className="page-content">
			{showInitialSkeleton ? <FormConfigSkeleton /> : null}
			{config ? (
				<>
					<FormBuilder
						config={config}
						recordData={recordData}
						recordDataByEntity={recordDataByEntity}
						formSessionInfo={formSessionInfo}
						urlParams={urlParams}
						onUrlParamsChange={setUrlParams}
					/>
				</>
			) : null}
			{errorMessage ? (
				<Alert type="danger" dismissible onDismiss={() => setErrorMessage("")}>
					{errorMessage}
				</Alert>
			) : null}
			<LoadingIndicator visible={showRecordLoading || showInitialSkeleton} variant="full-screen" message={loadingMessage} />
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
