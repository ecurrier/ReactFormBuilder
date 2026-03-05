import React, { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

const DevConsole = import.meta.env.DEV ? React.lazy(() => import("@testing/devtools/DevConsole")) : null;
import { Step, LoadingIndicator, ProgressBar } from "@components";
import { ActionType } from "@constants/enums";
import { useFormState, FormStateContext } from "@hooks";
import {
	populateFieldsFromData,
	executeSave,
	reloadFormData,
	applyConditions,
	createValidationSelectors,
	validateApplication,
	validateFieldRules,
	type ValidationIssue,
} from "@services";
import { buildEntityMetadataMap, resolvePrimaryIdAttribute, setEntityMetadataCache, downloadSaveErrorLog } from "@utilities";
import type { FormStateTreeNode, UploadNodeData, ReactFormConfiguration, SaveError, SaveProgressEvent } from "@app-types";

type FormBuilderProps = {
	config: ReactFormConfiguration;
	recordData?: Record<string, any>;
	recordDataByEntity?: Record<string, Record<string, any>>;
	formSessionInfo?: { formInstanceId?: string | null; userFormSessionId?: string | null };
	urlParams?: {
		recordId?: string;
		versionId?: string;
		recordLogicalName?: string;
		parentRecordLogicalName?: string;
		parentRecordFieldLogicalName?: string;
		parentRecordId?: string;
		formId?: string;
	};
	onUrlParamsChange?: (params: any) => void;
};

const FormBuilder = ({ config, recordData, recordDataByEntity, formSessionInfo, urlParams, onUrlParamsChange }: FormBuilderProps) => {
	const orderedSteps = useMemo(() => {
		if (!Array.isArray(config?.Form?.Steps)) {
			return [];
		}

		return [...config.Form.Steps].sort((a, b) => (a.Order ?? 0) - (b.Order ?? 0));
	}, [config]);

	const [activeStepIndex, setActiveStepIndex] = useState(0);
	// Track which steps have been visited for lazy loading
	const [visitedSteps, setVisitedSteps] = useState(new Set([0]));
	const [isSaving, setIsSaving] = useState(false);
	const [isValidating, setIsValidating] = useState(false);
	const [hasValidated, setHasValidated] = useState(false);
	const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
	const [saveProgress, setSaveProgress] = useState<SaveProgressEvent[]>([]);
	const [saveErrors, setSaveErrors] = useState<SaveError[]>([]);
	const [savePhase, setSavePhase] = useState("idle");
	const [showSaveOverlay, setShowSaveOverlay] = useState(false);
	const [capturedSaveTree, setCapturedSaveTree] = useState<FormStateTreeNode | null>(null);
	const [isBannerSticky, setIsBannerSticky] = useState(false);
	const [metadataReady, setMetadataReady] = useState(false);
	const bannerSentinelRef = useRef(null);
	const entityMetadata = useMemo(() => buildEntityMetadataMap(config), [config]);

	// Get primary entity and record ID from URL params
	const primaryEntity = config?.Form?.PrimaryApplicationTable?.TableLogicalName;
	const primaryRecordId = urlParams?.recordId || null;

	// Initialize form state with primary entity and record ID
	const formState = useFormState(primaryEntity, primaryRecordId);

	const conditionRuntime = useMemo(() => {
		if (!orderedSteps.length) {
			return { steps: [], fieldUpdates: [] as Array<{ path: string; value: any }> };
		}

		return applyConditions(orderedSteps, {
			getFieldValue: (path: string) => formState.getFieldValue(path),
		});
	}, [formState.dirtyFields, formState.getFieldValue, orderedSteps]);

	useEffect(() => {
		conditionRuntime.fieldUpdates.forEach(({ path, value }) => {
			if (formState.getFieldValue(path) !== value) {
				formState.updateFieldValue(path, value);
			}
		});
	}, [conditionRuntime.fieldUpdates, formState.getFieldValue, formState.updateFieldValue]);

	const conditionedSteps = conditionRuntime.steps;

	const runtimeConfig = useMemo(() => {
		if (!config?.Form) {
			return config;
		}

		return {
			...config,
			Form: {
				...config.Form,
				Steps: conditionedSteps,
			},
		};
	}, [conditionedSteps, config]);

	const validationSelectors = React.useMemo(() => createValidationSelectors(validationIssues), [validationIssues]);

	const focusValidationIssue = React.useCallback((issue: { fieldId?: string; anchorId?: string } | undefined) => {
		if (!issue) {
			return;
		}

		const fieldAnchor = issue.fieldId
			? `field-${issue.fieldId
					.split(".")
					.slice(-1)[0]
					.replace(/[^a-zA-Z0-9_-]/g, "-")}`
			: undefined;
		const targetId = fieldAnchor || issue.anchorId;
		if (!targetId) {
			return;
		}
		const target = document.getElementById(targetId);
		if (!target) {
			return;
		}
		target.scrollIntoView({ behavior: "smooth", block: "center" });
		const focusable = target.querySelector<HTMLElement>("input,select,textarea,button,[tabindex]") || (target as HTMLElement);
		focusable?.focus?.();
	}, []);

	const clearIssuesForField = React.useCallback((fieldId: string) => {
		setValidationIssues((prev) => prev.filter((issue) => issue.fieldId !== fieldId));
	}, []);

	const validateTableEntryForm = React.useCallback((args: { actions: any[]; entityName?: string; values: Record<string, any> }) => {
		const virtualState = {
			primaryEntityName: args.entityName || "",
			getFieldValue: (path: string) => args.values?.[path.split(".").pop() || path],
		};
		const virtualStep = { Id: "table-entry", Name: "table-entry", EntityLogicalName: args.entityName, Actions: args.actions };
		const issues = validateFieldRules({ steps: [virtualStep], formState: virtualState });
		return issues.filter((issue) => issue.severity === "error").map((issue) => ({ message: issue.message }));
	}, []);

	const visibleSteps = useMemo(
		() =>
			conditionedSteps.filter((step) =>
				step.Actions?.some((action) =>
					[ActionType.FieldInput, ActionType.TableEntry, ActionType.FileUpload, ActionType.QuickView].includes(action.Type)
				)
			),
		[conditionedSteps]
	);

	// Load record data into form state when recordData is provided
	useEffect(() => {
		if (recordData && primaryEntity) {
			const fieldData = populateFieldsFromData(recordData, primaryEntity, config);
			formState.initializeFormData(fieldData);
		}
	}, [recordData, primaryEntity, formState.initializeFormData]);

	useEffect(() => {
		if (!recordDataByEntity) {
			return;
		}

		Object.entries(recordDataByEntity).forEach(([entityName, data]) => {
			if (!data) {
				return;
			}

			const entityData = data as Record<string, any>;
			const fieldData = populateFieldsFromData(entityData, entityName, config);
			formState.initializeFormData(fieldData);

			const primaryIdAttribute = resolvePrimaryIdAttribute(entityName);
			const relatedRecordId = entityData.id || entityData[primaryIdAttribute];
			if (relatedRecordId) {
				formState.setRelatedRecord(entityName, relatedRecordId);
			}
		});
	}, [recordDataByEntity, config, formState.initializeFormData, formState.setRelatedRecord]);

	useEffect(() => {
		if (formSessionInfo?.formInstanceId) {
			formState.setFormInstanceId(formSessionInfo.formInstanceId);
		}

		if (formSessionInfo?.userFormSessionId) {
			formState.setUserFormSessionId(formSessionInfo.userFormSessionId);
		}
	}, [formSessionInfo, formState.setFormInstanceId, formState.setUserFormSessionId]);

	useLayoutEffect(() => {
		setEntityMetadataCache(entityMetadata);
		setMetadataReady(true);
	}, [entityMetadata]);

	useEffect(() => {
		setActiveStepIndex(0);
		setVisitedSteps(new Set([0]));
	}, [visibleSteps.length]);

	useEffect(() => {
		const sentinel = bannerSentinelRef.current;
		if (!sentinel || typeof IntersectionObserver === "undefined") {
			return;
		}

		const observer = new IntersectionObserver(
			([entry]) => {
				setIsBannerSticky(!entry.isIntersecting);
			},
			{ threshold: 0 }
		);

		observer.observe(sentinel);
		return () => observer.disconnect();
	}, []);

	const buildProgressId = (scope: string, entityName: string, recordId?: string) => {
		if (recordId) {
			return `${scope}:${entityName}:${recordId}`;
		}

		return `${scope}:${entityName}`;
	};

	const shouldSaveNode = React.useCallback((node: FormStateTreeNode | null) => {
		if (!node || node.type === "upload") {
			return node?.type === "upload";
		}

		const hasData = node.data && Object.keys(node.data).length > 0;
		const hasChildren = node.children && node.children.length > 0;
		return hasData || (!node.isPersisted && hasChildren);
	}, []);

	const buildInitialSaveProgress = React.useCallback(() => {
		const primaryEntityName = config?.Form?.PrimaryApplicationTable?.TableLogicalName;
		const items: SaveProgressEvent[] = [];
		const saveTree = formState.getSaveTree?.();

		const walk = (node: any) => {
			if (!node) {
				return;
			}

			if (shouldSaveNode(node)) {
				items.push({
					id: buildProgressId(node.type, node.logicalName || "upload", node.id),
					scope: node.type,
					entityName: node.logicalName || "upload",
					label: node.type === "upload" ? node.data?.file?.name || node.id : undefined,
					status: "saving",
				});
			}

			node.children?.forEach((child: any) => walk(child));
		};

		if (saveTree) {
			walk(saveTree);
		} else if (primaryEntityName) {
			items.push({
				id: buildProgressId("primary", primaryEntityName),
				scope: "primary",
				entityName: primaryEntityName,
				status: "saving",
			});
		}

		return items;
	}, [config?.Form?.PrimaryApplicationTable?.TableLogicalName, formState, shouldSaveNode]);

	const handleSaveProgress = React.useCallback((event: SaveProgressEvent) => {
		setSaveProgress((prev) => {
			const existingIndex = prev.findIndex((item) => item.id === event.id);
			if (existingIndex === -1) {
				return [...prev, event];
			}

			const next = [...prev];
			next[existingIndex] = { ...next[existingIndex], ...event };
			return next;
		});
	}, []);

	const saveProgressTotals = React.useMemo(() => {
		const total = saveProgress.length;
		const saved = saveProgress.filter((item) => item.status === "saved").length;
		const failed = saveProgress.filter((item) => item.status === "failed").length;
		const complete = saved + failed;
		const percent = total === 0 ? (savePhase === "summary" ? 100 : 0) : Math.round((complete / total) * 100);

		return {
			total,
			saved,
			failed,
			complete,
			percent,
		};
	}, [savePhase, saveProgress]);

	const saveProgressVariant = saveProgressTotals.failed > 0 ? "danger" : savePhase === "summary" ? "success" : "info";

	const saveProgressLabel =
		savePhase === "saving"
			? "Saving your changes..."
			: savePhase === "summary"
				? !saveProgressTotals.total
					? "No changes to save"
					: saveProgressTotals.failed > 0
						? "Some changes could not be saved"
						: "Changes saved successfully"
				: "Preparing save...";

	const saveProgressMap = React.useMemo(() => new Map(saveProgress.map((item) => [item.id, item])), [saveProgress]);

	const errorsByRecordId = React.useMemo(() => {
		const map = new Map<string, SaveError[]>();
		saveErrors.forEach((error) => {
			if (!error?.recordId) {
				return;
			}

			const list = map.get(error.recordId) ?? [];
			list.push(error);
			map.set(error.recordId, list);
		});
		return map;
	}, [saveErrors]);

	const errorsByEntity = React.useMemo(() => {
		const map = new Map<string, SaveError[]>();

		saveErrors.forEach((error) => {
			if (!error?.entityName || error.recordId) {
				return;
			}

			const scope = error.phase === "secondary" ? "secondary" : error.phase === "child" ? "child" : error.phase === "upload" ? "upload" : "primary";
			const key = `${scope}:${error.entityName}`;
			const list = map.get(key) ?? [];
			list.push(error);
			map.set(key, list);
		});

		return map;
	}, [saveErrors]);

	const saveDetailsTree = React.useMemo(() => {
		// Use captured tree if available (persists throughout save), otherwise fall back to live tree
		const saveTree = capturedSaveTree || formState.getSaveTree?.();

		const buildNode = (node: FormStateTreeNode | null) => {
			if (!node) {
				return null;
			}

			const childNodes = node.children
				.map((child) => buildNode(child))
				.filter((child): child is NonNullable<ReturnType<typeof buildNode>> => Boolean(child));
			const includeNode = shouldSaveNode(node) || childNodes.length > 0;

			if (!includeNode) {
				return null;
			}

			const scope = node.type;
			const entityName = node.logicalName || "upload";
			const progressId = buildProgressId(scope, entityName, node.id);
			const progress = saveProgressMap.get(progressId);
			const errors = errorsByRecordId.get(node.id) ?? errorsByEntity.get(`${scope}:${entityName}`) ?? [];

			return {
				id: progressId,
				nodeId: node.id,
				scope,
				entityName,
				label: node.type === "upload" ? (node.data as UploadNodeData)?.file?.name || node.id : undefined,
				status: progress?.status,
				errors,
				children: childNodes,
			};
		};

		if (saveTree) {
			const rootNode = buildNode(saveTree);
			return rootNode ? [rootNode] : [];
		}

		if (saveProgress.length > 0) {
			return saveProgress.map((item) => ({
				id: item.id,
				nodeId: item.id,
				scope: item.scope,
				entityName: item.entityName,
				label: item.label,
				status: item.status,
				errors: errorsByEntity.get(`${item.scope}:${item.entityName}`) ?? [],
				children: [],
			}));
		}

		if (primaryEntity) {
			return [
				{
					id: buildProgressId("primary", primaryEntity),
					nodeId: primaryEntity,
					scope: "primary",
					entityName: primaryEntity,
					label: undefined,
					status: "saving",
					errors: [],
					children: [],
				},
			];
		}

		return [];
	}, [capturedSaveTree, errorsByEntity, errorsByRecordId, formState, primaryEntity, saveProgress, saveProgressMap, shouldSaveNode]);

	const updateUrlAfterSave = (recordId: string) => {
		if (!recordId) {
			return;
		}

		const recordLogicalName = config?.Form?.PrimaryApplicationTable?.TableLogicalName;
		if (!recordLogicalName) {
			return;
		}

		const searchParams = new URLSearchParams(window.location.search);
		searchParams.set("recordId", recordId);
		searchParams.set("recordLogicalName", recordLogicalName);

		const nextUrl = `${window.location.pathname}?${searchParams.toString()}`;
		window.history.replaceState(null, "", nextUrl);

		onUrlParamsChange?.((prev) => ({
			...prev,
			recordId,
			recordLogicalName,
		}));
	};

	const handleCloseSaveOverlay = () => {
		setShowSaveOverlay(false);
		setSavePhase("idle");
		setSaveProgress([]);
		setSaveErrors([]);
		setCapturedSaveTree(null);
	};

	const stepErrorMap = React.useMemo(() => {
		const map = new Map<number, { errorCount: number; hasIssues: boolean }>();
		visibleSteps.forEach((step, index) => {
			const stepId = step.Id ?? step.Name;
			const stepIssues = validationSelectors.getIssuesForStep(stepId);
			map.set(index, {
				errorCount: stepIssues.filter((issue) => issue.severity === "error").length,
				hasIssues: stepIssues.length > 0,
			});
		});
		return map;
	}, [validationSelectors, visibleSteps]);

	const clampIndex = (index) => {
		if (visibleSteps.length === 0) {
			return 0;
		}

		const min = 0;
		const max = visibleSteps.length - 1;
		return Math.min(Math.max(index, min), max);
	};

	const goToStep = (index) => {
		const clampedIndex = clampIndex(index);
		setActiveStepIndex(clampedIndex);
		// Mark step as visited for lazy loading
		setVisitedSteps((prev) => new Set([...prev, clampedIndex]));
	};

	// Save handlers
	const handleSave = async () => {
		// Capture the save tree before any state changes
		const currentSaveTree = formState.getSaveTree?.() || null;
		setCapturedSaveTree(currentSaveTree);
		setIsSaving(true);
		setSaveProgress(buildInitialSaveProgress());
		setSaveErrors([]);
		setSavePhase("saving");
		setShowSaveOverlay(true);

		try {
			const result = await executeSave({
				formState,
				config: runtimeConfig,
				urlParams,
				onProgress: handleSaveProgress,
			});

			if (result.recordId) {
				updateUrlAfterSave(result.recordId);
			}

			if (result.success) {
				setSaveErrors([]);

				// Reload form data after save (plugins or other processes may have modified data)
				if (result.recordId) {
					const reloadedData = await reloadFormData({ formState, config: runtimeConfig, urlParams }, result.recordId);
					if (reloadedData) {
						const fieldData = populateFieldsFromData(reloadedData, primaryEntity, runtimeConfig);
						formState.initializeFormData(fieldData);
					}
				}
			} else {
				setSaveErrors(result.errors || []);
			}
		} catch (error) {
			console.error("Save draft error:", error);
			const message = error instanceof Error ? error.message : "An error occurred while saving";
			setSaveErrors([{ message, phase: "save" }]);
		} finally {
			setIsSaving(false);
			setSavePhase("summary");
		}
	};

	const handleValidateAndSubmit = async () => {
		setIsValidating(true);
		setHasValidated(true);
		try {
			const issues = await validateApplication({ steps: visibleSteps, formState, config: runtimeConfig });
			setValidationIssues(issues);
			const blockingIssues = issues.filter((issue) => issue.severity === "error");

			if (blockingIssues.length > 0) {
				const currentStepId = visibleSteps[activeStepIndex]?.Id ?? visibleSteps[activeStepIndex]?.Name;
				const currentStepIssues = blockingIssues.filter((issue) => issue.stepId === currentStepId);
				if (currentStepIssues.length > 0) {
					focusValidationIssue(currentStepIssues[0]);
					return;
				}

				const firstIssue = blockingIssues[0];
				const firstIssueStepIndex = visibleSteps.findIndex((step) => (step.Id ?? step.Name) === firstIssue.stepId);
				if (firstIssueStepIndex >= 0) {
					goToStep(firstIssueStepIndex);
					setTimeout(() => focusValidationIssue(firstIssue), 0);
				}
				return;
			}

			await handleSave();
		} finally {
			setIsValidating(false);
		}
	};

	if (!metadataReady) {
		return <LoadingIndicator visible={true} message="Loading form metadata..." />;
	}

	if (visibleSteps.length === 0) {
		return <p>No field inputs were provided in this configuration.</p>;
	}

	return (
		<FormStateContext.Provider value={formState}>
			<div className="form-builder">
				<LoadingIndicator
					visible={showSaveOverlay}
					variant="full-screen"
					message={savePhase === "summary" ? "Save Complete" : "Saving..."}
					showSpinner={savePhase !== "summary"}>
					<div style={{ textAlign: "center", margin: "16px auto 0" }}>
						<ProgressBar value={saveProgressTotals.percent} variant={saveProgressVariant} label={saveProgressLabel} />
						<p style={{ marginTop: "8px", marginBottom: 0 }}>{saveProgressLabel}</p>
						{savePhase === "summary" && (saveProgressTotals.failed > 0 || saveErrors.length > 0) && (
							<div style={{ marginTop: "16px" }}>
								<button
									type="button"
									className="btn btn-link"
									onClick={() =>
										downloadSaveErrorLog({
											timestamp: new Date().toISOString(),
											formName: config?.FundingOpportunity?.FullName,
											savePhase,
											summary: {
												total: saveProgressTotals.total,
												saved: saveProgressTotals.saved,
												failed: saveProgressTotals.failed,
											},
											details: saveDetailsTree,
											ungroupedErrors: saveErrors.filter((e) => !e.recordId).map((e) => ({ phase: e.phase, message: e.message })),
										})
									}>
									Download Error Details
								</button>
							</div>
						)}
						{savePhase === "summary" && (
							<div style={{ marginTop: "16px" }}>
								<button type="button" className="btn btn-primary" onClick={handleCloseSaveOverlay}>
									Close
								</button>
							</div>
						)}
					</div>
				</LoadingIndicator>
				<div className={`banner${isBannerSticky ? " banner--sticky" : ""}`}>
					<div className="container">
						<div className="banner-main-content">
							<div className="banner-title">
								<h1>{config?.FundingOpportunity.FullName}</h1>
							</div>
							<div className="banner-details">
								<p dangerouslySetInnerHTML={{ __html: config?.Form?.Introduction ?? "" }} />
							</div>
							<div className="banner-actions-primary">
								<button
									type="button"
									className="btn btn-default"
									onClick={handleSave}
									disabled={isSaving || (!formState.hasChanges && !formState.hasPendingUploads)}>
									{isSaving ? "Saving..." : "Save Unsaved Changes"}
								</button>
								<button type="button" className="btn btn-primary" onClick={handleValidateAndSubmit} disabled={isSaving || isValidating}>
									{isValidating ? "Validating..." : isSaving ? "Submitting..." : "Submit"}
								</button>
							</div>
						</div>
					</div>
				</div>
				<div className="banner-sentinel" ref={bannerSentinelRef} aria-hidden="true" />
				<div className="body-content">
					<div className="container">
						<div className="alert-container">{/* TO-DO: Step-level alerts for validations */}</div>
						<div className="multi-step-form-layout">
							<nav className="multi-step-form-list-group">
								<div className="progress list-group left">
									{visibleSteps.map((step, index) => {
										const isActive = index === activeStepIndex;
										const stepState = stepErrorMap.get(index);
										const hasErrors = (stepState?.errorCount || 0) > 0;
										const showValid = hasValidated && !hasErrors;
										return (
											<button
												key={step.Id ?? step.Name}
												type="button"
												className={`list-group-item${isActive ? " active" : ""}`}
												aria-current={isActive ? "step" : undefined}
												onClick={() => goToStep(index)}>
												<span className="step-title">
													{step.Name ?? `Step ${index + 1}`}
													{hasErrors && (
														<span className="step-status step-status--error" aria-label="Step has errors">
															●
														</span>
													)}
													{showValid && (
														<span className="step-status step-status--valid" aria-label="Step valid">
															✓
														</span>
													)}
												</span>
											</button>
										);
									})}
								</div>
							</nav>
							<div className="steps-container">
								{/* Render all steps but only show active one */}
								{visibleSteps.map((step, index) => {
									const isActive = index === activeStepIndex;
									const hasBeenVisited = visitedSteps.has(index);

									return (
										<Step
											key={step.Id ?? step.Name}
											step={step}
											isActive={isActive}
											hasBeenVisited={hasBeenVisited}
											positionLabel={`Step ${index + 1} of ${visibleSteps.length}`}
											recordId={primaryRecordId}
											urlParams={urlParams}
											stepIssues={validationSelectors.getIssuesForStep(step.Id ?? step.Name)}
											onIssueSelect={focusValidationIssue}
											getFieldIssues={validationSelectors.getFieldIssues}
											onFieldChangeClearIssues={clearIssuesForField}
											onValidateTableEntryForm={validateTableEntryForm}
										/>
									);
								})}
							</div>
						</div>
					</div>
				</div>
			</div>
			{DevConsole && (
				<Suspense>
					<DevConsole />
				</Suspense>
			)}
		</FormStateContext.Provider>
	);
};

export default FormBuilder;
