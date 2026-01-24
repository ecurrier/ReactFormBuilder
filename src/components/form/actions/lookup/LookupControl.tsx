import React, { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { LookupAdvancedSearchModal } from "@components";
import { quickSearchLookup } from "@services/lookupService";
import { resolveEntityDisplayName } from "@/utilities/metadata";

export const LookupControl = ({ inputId, label, placeholder, value, onChange, targets, isReadOnly, isRequired }) => {
	const [searchText, setSearchText] = useState("");
	const [results, setResults] = useState([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isQuickSearchOpen, setIsQuickSearchOpen] = useState(false);
	const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
	const [selectedTargetName, setSelectedTargetName] = useState(targets?.[0]?.EntityLogicalName || "");
	const containerRef = useRef(null);

	const selectedTarget = useMemo(() => {
		if (!targets || targets.length === 0) {
			return null;
		}
		return targets.find((target) => target.EntityLogicalName === selectedTargetName) || targets[0];
	}, [targets, selectedTargetName]);

	useEffect(() => {
		if (!targets || targets.length === 0) {
			return;
		}

		if (value?.logicalName) {
			setSelectedTargetName(value.logicalName);
		} else if (!selectedTargetName) {
			setSelectedTargetName(targets[0].EntityLogicalName);
		}
	}, [targets, value, selectedTargetName]);

	useEffect(() => {
		if (value?.name) {
			setSearchText(value.name);
		} else if (!value) {
			setSearchText("");
		}
	}, [value]);

	useEffect(() => {
		if (!isQuickSearchOpen || !selectedTarget || isReadOnly) {
			return;
		}

		// Debounce search input
		const timer = setTimeout(async () => {
			setIsLoading(true);
			try {
				const matches = await quickSearchLookup(selectedTarget, searchText.trim());
				setResults(matches);
			} catch (error) {
				console.error("Failed to fetch lookup results:", error);
				setResults([]);
			} finally {
				setIsLoading(false);
			}
		}, 300);

		return () => clearTimeout(timer);
	}, [searchText, selectedTarget, isQuickSearchOpen, isReadOnly]);

	useEffect(() => {
		const handleClickOutside = (event) => {
			if (containerRef.current && !containerRef.current.contains(event.target)) {
				setIsQuickSearchOpen(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const handleInputChange = (event) => {
		setSearchText(event.target.value);
		if (!isQuickSearchOpen) {
			setIsQuickSearchOpen(true);
		}
		if (!event.target.value) {
			onChange?.(null);
		}
	};

	const handleSelectResult = (result) => {
		onChange?.({
			id: result.id,
			logicalName: result.logicalName,
			name: result.name,
		});
		setSearchText(result.name);
		setIsQuickSearchOpen(false);
	};

	const handleClear = () => {
		setSearchText("");
		setResults([]);
		onChange?.(null);
	};

	const handleOpenAdvanced = () => {
		setIsAdvancedOpen(true);
		setIsQuickSearchOpen(false);
	};

	const handleAdvancedSelect = (result) => {
		if (!result) {
			return;
		}

		handleSelectResult(result);
		setIsAdvancedOpen(false);
	};

	const hasMultipleTargets = targets && targets.length > 1;
	const showSkeleton = isLoading && results.length === 0;

	return (
		<div className="input-group lookup-control-container" ref={containerRef}>
			<div className={`lookup-control-input-wrapper ${value?.id ? "has-value" : ""}`}>
				<div className="lookup-input-container">
					<input
						id={inputId}
						type="text"
						className="form-control lookup"
						placeholder={placeholder}
						value={searchText}
						onChange={handleInputChange}
						onFocus={() => setIsQuickSearchOpen(true)}
						readOnly={isReadOnly}
						required={isRequired}
						aria-label={label}
						autoComplete="off"
					/>
					{isQuickSearchOpen && !isReadOnly && (
						<div className="lookup-results" role="listbox">
							{hasMultipleTargets && (
								<div className="lookup-target-selector">
									{targets.map((target, index) => (
										<button
											key={`target-${target.EntityLogicalName}-${index}`}
											type="button"
											className={`btn btn-sm ${selectedTargetName === target.EntityLogicalName ? "btn-primary" : "btn-default"}`}
											onClick={() => setSelectedTargetName(target.EntityLogicalName)}
											role="tab"
											aria-selected={selectedTargetName === target.EntityLogicalName}
											aria-controls={`${inputId}-lookup-results`}>
											{resolveEntityDisplayName(target.EntityLogicalName)}
										</button>
									))}
								</div>
							)}
							{showSkeleton && (
								<ul className="list-unstyled lookup-skeleton-list" aria-hidden="true">
									{Array.from({ length: 5 }).map((_, index) => (
										<li key={`lookup-skeleton-${index}`} className="lookup-skeleton-row">
											<span className="skeleton skeleton--text skeleton--w-80"></span>
										</li>
									))}
								</ul>
							)}
							{results.length > 0 && (
								<ul className="list-unstyled mb-0" role="listbox" id={`${inputId}-lookup-results`} aria-label={`Search results for ${label}`}>
									{results.map((result) => (
										<li
											key={result.id}
											role="option"
											aria-selected={value?.id === result.id}
											className={`lookup-result-item ${value?.id === result.id ? "focused" : ""}`}
											onClick={() => handleSelectResult(result)}
											onMouseDown={(e) => e.preventDefault()}>
											<div className="lookup-result-content">
												<span className="lookup-result-name">{result.name}</span>
												{hasMultipleTargets && (
													<span className="badge lookup-entity-badge">{resolveEntityDisplayName(result.logicalName)}</span>
												)}
											</div>
										</li>
									))}
								</ul>
							)}
						</div>
					)}
				</div>
				<span className="input-group-btn">
					<button type="button" className="btn btn-default" onClick={handleOpenAdvanced} disabled={isReadOnly}>
						<span className="glyphicon glyphicon-search" aria-hidden="true"></span>
					</button>
				</span>
				{value?.id && !isReadOnly && (
					<span className="input-group-btn">
						<button type="button" className="btn btn-default" onClick={handleClear} title="Remove value">
							<span className="glyphicon glyphicon-remove" aria-hidden="true"></span>
						</button>
					</span>
				)}
			</div>

			<LookupAdvancedSearchModal
				isOpen={isAdvancedOpen}
				onClose={() => setIsAdvancedOpen(false)}
				onSelect={handleAdvancedSelect}
				targets={targets}
				selectedTarget={selectedTarget}
				onTargetChange={(name) => setSelectedTargetName(name)}
				searchPlaceholder={placeholder}
			/>
		</div>
	);
};

LookupControl.propTypes = {
	inputId: PropTypes.string.isRequired,
	label: PropTypes.string,
	placeholder: PropTypes.string,
	value: PropTypes.oneOfType([
		PropTypes.shape({
			id: PropTypes.string,
			logicalName: PropTypes.string,
			name: PropTypes.string,
		}),
		PropTypes.string,
	]),
	onChange: PropTypes.func,
	targets: PropTypes.arrayOf(
		PropTypes.shape({
			EntityLogicalName: PropTypes.string.isRequired,
			Columns: PropTypes.arrayOf(PropTypes.string),
			NavigationProperty: PropTypes.string,
			ReferencingAttribute: PropTypes.string,
		})
	),
	isReadOnly: PropTypes.bool,
	isRequired: PropTypes.bool,
};

LookupControl.defaultProps = {
	label: "",
	placeholder: "",
	value: null,
	onChange: null,
	targets: [],
	isReadOnly: false,
	isRequired: false,
};

export default LookupControl;
