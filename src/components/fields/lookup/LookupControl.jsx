import React, { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import LookupAdvancedSearchModal from "./LookupAdvancedSearchModal";
import { searchLookupQuick } from "../../../services/lookupService";

const formatLabel = (value) => {
	if (!value) {
		return "";
	}

	return value
		.replace(/_/g, " ")
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.replace(/\b\w/g, (match) => match.toUpperCase());
};

export const LookupControl = ({ inputId, label, placeholder, value, onChange, targets, isReadOnly, isRequired }) => {
	const [searchText, setSearchText] = useState("");
	const [results, setResults] = useState([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
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
		if (!isDropdownOpen || !selectedTarget || isReadOnly) {
			return;
		}

		const trimmed = searchText.trim();
		const timer = setTimeout(async () => {
			setIsLoading(true);
			try {
				const matches = await searchLookupQuick(selectedTarget, trimmed);
				setResults(matches);
			} catch (error) {
				console.error("Failed to fetch lookup results:", error);
				setResults([]);
			} finally {
				setIsLoading(false);
			}
		}, 300);

		return () => clearTimeout(timer);
	}, [searchText, selectedTarget, isDropdownOpen, isReadOnly]);

	useEffect(() => {
		const handleClickOutside = (event) => {
			if (containerRef.current && !containerRef.current.contains(event.target)) {
				setIsDropdownOpen(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const handleInputChange = (event) => {
		setSearchText(event.target.value);
		if (!isDropdownOpen) {
			setIsDropdownOpen(true);
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
		setIsDropdownOpen(false);
	};

	const handleClear = () => {
		setSearchText("");
		setResults([]);
		onChange?.(null);
	};

	const handleOpenAdvanced = () => {
		setIsAdvancedOpen(true);
		setIsDropdownOpen(false);
	};

	const handleAdvancedSelect = (result) => {
		if (!result) {
			return;
		}
		handleSelectResult(result);
		setIsAdvancedOpen(false);
	};

	const hasMultipleTargets = targets && targets.length > 1;

	return (
		<div className="entity-lookup" ref={containerRef}>
			{hasMultipleTargets && (
				<div className="lookup-target-selector" style={{ marginBottom: "8px" }}>
					<label className="control-label" htmlFor={`${inputId}-target`}>
						Search entity
					</label>
					<select
						id={`${inputId}-target`}
						className="form-control"
						value={selectedTarget?.EntityLogicalName || ""}
						onChange={(event) => setSelectedTargetName(event.target.value)}
						disabled={isReadOnly}>
						{targets.map((target) => (
							<option key={target.EntityLogicalName} value={target.EntityLogicalName}>
								{formatLabel(target.EntityLogicalName)}
							</option>
						))}
					</select>
				</div>
			)}
			<div className="input-group">
				<input
					id={inputId}
					type="text"
					className="form-control lookup"
					placeholder={placeholder}
					value={searchText}
					onChange={handleInputChange}
					onFocus={() => setIsDropdownOpen(true)}
					readOnly={isReadOnly}
					required={isRequired}
					aria-label={label}
					autoComplete="off"
				/>
				<span className="input-group-btn">
					<button type="button" className="btn btn-default" onClick={handleOpenAdvanced} disabled={isReadOnly}>
						Advanced search
					</button>
				</span>
				{value?.id && !isReadOnly && (
					<span className="input-group-btn">
						<button type="button" className="btn btn-default" onClick={handleClear} title="Remove value">
							×
						</button>
					</span>
				)}
			</div>

			{isDropdownOpen && !isReadOnly && (
				<div className="lookup-results" role="listbox" style={{ position: "relative" }}>
					{isLoading ? (
						<div className="help-block">Searching...</div>
					) : results.length > 0 ? (
						<ul className="list-group" style={{ marginTop: "4px" }}>
							{results.map((result) => (
								<li key={result.id} className="list-group-item">
									<button type="button" className="btn btn-link" onClick={() => handleSelectResult(result)}>
										{result.name}
									</button>
								</li>
							))}
						</ul>
					) : (
						<div className="help-block">No results found.</div>
					)}
				</div>
			)}

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
