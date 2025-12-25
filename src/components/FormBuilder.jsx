import React, { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import Step from "./Step.jsx";
import { ActionType } from "../constants/enums.js";
import { useFormState } from "../hooks/useFormState.ts";
import { populateFieldsFromData } from "../services/dataLoader.ts";
import { executeSaveDraft, executeValidateAndSubmit, populateFormLookup, reloadFormData } from "../services/saveOrchestrator.ts";
import LoadingIndicator from "./LoadingIndicator.tsx";

const FormBuilder = ({ config, recordData, urlParams }) => {
	const orderedSteps = useMemo(() => {
		if (!Array.isArray(config?.Form?.Steps)) {
			return [];
		}

		return [...config.Form.Steps].sort((a, b) => (a.Order ?? 0) - (b.Order ?? 0));
	}, [config]);

	const visibleSteps = useMemo(
		() =>
			orderedSteps.filter((step) =>
				step.Actions?.some((action) =>
					[ActionType.FieldInput, ActionType.TableEntry, ActionType.FileUpload].includes(action.Type)
				)
			),
		[orderedSteps]
	);

	const [activeStepIndex, setActiveStepIndex] = useState(0);
	// Track which steps have been visited for lazy loading
	const [visitedSteps, setVisitedSteps] = useState(new Set([0]));
	const [isSaving, setIsSaving] = useState(false);
	const [saveMessage, setSaveMessage] = useState(null);
	const [saveProgress, setSaveProgress] = useState([]);
	const [saveErrors, setSaveErrors] = useState([]);
	const [savePhase, setSavePhase] = useState("idle");
	const [showSaveOverlay, setShowSaveOverlay] = useState(false);
	const [isBannerSticky, setIsBannerSticky] = useState(false);
	const bannerSentinelRef = useRef(null);

	// Get primary entity and record ID from URL params
	const primaryEntity = config?.Form?.PrimaryApplicationTable?.TableLogicalName;
	const primaryRecordId = urlParams?.recordId || null;

	// Initialize form state with primary entity and record ID
	const formState = useFormState(primaryEntity, primaryRecordId);

	// Load record data into form state when recordData is provided
	useEffect(() => {
		if (recordData && primaryEntity) {
			const fieldData = populateFieldsFromData(recordData, primaryEntity, config);
			formState.initializeFormData(fieldData);
		}
	}, [recordData, primaryEntity, formState.initializeFormData]);

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

	if (visibleSteps.length === 0) {
		return <p>No field inputs were provided in this configuration.</p>;
	}

	const buildProgressId = (scope, entityName, recordId) => {
		if (recordId) {
			return `${scope}:${entityName}:${recordId}`;
		}

		return `${scope}:${entityName}`;
	};

	const buildInitialSaveProgress = React.useCallback(() => {
		const primaryEntityName = config?.Form?.PrimaryApplicationTable?.TableLogicalName;
		const changes = formState.serializeForSubmission();
		const secondaryChanges = changes.filter((change) => change.entityName !== primaryEntityName);
		const primaryChanges = changes.find((change) => change.entityName === primaryEntityName);
		const shouldEnsurePrimaryExists =
			!formState.recordId && (formState.hasPendingChildren || secondaryChanges.length > 0);
		const items = [];

		if (
			primaryEntityName &&
			((primaryChanges && primaryChanges.data && Object.keys(primaryChanges.data).length > 0) || shouldEnsurePrimaryExists)
		) {
			items.push({
				id: buildProgressId("primary", primaryEntityName),
				scope: "primary",
				entityName: primaryEntityName,
				status: "saving",
			});
		}

		secondaryChanges.forEach((change) => {
			items.push({
				id: buildProgressId("secondary", change.entityName),
				scope: "secondary",
				entityName: change.entityName,
				status: "saving",
			});
		});

		const pendingRecords = Object.values(formState.pendingChildRecords || {});
		pendingRecords.forEach((pending) => {
			items.push({
				id: buildProgressId("child", pending.entityName, pending.id),
				scope: "child",
				entityName: pending.entityName,
				label: pending.id,
				status: "saving",
			});
		});

		return items;
	}, [config?.Form?.PrimaryApplicationTable?.TableLogicalName, formState]);

	const handleSaveProgress = React.useCallback((event) => {
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

	const groupedErrorSummary = React.useMemo(() => {
		const groups = new Map();

		saveErrors.forEach((error) => {
			if (!error) {
				return;
			}

			const scope = error.phase === "secondary" ? "secondary" : error.phase === "child" ? "child" : "primary";
			const entityName = error.entityName || "Unknown";
			const key = `${scope}:${entityName}`;

			if (!groups.has(key)) {
				groups.set(key, {
					scope,
					entityName,
					errors: [],
				});
			}

			groups.get(key).errors.push(error);
		});

		return Array.from(groups.values());
	}, [saveErrors]);

	const groupedSaveProgress = React.useMemo(() => {
		const groups = new Map();

		saveProgress.forEach((item) => {
			const key = `${item.scope}:${item.entityName}`;
			if (!groups.has(key)) {
				groups.set(key, {
					scope: item.scope,
					entityName: item.entityName,
					total: 0,
					saved: 0,
					failed: 0,
				});
			}

			const group = groups.get(key);
			group.total += 1;

			if (item.status === "saved") {
				group.saved += 1;
			}

			if (item.status === "failed") {
				group.failed += 1;
			}
		});

		return Array.from(groups.values());
	}, [saveProgress]);

	const groupedSaveSummary = React.useMemo(() => {
		const progressMap = new Map();

		groupedSaveProgress.forEach((group) => {
			progressMap.set(`${group.scope}:${group.entityName}`, {
				scope: group.scope,
				entityName: group.entityName,
				total: group.total,
				saved: group.saved,
				failed: group.failed,
				errors: [],
			});
		});

		groupedErrorSummary.forEach((group) => {
			const key = `${group.scope}:${group.entityName}`;
			if (!progressMap.has(key)) {
				progressMap.set(key, {
					scope: group.scope,
					entityName: group.entityName,
					total: 0,
					saved: 0,
					failed: group.errors.length,
					errors: [],
				});
			}

			progressMap.get(key).errors = group.errors;
		});

		return Array.from(progressMap.values());
	}, [groupedSaveProgress, groupedErrorSummary]);

	const renderGroupStatus = (group) => {
		if (group.total === 0) {
			return { icon: "⏳", text: "Queued" };
		}

		if (group.saved === group.total) {
			return { icon: "✅", text: "Saved" };
		}

		if (group.failed === group.total) {
			return { icon: "❌", text: "Failed" };
		}

		if (group.failed > 0) {
			return { icon: "⚠️", text: `${group.saved}/${group.total} saved` };
		}

		return { icon: "⏳", text: `${group.saved}/${group.total} saved` };
	};

	const renderSummaryStatus = (group) => {
		if (group.total === 0 && group.failed > 0) {
			return { icon: "❌", text: "Failed" };
		}

		if (group.total > 0 && group.saved === group.total) {
			return { icon: "✅", text: "Saved" };
		}

		if (group.total > 0 && group.failed === group.total) {
			return { icon: "❌", text: "Failed" };
		}

		if (group.failed > 0) {
			return { icon: "⚠️", text: `${group.saved}/${group.total} saved` };
		}

		return { icon: "⏳", text: `${group.saved}/${group.total} saved` };
	};

	const formatScopeLabel = (scope) => {
		if (scope === "primary") return "Primary";
		if (scope === "secondary") return "Secondary";
		if (scope === "child") return "Child";
		return scope;
	};

	const formatSaveErrors = (errors) => {
		if (!Array.isArray(errors) || errors.length === 0) {
			return "An error occurred while saving";
		}

		return errors
			.map((error) => {
				if (!error) {
					return "Unknown error";
				}

				const prefix = error.entityName ? `${error.entityName}: ` : "";
				return `${prefix}${error.message || "Unknown error"}`;
			})
			.join(", ");
	};

	const handleCloseSaveOverlay = () => {
		setShowSaveOverlay(false);
		setSavePhase("idle");
		setSaveProgress([]);
		setSaveErrors([]);
	};

	const stepErrorMap = React.useMemo(() => {
		const errorEntities = new Set(
			saveErrors
				.map((error) => error?.entityName)
				.filter(Boolean)
		);

		if (errorEntities.size === 0) {
			return new Set();
		}

		const indices = new Set();

		visibleSteps.forEach((step, index) => {
			if (step.EntityLogicalName && errorEntities.has(step.EntityLogicalName)) {
				indices.add(index);
				return;
			}

			step.Actions?.forEach((action) => {
				if (action.Type === ActionType.TableEntry && action.Properties?.ChildEntityLogicalName) {
					if (errorEntities.has(action.Properties.ChildEntityLogicalName)) {
						indices.add(index);
					}
				}
			});
		});

		return indices;
	}, [saveErrors, visibleSteps]);

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

	const goToPrevious = () => {
		setActiveStepIndex((prev) => {
			const newIndex = clampIndex(prev - 1);
			setVisitedSteps((prevVisited) => new Set([...prevVisited, newIndex]));
			return newIndex;
		});
	};

	const goToNext = () => {
		setActiveStepIndex((prev) => {
			const newIndex = clampIndex(prev + 1);
			setVisitedSteps((prevVisited) => new Set([...prevVisited, newIndex]));
			return newIndex;
		});
	};

	const hasPrevious = activeStepIndex > 0;
	const hasNext = activeStepIndex < visibleSteps.length - 1;
	// Save handlers
	const handleSaveDraft = async () => {
		setIsSaving(true);
		setSaveMessage(null);
		setSaveProgress(buildInitialSaveProgress());
		setSaveErrors([]);
		setSavePhase("saving");
		setShowSaveOverlay(true);

		try {
			const result = await executeSaveDraft({
				formState,
				config,
				urlParams,
				onProgress: handleSaveProgress,
			});

			if (result.success) {
				setSaveMessage({ type: "success", text: "Draft saved successfully" });
				setSaveErrors([]);

				// If this was a new record, populate form lookup and reload
				if (!primaryRecordId && result.recordId) {
					const formId = config?.Regarding?.id || urlParams?.formId;
					if (formId) {
						await populateFormLookup(result.recordId, primaryEntity, formId);
					}

					// Reload form data
					const reloadedData = await reloadFormData({ formState, config, urlParams }, result.recordId);
					if (reloadedData) {
						const fieldData = populateFieldsFromData(reloadedData, primaryEntity, config);
						formState.initializeFormData(fieldData);
					}

					// Update URL with new record ID (optional - depends on requirements)
					// window.history.replaceState({}, '', `?recordId=${result.recordId}&versionId=${urlParams.versionId}`);
				}
			} else {
				setSaveMessage({
					type: "error",
					text: formatSaveErrors(result.errors),
				});
				setSaveErrors(result.errors || []);
			}
		} catch (error) {
			console.error("Save draft error:", error);
			setSaveMessage({ type: "error", text: error.message || "An error occurred while saving" });
			setSaveErrors([{ message: error.message || "An error occurred while saving", phase: "save" }]);
		} finally {
			setIsSaving(false);
			setSavePhase("summary");
		}
	};

	const handleValidateAndSubmit = async () => {
		setIsSaving(true);
		setSaveMessage(null);
		setSaveProgress(buildInitialSaveProgress());
		setSaveErrors([]);
		setSavePhase("saving");
		setShowSaveOverlay(true);

		try {
			const result = await executeValidateAndSubmit({
				formState,
				config,
				urlParams,
				onProgress: handleSaveProgress,
			});

			if (result.success) {
				setSaveErrors([]);

				// If this was a new record, populate form lookup and reload
				if (!primaryRecordId && result.recordId) {
					const formId = config?.Regarding?.id || urlParams?.formId;
					if (formId) {
						await populateFormLookup(result.recordId, primaryEntity, formId);
					}

					// Reload form data
					const reloadedData = await reloadFormData({ formState, config, urlParams }, result.recordId);
					if (reloadedData) {
						const fieldData = populateFieldsFromData(reloadedData, primaryEntity, config);
						formState.initializeFormData(fieldData);
					}
				}
			} else {
				setSaveMessage({
					type: "error",
					text: formatSaveErrors(result.errors),
				});
				setSaveErrors(result.errors || []);
			}
		} catch (error) {
			console.error("Validate and submit error:", error);
			setSaveMessage({ type: "error", text: error.message || "An error occurred during submission" });
			setSaveErrors([{ message: error.message || "An error occurred during submission", phase: "save" }]);
		} finally {
			setIsSaving(false);
			setSavePhase("summary");
		}
	};

	return (
		<main className="page-content">
			<LoadingIndicator
				visible={showSaveOverlay}
				variant="full-screen"
				message={savePhase === "summary" ? "Save complete" : "Saving records..."}
				showSpinner={savePhase !== "summary"}>
				{groupedSaveProgress.length > 0 && savePhase === "saving" && (
					<div style={{ textAlign: "left", maxWidth: "520px", margin: "16px auto 0" }}>
						<strong>Saving status</strong>
						<ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
							{groupedSaveProgress.map((group) => {
								const status = renderGroupStatus(group);
								return (
									<li key={`${group.scope}-${group.entityName}`} style={{ marginBottom: "6px" }}>
										<span style={{ marginRight: "6px" }}>{status.icon}</span>
										{formatScopeLabel(group.scope)}: {group.entityName} — {status.text}
									</li>
								);
							})}
						</ul>
					</div>
				)}
				{savePhase === "summary" && (
					<div style={{ textAlign: "left", maxWidth: "640px", margin: "16px auto 0" }}>
						<strong>Save summary</strong>
						{groupedSaveSummary.length > 0 ? (
							<ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
								{groupedSaveSummary.map((group) => {
									const status = renderSummaryStatus(group);
									return (
										<li key={`${group.scope}-${group.entityName}`} style={{ marginBottom: "10px" }}>
											<div>
												<span style={{ marginRight: "6px" }}>{status.icon}</span>
												{formatScopeLabel(group.scope)}: {group.entityName} — {status.text}
											</div>
											{group.errors?.length > 0 && (
												<ul style={{ marginTop: "6px", paddingLeft: "18px" }}>
													{group.errors.map((error, index) => (
														<li key={`${group.scope}-${group.entityName}-${index}`}>{error.message}</li>
													))}
												</ul>
											)}
										</li>
									);
								})}
							</ul>
						) : (
							<p style={{ marginTop: "8px" }}>No changes to save.</p>
						)}
						<div style={{ marginTop: "16px", textAlign: "center" }}>
							<button type="button" className="btn btn-primary" onClick={handleCloseSaveOverlay}>
								Close
							</button>
						</div>
					</div>
				)}
			</LoadingIndicator>
			<div className={`banner${isBannerSticky ? " banner--sticky" : ""}`}>
				<div className="container">
					<div className="banner-main-content">
						<div className="banner-title">
							<h1>{config?.FundingOpportunity.FullName}</h1>
						</div>
						<div className="banner-details">
							<p>
								Lorem ipsum dolor sit, amet consectetur adipisicing elit. Ipsam, incidunt quibusdam eius rerum harum ullam dicta asperiores
								officiis temporibus tenetur, accusamus illo? Delectus soluta, maxime vero at officia aliquam molestiae. Lorem ipsum dolor, sit
								amet consectetur adipisicing elit. Cum, maxime fugit explicabo aliquam iusto atque voluptatum sit dolorum officiis ad amet
								dolor, nemo vero eius, maiores pariatur corrupti labore deleniti!
							</p>
						</div>
						<div className="banner-actions-primary">
							<button
								type="button"
								className="btn btn-default"
								onClick={handleSaveDraft}
								disabled={isSaving || (!formState.hasChanges && !formState.hasPendingChildren)}>
								{isSaving ? "Saving..." : "Save Draft"}
							</button>
							<button type="button" className="btn btn-primary" onClick={handleValidateAndSubmit} disabled={isSaving}>
								{isSaving ? "Submitting..." : "Validate & Submit"}
							</button>
						</div>
					</div>
				</div>
			</div>
			<div className="banner-sentinel" ref={bannerSentinelRef} aria-hidden="true" />
			<div className="body-content">
				<div className="container">
					<div className="alert-container">
						{/* Save message */}
						{saveMessage && (
							<div
								className={`alert ${saveMessage.type === "success" ? "alert-success" : "alert-danger"}`}
								role="alert"
								style={{ margin: "20px 0" }}>
								{saveMessage.text}
							</div>
						)}
					</div>
					<div className="multi-step-form-layout">
						<nav className="multi-step-form-list-group">
							<div className="progress list-group left">
								{visibleSteps.map((step, index) => {
									const isActive = index === activeStepIndex;
									const hasErrors = stepErrorMap.has(index);
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
													<span
														style={{ marginLeft: "6px", color: "#c0392b", fontWeight: 700 }}
														aria-label="Step has errors">
														●
													</span>
												)}
											</span>
										</button>
									);
								})}
							</div>
							<div className="step-nav-controls">
								<button
									type="button"
									className="nav-button nav-button--previous"
									onClick={goToPrevious}
									disabled={!hasPrevious || isSaving}
									aria-label="Previous step">
									<span className="nav-button__icon" aria-hidden="true">
										←
									</span>
									<span className="sr-only">Previous</span>
								</button>
								<button
									type="button"
									className="nav-button nav-button--next"
									onClick={goToNext}
									disabled={!hasNext || isSaving}
									aria-label="Next step">
									<span className="nav-button__icon" aria-hidden="true">
										→
									</span>
									<span className="sr-only">Next</span>
								</button>
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
										formState={formState}
										urlParams={urlParams}
									/>
								);
							})}
						</div>
					</div>
				</div>
			</div>
		</main>
	);
};

FormBuilder.propTypes = {
	config: PropTypes.shape({
		Form: PropTypes.shape({
			Steps: PropTypes.arrayOf(PropTypes.object),
			PrimaryApplicationTable: PropTypes.shape({
				TableLogicalName: PropTypes.string,
			}),
		}),
		Regarding: PropTypes.shape({
			id: PropTypes.string,
		}),
	}).isRequired,
	recordData: PropTypes.object,
	urlParams: PropTypes.shape({
		recordId: PropTypes.string,
		versionId: PropTypes.string,
		recordLogicalName: PropTypes.string,
		parentRecordLogicalName: PropTypes.string,
		parentRecordFieldLogicalName: PropTypes.string,
		parentRecordId: PropTypes.string,
		formId: PropTypes.string,
	}),
};

export default FormBuilder;
