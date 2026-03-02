import React, { useEffect, useMemo, useRef, useState } from "react";
import { quickSearchLookup } from "@services/lookupService";
import { resolveEntityDisplayName } from "@/utilities/metadata";
import type { LookupTargetConfig } from "@services/lookupService";

type LookupTarget = LookupTargetConfig & {
	Columns?: Array<
		| string
		| {
				LogicalName: string;
				DataType?: number;
				DateTimeFormat?: string | number;
				DateTimeBehavior?: string;
		  }
	>;
};

type LookupSelection = {
	id: string;
	logicalName: string;
	name?: string;
	navigationProperty?: string;
};

type CompactLookupControlProps = {
	inputId: string;
	placeholder?: string;
	value?: LookupSelection | null;
	onChange?: (nextValue: LookupSelection | null) => void;
	targets?: LookupTarget[];
	isReadOnly?: boolean;
	isRequired?: boolean;
};

export const CompactLookupControl = ({
	inputId,
	placeholder = "",
	value = null,
	onChange,
	targets = [],
	isReadOnly = false,
	isRequired = false,
}: CompactLookupControlProps) => {
	const [searchText, setSearchText] = useState("");
	const [results, setResults] = useState<LookupSelection[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isOpen, setIsOpen] = useState(false);
	const [selectedTargetName, setSelectedTargetName] = useState(targets?.[0]?.EntityLogicalName || "");
	const containerRef = useRef<HTMLDivElement | null>(null);

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
		if (!isOpen || !selectedTarget || isReadOnly) {
			return;
		}

		setResults([]);
		setIsLoading(true);

		const timer = setTimeout(async () => {
			try {
				const lookupTarget = {
					...selectedTarget,
					...(selectedTarget.Attributes
						? { Attributes: selectedTarget.Attributes }
						: selectedTarget.Columns && selectedTarget.Columns.length > 0
							? { Attributes: selectedTarget.Columns }
							: {}),
				};

				const matches = await quickSearchLookup(lookupTarget, searchText.trim());
				setResults(matches);
			} catch (error) {
				console.error("Failed to fetch compact lookup results:", error);
				setResults([]);
			} finally {
				setIsLoading(false);
			}
		}, 300);

		return () => clearTimeout(timer);
	}, [searchText, selectedTarget, isOpen, isReadOnly]);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
				setIsOpen(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		setSearchText(event.target.value);
		if (!isOpen) {
			setIsOpen(true);
		}
		if (!event.target.value) {
			onChange?.(null);
		}
	};

	const resolveNavigationProperty = (result: LookupSelection) => {
		if (!targets || targets.length === 0) {
			return undefined;
		}
		const targetMatch = targets.find((target) => target.EntityLogicalName === result.logicalName);
		return targetMatch?.NavigationProperty;
	};

	const handleSelectResult = (result: LookupSelection) => {
		const navigationProperty = resolveNavigationProperty(result);
		onChange?.({
			id: result.id,
			logicalName: result.logicalName,
			name: result.name,
			navigationProperty,
		});
		setSearchText(result.name || "");
		setIsOpen(false);
	};

	const handleClear = () => {
		setSearchText("");
		setResults([]);
		onChange?.(null);
	};

	const hasMultipleTargets = targets && targets.length > 1;
	const showSkeleton = isLoading && results.length === 0;

	return (
		<div className="compact-lookup-container" ref={containerRef}>
			<div className="compact-lookup-input-wrapper">
				<input
					id={inputId}
					type="text"
					className="form-control compact-lookup-input"
					placeholder={placeholder}
					value={searchText}
					onChange={handleInputChange}
					onFocus={() => setIsOpen(true)}
					readOnly={isReadOnly}
					required={isRequired}
					autoComplete="off"
				/>
				{value?.id && !isReadOnly && (
					<button type="button" className="compact-lookup-clear" onClick={handleClear} title="Remove value">
						<span className="glyphicon glyphicon-remove" aria-hidden="true"></span>
					</button>
				)}
			</div>
			{isOpen && !isReadOnly && (
				<div className="compact-lookup-results" role="listbox">
					{hasMultipleTargets && (
						<div className="compact-lookup-target-selector">
							{targets.map((target, index) => (
								<button
									key={`target-${target.EntityLogicalName}-${index}`}
									type="button"
									className={`btn btn-xs ${selectedTargetName === target.EntityLogicalName ? "btn-primary" : "btn-default"}`}
									onClick={() => setSelectedTargetName(target.EntityLogicalName)}
									role="tab"
									aria-selected={selectedTargetName === target.EntityLogicalName}>
									{resolveEntityDisplayName(target.EntityLogicalName)}
								</button>
							))}
						</div>
					)}
					{showSkeleton && (
						<ul className="list-unstyled compact-lookup-skeleton" aria-hidden="true">
							{Array.from({ length: 3 }).map((_, index) => (
								<li key={`skeleton-${index}`} className="compact-lookup-skeleton-row">
									<span className="skeleton skeleton--text skeleton--w-80"></span>
								</li>
							))}
						</ul>
					)}
					{results.length > 0 && (
						<ul className="list-unstyled mb-0" role="listbox" id={`${inputId}-compact-results`}>
							{results.map((result) => (
								<li
									key={result.id}
									role="option"
									aria-selected={value?.id === result.id}
									className={`compact-lookup-result-item ${value?.id === result.id ? "focused" : ""}`}
									onClick={() => handleSelectResult(result)}
									onMouseDown={(e) => e.preventDefault()}>
									<span className="compact-lookup-result-name">{result.name}</span>
									{hasMultipleTargets && (
										<span className="badge compact-lookup-entity-badge">{resolveEntityDisplayName(result.logicalName)}</span>
									)}
								</li>
							))}
						</ul>
					)}
					{!isLoading && results.length === 0 && searchText.trim() && <div className="compact-lookup-no-results">No results found</div>}
				</div>
			)}
		</div>
	);
};

export default CompactLookupControl;
