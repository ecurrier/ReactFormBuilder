import React, { useState, useRef } from "react";
import TableEntry, { TableColumn, TableDataResponse, PaginationOptions, TableSortState } from "@components/form/TableEntry";
import TableEntryForm from "@components/form/TableEntryForm";
import DropdownMenu, { DropdownMenuItem } from "@components/common/DropdownMenu";
import Sidepane from "@components/common/Sidepane";
import { ActionType, DataType } from "@constants/enums";
import { retrieveRecord } from "@api/Api";
import { buildFetchXmlForRecord } from "@utilities/FetchXmlBuilder";
import { resolvePrimaryIdAttribute } from "@utilities/entityMetadata";
import { generateTempId, isTempId } from "@utilities/Common";

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
	ReferencingNavigationProperty?: string | null;
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
	ReferencingNavigationProperty?: string;
	ChildFormSteps: FormStep[];
	ChildViewSteps: FormStep[];
}

export interface TableEntryActionProps {
	config: TableEntryActionConfig;
	parentRecordId?: string;
	parentEntityName?: string;
	formState?: any;
	fetchData: (sort?: TableSortState, pagination?: PaginationOptions) => Promise<TableDataResponse<any>>;
	shouldLoadData?: boolean;
	onSave?: (entityName: string, data: any, recordId?: string, referencingAttribute?: string, referencingNavigationProperty?: string | null) => Promise<void>;
	onDelete?: (entityName: string, recordId: string) => Promise<void>;
	className?: string;
}

const getFormattedValue = (row: Record<string, any>, logicalName: string): string | undefined => {
	const formattedKey = `${logicalName}@OData.Community.Display.V1.FormattedValue`;
	if (row[formattedKey]) {
		return row[formattedKey];
	}

	const altFormattedKey = `_${logicalName}_value@OData.Community.Display.V1.FormattedValue`;
	if (row[altFormattedKey]) {
		return row[altFormattedKey];
	}

	return undefined;
};

const getLookupLogicalName = (row: Record<string, any>, logicalName: string, fallback?: string): string | undefined => {
	const logicalNameKey = `${logicalName}@Microsoft.Dynamics.CRM.lookuplogicalname`;
	if (row[logicalNameKey]) {
		return row[logicalNameKey];
	}

	const altLogicalNameKey = `_${logicalName}_value@Microsoft.Dynamics.CRM.lookuplogicalname`;
	if (row[altLogicalNameKey]) {
		return row[altLogicalNameKey];
	}

	return fallback;
};

const normalizeLookupValue = (row: Record<string, any>, logicalName: string, fallbackLogicalName?: string) => {
	const value = row[logicalName];
	const altValueKey = `_${logicalName}_value`;
	const rawValue = value ?? row[altValueKey];

	if (value && typeof value === "object") {
		if (!value.name) {
			const formatted = getFormattedValue(row, logicalName);
			if (formatted) {
				return { ...value, name: formatted };
			}
		}
		return value;
	}

	const formatted = getFormattedValue(row, logicalName);
	if (formatted && rawValue) {
		return {
			id: rawValue,
			logicalName: getLookupLogicalName(row, logicalName, fallbackLogicalName),
			name: formatted,
		};
	}

	if (rawValue) {
		return {
			id: rawValue,
			logicalName: getLookupLogicalName(row, logicalName, fallbackLogicalName),
			name: formatted,
		};
	}

	return value;
};

const getDisplayValue = (row: Record<string, any>, logicalName: string): string => {
	const value = row[logicalName];
	if (value && typeof value === "object") {
		if (value.name) {
			return String(value.name);
		}
		if (value.id) {
			return String(value.id);
		}
		return "";
	}

	const formatted = getFormattedValue(row, logicalName);
	if (formatted) {
		return String(formatted);
	}

	return value !== null && value !== undefined ? String(value) : "";
};

const resolveRecordId = (row: Record<string, any> | null | undefined, entityName?: string): string | undefined => {
	if (!row) {
		return undefined;
	}

	if (row.id && typeof row.id === "string") {
		return row.id;
	}

	if (entityName) {
		const primaryKey = resolvePrimaryIdAttribute(entityName);
		const primaryValue = row[primaryKey];
		if (typeof primaryValue === "string") {
			return primaryValue;
		}
	}

	const candidate = Object.entries(row).find(([key, value]) => {
		if (typeof value !== "string") {
			return false;
		}
		if (!guidPattern.test(value)) {
			return false;
		}
		if (key.startsWith("_") || key.includes("@")) {
			return false;
		}
		return key.toLowerCase().endsWith("id");
	});

	return candidate?.[1];
};

export const TableEntryAction: React.FC<TableEntryActionProps> = ({
	config,
	parentRecordId,
	parentEntityName,
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
	const getPendingChildRecords = formState?.getPendingChildRecords;

	const lookupFieldInfo = React.useMemo(() => {
		const info: Record<string, string | undefined> = {};
		const viewStep = config.ChildViewSteps?.[0];
		if (!viewStep?.Actions) {
			return info;
		}

		viewStep.Actions.forEach((action) => {
			if (action.Type === ActionType.FieldInput && action.Properties?.LogicalName && action.Properties?.DataType === DataType.Lookup) {
				info[action.Properties.LogicalName] = action.Properties.Targets?.[0]?.EntityLogicalName;
			}
		});

		return info;
	}, [config.ChildViewSteps]);

	const lookupFieldNames = React.useMemo(() => Object.keys(lookupFieldInfo), [lookupFieldInfo]);

	// Create stable empty fetch function
	const emptyFetch = React.useCallback(async () => ({ results: [], totalRecordCount: 0 }), []);

	// Wrap fetchData to merge with pending child records
	const fetchDataWithPending = React.useCallback(
		async (sort?: TableSortState, pagination?: PaginationOptions): Promise<TableDataResponse<any>> => {
			// Get persisted records from API
			const apiResponse = await fetchData(sort, pagination);
			const normalizedResults = apiResponse.results.map((row) => {
				const updated = { ...row };
				if (lookupFieldNames.length > 0) {
					lookupFieldNames.forEach((logicalName) => {
						updated[logicalName] = normalizeLookupValue(updated, logicalName, lookupFieldInfo[logicalName]);
					});
				}

				const resolvedId = resolveRecordId(updated, config.ChildEntityLogicalName);
				if (resolvedId && updated.id !== resolvedId) {
					updated.id = resolvedId;
				}

				return updated;
			});

			// Get pending records from formState
			const pendingRecords = getPendingChildRecords ? getPendingChildRecords(config.ChildEntityLogicalName) : [];

			// Convert pending records to table format
			const pendingTableRecords = pendingRecords.map((pending: any) => ({
				id: pending.id,
				...pending.data,
				_isPending: true,
			}));

			// Merge: pending records go to top
			const allResults = [...pendingTableRecords, ...normalizedResults];

			return {
				results: allResults,
				totalRecordCount: (apiResponse.totalRecordCount || 0) + pendingRecords.length,
			};
		},
		[fetchData, getPendingChildRecords, config.ChildEntityLogicalName, lookupFieldInfo, lookupFieldNames]
	);

	const pendingCount = getPendingChildRecords ? getPendingChildRecords(config.ChildEntityLogicalName).length : 0;

	React.useEffect(() => {
		if (!shouldLoadData) {
			return;
		}

		tableRef.current?.refresh();
	}, [pendingCount, shouldLoadData]);

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
							const isPending = row._isPending;
							const content = getDisplayValue(row, action.Properties.LogicalName);

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
					const rowId = resolveRecordId(row, config.ChildEntityLogicalName);
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
							<div className={`dropdown ${actionMenuOpen === rowId ? "open" : ""}`} style={{ position: "relative", display: "inline-block" }}>
								<button
									type="button"
									className="btn btn-default dropdown-toggle"
									onClick={(e) => {
										e.stopPropagation();
										setActionMenuOpen(actionMenuOpen === rowId ? null : rowId || null);
									}}
									aria-label="Actions"
									aria-expanded={actionMenuOpen === rowId}>
									...
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
	}, [actionMenuOpen, config, config.EditEnabled, config.DeleteEnabled]);

	const handleCreate = () => {
		const tempId = generateTempId();
		setEditingRecord({ id: tempId, _isNew: true });
		setSidepaneOpen(true);
	};

	async function handleEdit(record: any) {
		const recordId = resolveRecordId(record, config.ChildEntityLogicalName);

		if (!recordId) {
			console.error("Missing record ID for edit:", record);
			return;
		}

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
			setEditingRecord({ id: recordId, ...record, _isNew: false });
			setSidepaneOpen(true);
			setIsLoadingRecord(true);
			try {
				// Get all field logical names from ChildFormSteps
				const fieldNames = new Set<string>();
				const primaryKey = resolvePrimaryIdAttribute(config.ChildEntityLogicalName);
				fieldNames.add(primaryKey); // Add primary key

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
					const resolvedId = recordId || fullRecord[primaryKey];
					setEditingRecord({ id: resolvedId, ...fullRecord, _isNew: false });
				} else {
					console.error("Failed to load record:", recordId);
				}
			} catch (error) {
				console.error("Error loading record for edit:", error);
			} finally {
				setIsLoadingRecord(false);
			}
		}
	}

	async function handleDelete(record: any) {
		const recordId = resolveRecordId(record, config.ChildEntityLogicalName);

		if (!recordId) {
			console.error("Missing record ID for delete:", record);
			return;
		}

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
					await onDelete(config.ChildEntityLogicalName, recordId);
					tableRef.current?.refresh();
				}
			}
		}
	}

	const handleFormSave = async (formData: any) => {
		const recordId = editingRecord?.id;
		const isNew = editingRecord?._isNew || !recordId;
		const resolvedParentEntityName = parentEntityName || formState?.primaryEntityName;
		const { id, _isNew, _isPending, ...cleanedFormData } = formData ?? {};

		// Check if this is a pending record (new or unsaved edit)
		if (isTempId(recordId) || isNew) {
			// Save to pending state
			if (formState) {
				const pendingRecordId = recordId || generateTempId();
				const pendingRecord = {
					id: pendingRecordId,
					entityName: config.ChildEntityLogicalName,
					referencingAttribute: config.ReferencingAttribute,
					referencingNavigationProperty: config.ReferencingNavigationProperty || config.ReferencingAttribute,
					parentEntityName: resolvedParentEntityName,
					data: cleanedFormData,
					isNew,
				};

				const key = `${config.ChildEntityLogicalName}_${pendingRecordId}`;

				if (isNew) {
					formState.addPendingChildRecord(pendingRecord);
				} else {
					formState.updatePendingChildRecord(key, cleanedFormData);
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
				await onSave(config.ChildEntityLogicalName, cleanedFormData, recordId, config.ReferencingAttribute, config.ReferencingNavigationProperty);
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
