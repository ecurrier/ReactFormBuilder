import React, { useEffect, useMemo, useState } from "react";
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

	const visibleSteps = useMemo(() => orderedSteps.filter((step) => step.Actions?.some((action) => action.Type === ActionType.FieldInput)), [orderedSteps]);

	const [activeStepIndex, setActiveStepIndex] = useState(0);
	// Track which steps have been visited for lazy loading
	const [visitedSteps, setVisitedSteps] = useState(new Set([0]));
	const [isSaving, setIsSaving] = useState(false);
	const [saveMessage, setSaveMessage] = useState(null);

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

		try {
			const result = await executeSaveDraft({
				formState,
				config,
				urlParams,
			});

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
				setSaveMessage({
					type: "error",
					text: result.errors?.join(", ") || "Failed to save draft",
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

		try {
			const result = await executeValidateAndSubmit({
				formState,
				config,
				urlParams,
			});

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
				setSaveMessage({
					type: "error",
					text: result.errors?.join(", ") || "Validation failed",
				});
			}
		} catch (error) {
			console.error("Validate and submit error:", error);
			setSaveMessage({ type: "error", text: error.message || "An error occurred during submission" });
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<main className="page-content">
			<div className="banner">
				<div className="container">
					<div className="banner-main-content">
						<div className="banner-title">
							<h1>{config?.FundingOpportunity.FullName}</h1>
						</div>
						<div className="banner-details"></div>
						<div className="banner-actions">
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
							<div style={{ display: "flex", gap: "10px" }}>
								<button type="button" className="nav-button" onClick={goToPrevious} disabled={!hasPrevious || isSaving}>
									Previous
								</button>
								<button type="button" className="nav-button primary" onClick={goToNext} disabled={!hasNext || isSaving}>
									Next
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
