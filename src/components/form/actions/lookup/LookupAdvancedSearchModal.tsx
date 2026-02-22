import React, { useEffect, useMemo, useState } from "react";
import TableEntry from "@components/form/TableEntry";
import { DataType, DateTimeFormat } from "@constants/enums";
import { advancedSearchLookup } from "@services/lookupService";
import { formatDateOnlyDisplay, formatDateTimeDisplayParts, normalizeDateTimeFormat } from "@utilities/dateTimeDisplay";
import { resolveEntityDisplayName, resolvePrimaryNameAttributeDisplayName } from "@utilities/metadata";
import type { LookupTargetConfig } from "@services/lookupService";

type LookupColumnConfig = {
	LogicalName: string;
	DataType?: number;
	DateTimeFormat?: string | number;
	DateTimeBehavior?: string;
};

type LookupTarget = LookupTargetConfig & { Columns?: Array<string | LookupColumnConfig> };

type LookupSelection = {
	id: string;
	logicalName: string;
	name?: string;
	navigationProperty?: string;
	attributes?: Record<string, any>;
};

type LookupAdvancedSearchModalProps = {
	isOpen: boolean;
	onClose: () => void;
	onSelect: (selected: LookupSelection) => void;
	targets: LookupTarget[];
	selectedTarget?: LookupTarget | null;
	onTargetChange: (entityLogicalName: string) => void;
	searchPlaceholder?: string;
};

// TO-DO: Need to handle display names better/Lookup columns in general
const resolveDisplayName = (attributeName: string): string => {
	if (!attributeName) {
		return "";
	}

	if (attributeName === "createdon") {
		return "Created On";
	}

	return resolvePrimaryNameAttributeDisplayName(attributeName);
};

const normalizeColumn = (column: string | LookupColumnConfig): LookupColumnConfig => {
	if (typeof column === "string") {
		return { LogicalName: column };
	}

	return column;
};

const renderLookupCellValue = (row: Record<string, unknown>, column: LookupColumnConfig): React.ReactNode => {
	const value = row[column.LogicalName];
	if (value === null || value === undefined || value === "") {
		return "";
	}

	if (column.DataType === DataType.DateTime) {
		const normalizedFormat = normalizeDateTimeFormat(column.DateTimeFormat);

		if (normalizedFormat === DateTimeFormat.DateAndTime) {
			const parts = formatDateTimeDisplayParts(value, column.DateTimeBehavior);
			if (!parts) {
				return String(value);
			}

			return (
				<span className="datetime-display">
					<span>{parts.date}</span>
					<span className="text-muted ml-1">{parts.time}</span>
				</span>
			);
		}

		return formatDateOnlyDisplay(value);
	}

	return String(value);
};

export const LookupAdvancedSearchModal = ({
	isOpen,
	onClose,
	onSelect,
	targets,
	selectedTarget,
	onTargetChange,
	searchPlaceholder = "Search across the view columns...",
}: LookupAdvancedSearchModalProps) => {
	const [query, setQuery] = useState("");

	useEffect(() => {
		if (!isOpen) {
			setQuery("");
		}
	}, [isOpen]);

	const normalizedColumns = useMemo(() => (selectedTarget?.Columns || []).map(normalizeColumn), [selectedTarget]);

	const columns = useMemo(() => {
		const baseColumns = normalizedColumns.map((column) => ({
			key: column.LogicalName,
			label: resolveDisplayName(column.LogicalName),
			sortEnabled: true,
			render: (row: Record<string, unknown>) => renderLookupCellValue(row, column),
		}));

		return [
			...baseColumns,
			{
				key: "__select__",
				label: "Select",
				sortEnabled: false,
				render: (row) => (
					<button type="button" className="btn btn-primary btn-sm" onClick={() => onSelect(row._lookupResult)}>
						Select
					</button>
				),
				className: "text-right",
			},
		];
	}, [normalizedColumns, onSelect]);

	const fetchData = async (sort, pagination) => {
		if (!selectedTarget) {
			return { results: [], totalRecordCount: 0 };
		}

		const lookupTarget = {
			...selectedTarget,
			...(selectedTarget.Attributes ? { Attributes: selectedTarget.Attributes } : normalizedColumns.length > 0 ? { Attributes: normalizedColumns } : {}),
		};

		const response = await advancedSearchLookup(lookupTarget, query, pagination, sort?.key);
		const rows = response.results.map((result) => ({
			id: result.id,
			...(result.attributes ?? {}),
			_lookupResult: result,
		}));

		return {
			results: rows,
			totalRecordCount: response.totalRecordCount,
		};
	};

	if (!isOpen) {
		return null;
	}

	return (
		<>
			<div className="modal-backdrop fade in"></div>
			<div className="modal modal-lookup in entity-lookup" role="dialog" style={{ display: "block" }} aria-modal="true">
				<div className="modal-dialog modal-lg">
					<div className="modal-content">
						<div className="modal-header">
							<h2 className="modal-title">Advanced Search</h2>
							<button type="button" className="close" aria-label="Close" onClick={onClose}>
								<span aria-hidden="true">&times;</span>
							</button>
						</div>
						<div className="modal-body">
							{targets.length > 1 && (
								<div className="lookup-target-selector lookup-target-selector--modal mb-3">
									{targets.map((target) => (
										<button
											key={target.EntityLogicalName}
											type="button"
											className={`btn btn-sm ${
												selectedTarget?.EntityLogicalName === target.EntityLogicalName ? "btn-primary" : "btn-default"
											}`}
											onClick={() => onTargetChange(target.EntityLogicalName)}
											role="tab"
											aria-selected={selectedTarget?.EntityLogicalName === target.EntityLogicalName}>
											{resolveEntityDisplayName(target.EntityLogicalName)}
										</button>
									))}
								</div>
							)}
							<div className="toolbar-actions mb-3" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
								<div className="input-group entitylist-search" style={{ flex: 1 }}>
									<input
										type="text"
										className="form-control"
										value={query}
										placeholder={searchPlaceholder}
										onChange={(event) => setQuery(event.target.value)}
									/>
								</div>
							</div>
							<TableEntry
								columns={columns}
								fetchData={async (sort, pagination) => {
									const data = await fetchData(sort, pagination);
									return {
										...data,
										results: data.results.map((row) => ({
											...row,
											__select__: "",
										})),
									};
								}}
								className="view-grid"
								pagination={{ pageSize: 10, controlSize: "sm" }}
							/>
						</div>
						<div className="modal-footer">
							<button type="button" className="btn btn-default" onClick={onClose}>
								Close
							</button>
						</div>
					</div>
				</div>
			</div>
		</>
	);
};

export default LookupAdvancedSearchModal;
