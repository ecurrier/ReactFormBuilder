import React, { useState, useRef } from "react";
import TableEntry, { TableColumn, TableDataResponse, PaginationOptions, TableSortState } from "@components/form/TableEntry";
import { TableEntryForm, LoadingIndicator, Sidepane, ConfirmationModal, Badge } from "@components";
import DropdownMenu, { DropdownMenuItem } from "@components/common/DropdownMenu";
import { ActionType, DataType } from "@constants/enums";
import { retrieveRecord } from "@/services/api/Api";
import { buildFetchXmlForRecord, resolvePrimaryIdAttribute, generateTempId, isTempId } from "@utilities";

const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

const collectLookupFieldInfo = (steps: FormStep[] | undefined): Record<string, string | undefined> => {
	const info: Record<string, string | undefined> = {};
	if (!steps) {
		return info;
	}

	steps.forEach((step) => {
		step.Actions?.forEach((action) => {
			if (action.Type === ActionType.FieldInput && action.Properties?.LogicalName && action.Properties?.DataType === DataType.Lookup) {
				info[action.Properties.LogicalName] = action.Properties.Targets?.[0]?.EntityLogicalName;
			}
		});
	});

	return info;
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

const normalizeLookupFields = (row: Record<string, any>, lookupInfo: Record<string, string | undefined>) => {
	const normalized = { ...row };
	Object.keys(lookupInfo).forEach((logicalName) => {
		normalized[logicalName] = normalizeLookupValue(normalized, logicalName, lookupInfo[logicalName]);
	});

	return normalized;
};

export const TableEntryAction: React.FC<TableEntryActionProps> = ({
	config,
	parentRecordId,
	parentEntityName,
	formState,
	fetchData,
	shouldLoadData = true,
	onDelete,
	className,
}) => {
	const [sidepaneOpen, setSidepaneOpen] = useState(false);
	const [editingRecord, setEditingRecord] = useState<any | null>(null);
	const [isLoadingRecord, setIsLoadingRecord] = useState(false);
	const [deleteRecord, setDeleteRecord] = useState<any | null>(null);
	// TO-DO: More robust validation/error handling
	const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
	const tableRef = useRef<any>(null);
	const getChildNodes = formState?.getChildNodes;

	const lookupFieldInfo = React.useMemo(() => {
		const viewStep = config.ChildViewSteps?.[0];
		return collectLookupFieldInfo(viewStep ? [viewStep] : []);
	}, [config.ChildViewSteps]);

	const lookupFieldNames = React.useMemo(() => Object.keys(lookupFieldInfo), [lookupFieldInfo]);
	const lookupFormFieldInfo = React.useMemo(() => collectLookupFieldInfo(config.ChildFormSteps), [config.ChildFormSteps]);

	// Create stable empty fetch function
	const emptyFetch = React.useCallback(async () => ({ results: [], totalRecordCount: 0 }), []);

	// Wrap fetchData to merge with pending child records
	const fetchDataWithPending = React.useCallback(
		async (sort?: TableSortState, pagination?: PaginationOptions): Promise<TableDataResponse<any>> => {
			// Get persisted records from API
			const apiResponse = await fetchData(sort, pagination);
			const normalizedResults = apiResponse.results.map((row) => {
				const updated = lookupFieldNames.length > 0 ? normalizeLookupFields(row, lookupFieldInfo) : { ...row };

				const resolvedId = resolveRecordId(updated, config.ChildEntityLogicalName);
				if (resolvedId && updated.id !== resolvedId) {
					updated.id = resolvedId;
				}

				return updated;
			});

			// Get pending records from formState
			const pendingRecords = getChildNodes ? getChildNodes(config.ChildEntityLogicalName).filter((node: any) => !node.isPersisted) : [];

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
		[fetchData, getChildNodes, config.ChildEntityLogicalName, lookupFieldInfo, lookupFieldNames]
	);

	const pendingCount = getChildNodes ? getChildNodes(config.ChildEntityLogicalName).filter((node: any) => !node.isPersisted).length : 0;

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

			// Add view columns
			viewStep.Actions.forEach((action, actionIndex) => {
				if (action.Type === ActionType.FieldInput) {
					const isFirstColumn = cols.length === 0;
					cols.push({
						key: action.Properties.LogicalName,
						label: action.Properties.Label,
						sortEnabled: true,
						render: (row) => {
							const isPending = row._isPending;
							const content = getDisplayValue(row, action.Properties.LogicalName);

							if (isPending) {
								return (
									<>
										<span style={{ fontStyle: "italic", opacity: 0.8 }}>{content}</span>
										{isFirstColumn && (
											<>
												<span className="ml-2">
													<Badge type="warning" content="Pending" />
												</span>
											</>
										)}
									</>
								);
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
				width: "8%",
				render: (row) => {
					const rowId = resolveRecordId(row, config.ChildEntityLogicalName);
					const isPending = row._isPending;
					const menuItems: DropdownMenuItem[] = [];

					if (config.EditEnabled) {
						menuItems.push({
							label: "Edit",
							onClick: () => void handleEdit(row),
						});
					}

					if (config.DeleteEnabled) {
						menuItems.push({
							label: "Delete",
							onClick: () => handleDelete(row),
						});
					}
					return <DropdownMenu actions={menuItems} />;
				},
			});
		}

		return cols;
	}, [actionMenuOpen, config, config.EditEnabled, config.DeleteEnabled]);

	const handleCreate = () => {
		const tempId = generateTempId();
		const resolvedParentEntityName = parentEntityName || formState?.primaryEntityName;
		const nodeId = formState?.upsertChildNode?.({
			parentEntityName: resolvedParentEntityName,
			childEntityName: config.ChildEntityLogicalName,
			data: {},
			recordId: tempId,
			referencingAttribute: config.ReferencingAttribute,
			referencingNavigationProperty: config.ReferencingNavigationProperty || config.ReferencingAttribute,
			isPersisted: false,
		});
		setEditingRecord({ id: tempId, _isNew: true, _nodeId: nodeId ?? tempId });
		setSidepaneOpen(true);
	};

	const handleEdit = async (record: any) => {
		const recordId = resolveRecordId(record, config.ChildEntityLogicalName);

		if (!recordId) {
			console.error("Missing record ID for edit:", record);
			return;
		}

		// Check if this is a pending record
		if (isTempId(recordId)) {
			// Load from pending state
			const pendingRecords = formState?.getChildNodes?.(config.ChildEntityLogicalName) || [];
			const pendingRecord = pendingRecords.find((p: any) => p.id === recordId);

			if (pendingRecord) {
				setEditingRecord({ id: recordId, ...pendingRecord.data, _isNew: false, _nodeId: pendingRecord.id });
				setSidepaneOpen(true);
			} else {
				console.error("Pending record not found:", recordId);
			}
		} else {
			// Load from API - fetch full record with all fields
			const normalizedRecord = normalizeLookupFields({ id: recordId, ...record }, lookupFormFieldInfo);
			const resolvedParentEntityName = parentEntityName || formState?.primaryEntityName;
			const nodeId = formState?.upsertChildNode?.({
				parentEntityName: resolvedParentEntityName,
				childEntityName: config.ChildEntityLogicalName,
				data: {},
				recordId,
				referencingAttribute: config.ReferencingAttribute,
				referencingNavigationProperty: config.ReferencingNavigationProperty || config.ReferencingAttribute,
				isPersisted: true,
			});
			setEditingRecord({ ...normalizedRecord, _isNew: false, _nodeId: nodeId ?? recordId });
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
					const normalizedFullRecord = normalizeLookupFields({ id: resolvedId, ...fullRecord }, lookupFormFieldInfo);
					setEditingRecord({ ...normalizedFullRecord, _isNew: false, _nodeId: nodeId ?? recordId });
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
		const recordId = resolveRecordId(record, config.ChildEntityLogicalName);
		if (!recordId) {
			console.error("Missing record ID for delete:", record);
			return;
		}

		setDeleteRecord({ record, recordId });
	};

	const handleConfirmDelete = async () => {
		if (!deleteRecord) {
			return;
		}

		const { recordId } = deleteRecord;

		// Check if this is a pending record
		if (isTempId(recordId)) {
			// Delete from pending state
			formState?.deleteNode?.(recordId);
			tableRef.current?.refresh();
		} else {
			// Delete persisted record via API
			if (onDelete) {
				await onDelete(config.ChildEntityLogicalName, recordId);
				tableRef.current?.refresh();
			}
		}

		setDeleteRecord(null);
	};

	const handleFormSave = async (formData: any) => {
		const recordId = editingRecord?.id;
		const isNew = editingRecord?._isNew || !recordId;
		const resolvedParentEntityName = parentEntityName || formState?.primaryEntityName;
		const { id, _isNew, _isPending, ...cleanedFormData } = formData ?? {};

		// Check if this is a pending record (new or unsaved edit)
		if (formState) {
			formState.upsertChildNode?.({
				parentEntityName: resolvedParentEntityName,
				childEntityName: config.ChildEntityLogicalName,
				data: cleanedFormData,
				recordId,
				referencingAttribute: config.ReferencingAttribute,
				referencingNavigationProperty: config.ReferencingNavigationProperty || config.ReferencingAttribute,
				isPersisted: !isTempId(recordId),
			});

			setSidepaneOpen(false);
			setEditingRecord(null);
			tableRef.current?.refresh();
		} else {
			console.error("formState not available");
		}
	};

	const handleFormCancel = () => {
		if (editingRecord?._isNew && editingRecord?.id) {
			formState?.deleteNode?.(editingRecord.id);
		}
		setSidepaneOpen(false);
		setEditingRecord(null);
	};

	return (
		<>
			<TableEntry
				ref={tableRef}
				label={config.DisplayName || ""}
				columns={columns}
				fetchData={shouldLoadData ? fetchDataWithPending : emptyFetch}
				className={className}
				initialSortState={columns.length > 0 ? { key: columns[0].key, direction: "asc" } : undefined}
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
				<LoadingIndicator visible={isLoadingRecord} variant="contextual" message="Loading..." />
				<TableEntryForm
					config={config}
					initialData={editingRecord}
					parentRecordId={parentRecordId}
					parentEntityName={parentEntityName}
					parentFormState={formState}
					nodeId={editingRecord?._nodeId}
					onSave={handleFormSave}
					onCancel={handleFormCancel}
				/>
			</Sidepane>

			<ConfirmationModal
				isOpen={Boolean(deleteRecord)}
				title="Delete Record"
				message="Are you sure you want to delete this record?"
				confirmText="Delete"
				cancelText="Cancel"
				onConfirm={handleConfirmDelete}
				onCancel={() => setDeleteRecord(null)}
				modalSize="md"
			/>
		</>
	);
};

export default TableEntryAction;
