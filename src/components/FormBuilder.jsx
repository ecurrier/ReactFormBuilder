import React, { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import Step from "./Step.jsx";
import { ActionType } from "../constants/enums.js";
import { useFormState } from "../hooks/useFormState.ts";
import { populateFieldsFromData } from "../services/dataLoader.ts";
import { executeSaveDraft, executeValidateAndSubmit, populateFormLookup, reloadFormData } from "../services/saveOrchestrator.ts";

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

	const getScopeLabel = (scope) => {
		const normalizedScope = typeof scope === "string" ? scope.toLowerCase() : "primary";

		switch (normalizedScope) {
			case "primary":
				return "Primary";
			case "secondary":
				return "Secondary";
			case "child":
				return "Child";
			default:
				return normalizedScope.charAt(0).toUpperCase() + normalizedScope.slice(1);
		}
	};

	const formatSaveError = (error, fallbackEntityName = "Unknown") => {
		if (typeof error === "string") {
			return error;
		}

		const entityName = error?.entityName || fallbackEntityName;
		const recordLabel = error?.recordId ? ` (${error.recordId})` : "";
		const message = error?.message || "Unknown error";
		return `${entityName}${recordLabel}: ${message}`;
	};

	const groupedSaveErrors = useMemo(() => {
		const grouped = new Map();

		const ensureGroup = (scope, entityName) => {
			const normalizedScope = scope || "primary";
			const normalizedEntity = entityName || "Unknown";
			const key = `${normalizedScope}:${normalizedEntity}`;

			if (!grouped.has(key)) {
				grouped.set(key, {
					scope: normalizedScope,
					entityName: normalizedEntity,
					total: 0,
					saved: 0,
					failed: 0,
					errors: [],
				});
			}

			return grouped.get(key);
		};

		saveProgress.forEach((entry) => {
			if (!entry) {
				return;
			}

			const scope = entry.scope || entry.entityScope || "primary";
			const entityName = entry.entityName || entry.entity || "Unknown";
			const group = ensureGroup(scope, entityName);
			const hasCounts = ["total", "saved", "failed"].some((key) => Number.isFinite(entry[key]));

			if (hasCounts) {
				const total = Number.isFinite(entry.total) ? entry.total : (Number.isFinite(entry.saved) ? entry.saved : 0) + (Number.isFinite(entry.failed) ? entry.failed : 0);
				group.total += total;
				group.saved += Number.isFinite(entry.saved) ? entry.saved : 0;
				group.failed += Number.isFinite(entry.failed) ? entry.failed : 0;
			} else {
				group.total += 1;
				const status = entry.status || entry.result || entry.state;
				const isSuccess = entry.success === true || status === "success" || status === "saved";
				const isFailure = entry.success === false || status === "failed" || status === "error";

				if (isSuccess) {
					group.saved += 1;
				}

				if (isFailure) {
					group.failed += 1;
				}
			}
		});

		saveErrors.forEach((error) => {
			if (!error) {
				return;
			}

			if (typeof error === "string") {
				const group = ensureGroup("primary", "Unknown");
				group.errors.push({ message: error });
				group.total = Math.max(group.total, group.errors.length);
				group.failed = Math.max(group.failed, group.errors.length);
				return;
			}

			const scope = error.scope || error.entityScope || "primary";
			const entityName = error.entityName || "Unknown";
			const group = ensureGroup(scope, entityName);

			group.errors.push(error);
			group.total = Math.max(group.total, group.errors.length);
			group.failed = Math.max(group.failed, group.errors.length);
		});

		return Array.from(grouped.values());
	}, [saveErrors, saveProgress]);

	if (visibleSteps.length === 0) {
		return <p>No field inputs were provided in this configuration.</p>;
	}

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
		setSaveErrors([]);
		setSaveProgress([]);

		try {
			const result = await executeSaveDraft({
				formState,
				config,
				urlParams,
			});

			setSaveErrors(result.errors || []);
			setSaveProgress(result.saveProgress || []);

			if (result.success) {
				setSaveMessage({ type: "success", text: "Draft saved successfully" });

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
				const errorText = result.errors?.map((error) => formatSaveError(error)).join(", ");
				setSaveMessage({
					type: "error",
					text: errorText || "Failed to save draft",
				});
			}
		} catch (error) {
			console.error("Save draft error:", error);
			setSaveMessage({ type: "error", text: error.message || "An error occurred while saving" });
		} finally {
			setIsSaving(false);
		}
	};

	const handleValidateAndSubmit = async () => {
		setIsSaving(true);
		setSaveMessage(null);
		setSaveErrors([]);
		setSaveProgress([]);

		try {
			const result = await executeValidateAndSubmit({
				formState,
				config,
				urlParams,
			});

			setSaveErrors(result.errors || []);
			setSaveProgress(result.saveProgress || []);

			if (result.success) {
				setSaveMessage({ type: "success", text: "Form submitted successfully" });

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
				const errorText = result.errors?.map((error) => formatSaveError(error)).join(", ");
				setSaveMessage({
					type: "error",
					text: errorText || "Validation failed",
				});
			}
		} catch (error) {
			console.error("Validate and submit error:", error);
			setSaveMessage({ type: "error", text: error.message || "An error occurred during submission" });
		} finally {
			setIsSaving(false);
		}
	};

	const renderGroupStatusIcon = (group) => {
		const computedTotal = Math.max(group.total, group.saved + group.failed, group.errors.length);

		if (computedTotal > 0 && group.saved >= computedTotal) {
			return "✅";
		}

		if (computedTotal > 0 && group.failed >= computedTotal) {
			return "❌";
		}

		return "⚠️";
	};

	return (
		<main className="page-content">
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
						{(isSaving || groupedSaveErrors.length > 0) && (
							<div className="save-progress-overlay" role="status" aria-live="polite">
								<div className="save-progress-overlay__content">
									<h2 className="save-progress-overlay__title">Save summary</h2>
									{groupedSaveErrors.length === 0 ? (
										<p className="save-progress-overlay__message">Saving records...</p>
									) : (
										<ul className="save-progress-overlay__groups">
											{groupedSaveErrors.map((group) => {
												const total = Math.max(group.total, group.saved + group.failed, group.errors.length);
												let failed = Math.min(Math.max(group.failed, group.errors.length), total);
												let saved = Math.min(group.saved, total);

												if (saved + failed < total) {
													saved = total - failed;
												}

												const scopeLabel = getScopeLabel(group.scope);

												return (
													<li key={`${group.scope}-${group.entityName}`} className="save-progress-overlay__group">
														<div className="save-progress-overlay__group-header">
															<span className="save-progress-overlay__group-status" aria-hidden="true">
																{renderGroupStatusIcon({ ...group, total, saved, failed })}
															</span>
															<span className="save-progress-overlay__group-title">
																{scopeLabel}: {group.entityName}
															</span>
														</div>
														<div className="save-progress-overlay__group-counts">
															<span>Total: {total}</span>
															<span>Saved: {saved}</span>
															<span>Failed: {failed}</span>
														</div>
														{group.errors.length > 0 && (
															<ul className="save-progress-overlay__errors">
																{group.errors.map((error, index) => (
																	<li key={`${group.entityName}-error-${index}`}>{formatSaveError(error, group.entityName)}</li>
																))}
															</ul>
														)}
													</li>
												);
											})}
										</ul>
									)}
								</div>
							</div>
						)}
					</div>
					<div className="multi-step-form-layout">
						<nav className="multi-step-form-list-group">
							<div className="progress list-group left">
								{visibleSteps.map((step, index) => {
									const isActive = index === activeStepIndex;
									return (
										<button
											key={step.Id ?? step.Name}
											type="button"
											className={`list-group-item${isActive ? " active" : ""}`}
											aria-current={isActive ? "step" : undefined}
											onClick={() => goToStep(index)}>
											<span className="step-title">{step.Name ?? `Step ${index + 1}`}</span>
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
