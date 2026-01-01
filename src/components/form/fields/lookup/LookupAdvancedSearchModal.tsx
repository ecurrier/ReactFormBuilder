import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import TableEntry from "@components/form/TableEntry";
import { advancedSearchLookup } from "@services/lookupService";

const formatLabel = (value) => {
	if (!value) {
		return "";
	}

	return value
		.replace(/_/g, " ")
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.replace(/\b\w/g, (match) => match.toUpperCase());
};

const LookupAdvancedSearchModal = ({ isOpen, onClose, onSelect, targets, selectedTarget, onTargetChange, searchPlaceholder }) => {
	const [query, setQuery] = useState("");

	useEffect(() => {
		if (!isOpen) {
			setQuery("");
		}
	}, [isOpen]);

	const columns = useMemo(() => {
		const baseColumns = (selectedTarget?.Columns || []).map((column) => ({
			key: column,
			label: formatLabel(column),
			sortEnabled: true,
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
	}, [selectedTarget, onSelect]);

	const fetchData = async (sort, pagination) => {
		if (!selectedTarget) {
			return { results: [], totalRecordCount: 0 };
		}

		const response = await advancedSearchLookup(selectedTarget, query, pagination, sort?.key);
		const rows = response.results.map((result) => ({
			id: result.id,
			...result.columns,
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
							<div className="toolbar-actions mb-3" style={{ display: "flex", gap: "12px", alignItems: "center" }}>
								{targets.length > 1 && (
									<select
										className="form-control"
										value={selectedTarget?.EntityLogicalName || ""}
										onChange={(event) => onTargetChange(event.target.value)}>
										{targets.map((target) => (
											<option key={target.EntityLogicalName} value={target.EntityLogicalName}>
												{formatLabel(target.EntityLogicalName)}
											</option>
										))}
									</select>
								)}
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

LookupAdvancedSearchModal.propTypes = {
	isOpen: PropTypes.bool.isRequired,
	onClose: PropTypes.func.isRequired,
	onSelect: PropTypes.func.isRequired,
	targets: PropTypes.arrayOf(
		PropTypes.shape({
			EntityLogicalName: PropTypes.string.isRequired,
			Columns: PropTypes.arrayOf(PropTypes.string),
		})
	).isRequired,
	selectedTarget: PropTypes.shape({
		EntityLogicalName: PropTypes.string.isRequired,
		Columns: PropTypes.arrayOf(PropTypes.string),
	}),
	onTargetChange: PropTypes.func.isRequired,
	searchPlaceholder: PropTypes.string,
};

LookupAdvancedSearchModal.defaultProps = {
	searchPlaceholder: "Search across the view columns...",
};

export default LookupAdvancedSearchModal;
