import { useState, useMemo } from "react";
import { useFormStateContext } from "@hooks";

export const FormStatePanel = () => {
	const formState = useFormStateContext();
	const [filter, setFilter] = useState("");
	const [expandedSection, setExpandedSection] = useState<string | null>("fields");

	// Build field entries from metadata (all registered fields) + their current values
	const fieldEntries = useMemo(() => {
		return Object.keys(formState.metadata).map((path) => ({
			path,
			value: formState.getFieldValue(path),
			isDirty: formState.isFieldDirty(path),
		}));
	}, [formState.metadata, formState.dirtyFields, formState.getFieldValue, formState.isFieldDirty]);

	const filteredFields = useMemo(() => {
		if (!filter) return fieldEntries;
		const lower = filter.toLowerCase();
		return fieldEntries.filter((f) => f.path.toLowerCase().includes(lower));
	}, [fieldEntries, filter]);

	const dirtyCount = formState.dirtyFields.length;

	const toggleSection = (section: string) => {
		setExpandedSection(expandedSection === section ? null : section);
	};

	const renderValue = (value: any): string => {
		if (value === null) return "null";
		if (value === undefined) return "undefined";
		if (typeof value === "object") return JSON.stringify(value);
		return String(value);
	};

	return (
		<div>
			{/* Summary */}
			<div className="d-flex gap-2 mb-2">
				<span className="badge bg-primary">{fieldEntries.length} fields</span>
				<span className={`badge ${dirtyCount > 0 ? "bg-warning text-dark" : "bg-secondary"}`}>{dirtyCount} dirty</span>
				{formState.hasChanges && <span className="badge bg-info">unsaved changes</span>}
			</div>

			{/* Filter */}
			<input
				type="text"
				className="form-control form-control-sm mb-2"
				placeholder="Filter fields..."
				value={filter}
				onChange={(e) => setFilter(e.target.value)}
			/>

			{/* Fields Section */}
			<div className="mb-2">
				<button className="btn btn-sm btn-outline-secondary w-100 text-start" onClick={() => toggleSection("fields")}>
					{expandedSection === "fields" ? "\u25BC" : "\u25B6"} Fields ({filteredFields.length})
				</button>
				{expandedSection === "fields" && (
					<div
						style={{
							maxHeight: 300,
							overflow: "auto",
							fontSize: "0.8rem",
							fontFamily: "monospace",
						}}
						className="border rounded p-2 mt-1">
						{filteredFields.length === 0 ? (
							<em className="text-muted">No fields registered</em>
						) : (
							filteredFields.map((field) => (
								<div
									key={field.path}
									className={`d-flex justify-content-between py-1 border-bottom ${field.isDirty ? "bg-warning bg-opacity-10" : ""}`}>
									<span className="text-truncate" style={{ maxWidth: "60%" }} title={field.path}>
										{field.isDirty && <span className="text-warning me-1">*</span>}
										{field.path}
									</span>
									<span className="text-muted text-truncate" style={{ maxWidth: "38%" }} title={renderValue(field.value)}>
										{renderValue(field.value)}
									</span>
								</div>
							))
						)}
					</div>
				)}
			</div>

			{/* Dirty Fields Section */}
			{dirtyCount > 0 && (
				<div className="mb-2">
					<button className="btn btn-sm btn-outline-warning w-100 text-start" onClick={() => toggleSection("dirty")}>
						{expandedSection === "dirty" ? "\u25BC" : "\u25B6"} Dirty Fields ({dirtyCount})
					</button>
					{expandedSection === "dirty" && (
						<div
							style={{ maxHeight: 200, overflow: "auto", fontSize: "0.8rem", fontFamily: "monospace" }}
							className="border border-warning rounded p-2 mt-1">
							{formState.dirtyFields.map((path) => (
								<div key={path} className="py-1 border-bottom">
									<strong>{path}</strong>: {renderValue(formState.getFieldValue(path))}
								</div>
							))}
						</div>
					)}
				</div>
			)}

			{/* Entity Nodes Section */}
			<div className="mb-2">
				<button className="btn btn-sm btn-outline-secondary w-100 text-start" onClick={() => toggleSection("nodes")}>
					{expandedSection === "nodes" ? "\u25BC" : "\u25B6"} Entity Nodes
				</button>
				{expandedSection === "nodes" && (
					<div style={{ maxHeight: 200, overflow: "auto", fontSize: "0.75rem", fontFamily: "monospace" }} className="border rounded p-2 mt-1">
						<pre className="mb-0">{JSON.stringify(formState.nodesById, null, 2)}</pre>
					</div>
				)}
			</div>

			{/* Reset Button */}
			<button className="btn btn-sm btn-outline-danger w-100" onClick={() => formState.resetForm()}>
				Reset Form State
			</button>
		</div>
	);
};
