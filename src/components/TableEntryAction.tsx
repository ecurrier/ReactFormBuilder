import React, { useState, useRef } from "react";
import TableEntry, { TableColumn, TableSortState, PaginationOptions, TableDataResponse } from "./TableEntry";
import Sidepane from "./Sidepane";
import TableEntryForm from "./TableEntryForm";
import DropdownMenu, { DropdownMenuItem } from "./DropdownMenu";
import { ActionType } from "../constants/enums.js";
import { retrieveRecord } from "../hooks/api/Api";
import { buildFetchXmlForRecord } from "../utilities/FetchXmlBuilder";

interface FieldAction {
	Id: string;
	Name: string;
	Order: number;
	ChildOrder: number;
	Type: number;
	Properties: any;
}

interface FormStep {
	Id: string;
	Name: string;
	EntityLogicalName: string;
	ReferencingAttributeLogicalName: string | null;
	Order: number;
	Actions: FieldAction[];
	Conditions: any[];
}

interface TableEntryActionConfig {
	ChildEntityLogicalName: string;
	RelationshipName: string;
	ValidationMessage?: string;
	CreateEnabled: boolean;
	EditEnabled: boolean;
	DeleteEnabled: boolean;
	ValidationType?: number;
	ReferencingAttribute: string;
	ChildFormSteps: FormStep[];
	ChildViewSteps: FormStep[];
}

export interface TableEntryActionProps {
	config: TableEntryActionConfig;
	parentRecordId?: string;
	formState?: any;
	fetchData: (sort?: TableSortState, pagination?: PaginationOptions) => Promise<TableDataResponse<any>>;
	shouldLoadData?: boolean;
	onSave?: (data: any, recordId?: string) => Promise<void>;
	onDelete?: (recordId: string) => Promise<void>;
	className?: string;
}

/**
 * Check if an ID is a temporary UUID (starts with a specific pattern or doesn't match GUID format)
 */
const isTempId = (id: string): boolean => {
	// Temp IDs are UUIDs but we can distinguish them by checking if they start with our pattern
	// or by checking if they exist in pending records
	return id.startsWith("temp-") || !id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
};

/**
 * Generate a UUID v4 for temporary record IDs
 */
const generateTempId = (): string => {
	return `temp-${crypto.randomUUID()}`;
};

export const TableEntryAction: React.FC<TableEntryActionProps> = ({
	config,
	parentRecordId,
	formState,
	fetchData,
	shouldLoadData = true,
	onSave,
	onDelete,
	className,
}) => {
	const [sidepaneOpen, setSidepaneOpen] = useState(false);
	const [editingRecord, setEditingRecord] = useState<any | null>(null);
	const [isLoadingRecord, setIsLoadingRecord] = useState(false);
	const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
	const tableRef = useRef<any>(null);

	// Create stable empty fetch function
	const emptyFetch = React.useCallback(async () => ({ results: [], totalRecordCount: 0 }), []);

	// Wrap fetchData to merge with pending child records
	const fetchDataWithPending = React.useCallback(
		async (sort?: TableSortState, pagination?: PaginationOptions): Promise<TableDataResponse<any>> => {
			// Get persisted records from API
			const apiResponse = await fetchData(sort, pagination);

			// Get pending records from formState
			const pendingRecords = formState?.getPendingChildRecords(config.ChildEntityLogicalName) || [];

			// Convert pending records to table format
			const pendingTableRecords = pendingRecords.map((pending: any) => ({
				id: pending.id,
				...pending.data,
				_isPending: true,
			}));

			// Merge: pending records go to top
			const allResults = [...pendingTableRecords, ...apiResponse.results];

			return {
				results: allResults,
				totalRecordCount: (apiResponse.totalRecordCount || 0) + pendingRecords.length,
			};
		},
		[fetchData, formState, config.ChildEntityLogicalName]
	);

	// Build columns from ChildViewSteps
	const columns: TableColumn[] = React.useMemo(() => {
		const cols: TableColumn[] = [];

		if (config.ChildViewSteps && config.ChildViewSteps.length > 0) {
			const viewStep = config.ChildViewSteps[0];

			viewStep.Actions.forEach((action) => {
				if (action.Type === ActionType.FieldInput) {
					cols.push({
						key: action.Properties.LogicalName,
						label: action.Properties.Label,
						sortEnabled: true,
						render: (row) => {
							const value = row[action.Properties.LogicalName];
							const isPending = row._isPending;

							// Add visual distinction for pending records
							const content = value !== null && value !== undefined ? String(value) : "";

							if (isPending) {
								return <span style={{ fontStyle: "italic", opacity: 0.8 }}>{content}</span>;
							}

							return content;
						},
					});
				}
			});
		}

		// Add actions column
		if (config.EditEnabled || config.DeleteEnabled) {
			cols.push({
				key: "_actions",
				label: "Actions",
				sortEnabled: false,
				render: (row) => {
					const isPending = row._isPending;
					const menuItems: DropdownMenuItem[] = [];

					// Add "Unsaved" badge for pending records
					const badge = isPending ? (
						<span
							style={{
								marginRight: "8px",
								padding: "2px 6px",
								backgroundColor: "#ffc107",
								color: "#000",
								fontSize: "0.75rem",
								borderRadius: "3px",
								fontWeight: "bold",
							}}>
							Unsaved
						</span>
					) : null;

					if (config.EditEnabled) {
						menuItems.push({
							label: "Edit",
							onClick: () => handleEdit(row),
						});
					}

					if (config.DeleteEnabled) {
						menuItems.push({
							label: "Delete",
							onClick: () => handleDelete(row),
						});
					}

					return (
						<div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
							{badge}
							<div className={`dropdown ${actionMenuOpen === row.id ? "open" : ""}`} style={{ position: "relative", display: "inline-block" }}>
								<button
									type="button"
									className="btn btn-default dropdown-toggle"
									onClick={(e) => {
										e.stopPropagation();
										setActionMenuOpen(actionMenuOpen === row.id ? null : row.id);
									}}
									aria-label="Actions"
									aria-expanded={actionMenuOpen === row.id}>
									⋮
								</button>
								<DropdownMenu
									isOpen={actionMenuOpen === row.id}
									onClose={() => setActionMenuOpen(null)}
									items={menuItems}
									align="right"
									position="side"
								/>
							</div>
						</div>
					);
				},
			});
		}

		return cols;
	}, [config, config.EditEnabled, config.DeleteEnabled]);

	const handleCreate = () => {
		const tempId = generateTempId();
		setEditingRecord({ id: tempId, _isNew: true });
		setSidepaneOpen(true);
	};

	const handleEdit = async (record: any) => {
		const recordId = record.id;

		// Check if this is a pending record
		if (isTempId(recordId)) {
			// Load from pending state
			const pendingRecords = formState?.getPendingChildRecords(config.ChildEntityLogicalName) || [];
			const pendingRecord = pendingRecords.find((p: any) => p.id === recordId);

			if (pendingRecord) {
				setEditingRecord({ id: recordId, ...pendingRecord.data, _isNew: false });
				setSidepaneOpen(true);
			} else {
				console.error("Pending record not found:", recordId);
			}
		} else {
			// Load from API - fetch full record with all fields
			setIsLoadingRecord(true);
			try {
				// Get all field logical names from ChildFormSteps
				const fieldNames = new Set<string>();
				fieldNames.add(`${config.ChildEntityLogicalName}id`); // Add primary key

				config.ChildFormSteps?.forEach((step) => {
					step.Actions?.forEach((action) => {
						if (action.Type === ActionType.FieldInput && action.Properties.LogicalName) {
							fieldNames.add(action.Properties.LogicalName);
						}
					});
				});

				const columns = Array.from(fieldNames);
				const fetchXml = buildFetchXmlForRecord(config.ChildEntityLogicalName, recordId, columns);

				const fullRecord = await retrieveRecord(config.ChildEntityLogicalName, fetchXml);

				if (fullRecord) {
					setEditingRecord({ id: recordId, ...fullRecord, _isNew: false });
					setSidepaneOpen(true);
				} else {
					console.error("Failed to load record:", recordId);
				}
			} catch (error) {
				console.error("Error loading record for edit:", error);
			} finally {
				setIsLoadingRecord(false);
			}
		}
	};

	const handleDelete = async (record: any) => {
		const recordId = record.id;

		if (confirm(`Are you sure you want to delete this record?`)) {
			// Check if this is a pending record
			if (isTempId(recordId)) {
				// Delete from pending state
				const key = `${config.ChildEntityLogicalName}_${recordId}`;
				formState?.deletePendingChildRecord(key);
				tableRef.current?.refresh();
			} else {
				// Delete persisted record via API
				if (onDelete) {
					await onDelete(recordId);
					tableRef.current?.refresh();
				}
			}
		}
	};

	const handleFormSave = async (formData: any) => {
		const recordId = editingRecord?.id;
		const isNew = editingRecord?._isNew || !recordId;

		// Check if this is a pending record (new or unsaved edit)
		if (isTempId(recordId) || isNew) {
			// Save to pending state
			if (formState) {
				const pendingRecord = {
					id: recordId || generateTempId(),
					data: formData,
				};

				const key = `${config.ChildEntityLogicalName}_${pendingRecord.id}`;

				if (isNew) {
					formState.addPendingChildRecord(key, pendingRecord);
				} else {
					formState.updatePendingChildRecord(key, pendingRecord);
				}

				setSidepaneOpen(false);
				setEditingRecord(null);
				tableRef.current?.refresh();
			} else {
				console.error("formState not available");
			}
		} else {
			// Persisted record - save via API
			if (onSave) {
				await onSave(formData, recordId);
				setSidepaneOpen(false);
				setEditingRecord(null);
				tableRef.current?.refresh();
			}
		}
	};

	const handleFormCancel = () => {
		setSidepaneOpen(false);
		setEditingRecord(null);
	};

	return (
		<>
			<TableEntry
				ref={tableRef}
				columns={columns}
				fetchData={shouldLoadData ? fetchDataWithPending : emptyFetch}
				className={className}
				createAction={
					config.CreateEnabled
						? {
								label: "Create",
								onClick: handleCreate,
							}
						: undefined
				}
			/>

			<Sidepane isOpen={sidepaneOpen} onClose={handleFormCancel} title={editingRecord?._isNew ? "Create Record" : "Edit Record"}>
				{isLoadingRecord ? (
					<div style={{ padding: "20px", textAlign: "center" }}>Loading record data...</div>
				) : (
					<TableEntryForm
						config={config}
						initialData={editingRecord}
						parentRecordId={parentRecordId}
						onSave={handleFormSave}
						onCancel={handleFormCancel}
					/>
				)}
			</Sidepane>
		</>
	);
};

export default TableEntryAction;
