import { useState, useCallback, useMemo } from "react";
import { validateField } from "@services/validation/validators";
import { generateTempId } from "@utilities";

export interface InlineGridDraft {
	/** Original row data snapshot (for dirty comparison and cancel) */
	original: Record<string, any>;
	/** Current draft values (only changed fields) */
	changes: Record<string, any>;
}

export interface InlineNewRow {
	tempId: string;
	data: Record<string, any>;
}

export interface InlineGridCommitPayload {
	modified: Array<{ rowId: string; data: Record<string, any> }>;
	created: Array<{ tempId: string; data: Record<string, any> }>;
}

export interface InlineGridState {
	isEditMode: boolean;
	drafts: Map<string, InlineGridDraft>;
	newRows: InlineNewRow[];
	validationErrors: Map<string, Record<string, string>>;
	enterEditMode: (currentRows: Record<string, any>[]) => void;
	exitEditMode: () => void;
	updateCell: (rowId: string, logicalName: string, value: any) => void;
	addNewRow: () => string;
	removeNewRow: (tempId: string) => void;
	isDirty: (rowId: string, logicalName: string) => boolean;
	hasDirtyRows: () => boolean;
	getCellValue: (rowId: string, logicalName: string) => any;
	validate: (actionProperties: any[]) => boolean;
	getCommitPayload: () => InlineGridCommitPayload;
	getValidationError: (rowId: string, logicalName: string) => string | undefined;
}

const resolveRowId = (row: Record<string, any>, entityName?: string): string => {
	if (row.id) return row.id;
	if (entityName) {
		const idAttr = `${entityName}id`;
		if (row[idAttr]) return row[idAttr];
	}
	return row.id || "";
};

export const useInlineGridState = (entityName?: string): InlineGridState => {
	const [isEditMode, setIsEditMode] = useState(false);
	const [drafts, setDrafts] = useState<Map<string, InlineGridDraft>>(new Map());
	const [newRows, setNewRows] = useState<InlineNewRow[]>([]);
	const [validationErrors, setValidationErrors] = useState<Map<string, Record<string, string>>>(new Map());

	const enterEditMode = useCallback(
		(currentRows: Record<string, any>[]) => {
			const newDrafts = new Map<string, InlineGridDraft>();
			currentRows.forEach((row) => {
				const rowId = resolveRowId(row, entityName);
				if (rowId) {
					newDrafts.set(rowId, { original: { ...row }, changes: {} });
				}
			});
			setDrafts(newDrafts);
			setNewRows([]);
			setValidationErrors(new Map());
			setIsEditMode(true);
		},
		[entityName]
	);

	const exitEditMode = useCallback(() => {
		setIsEditMode(false);
		setDrafts(new Map());
		setNewRows([]);
		setValidationErrors(new Map());
	}, []);

	const updateCell = useCallback((rowId: string, logicalName: string, value: any) => {
		// Check if this is a new row
		setNewRows((prev) => {
			const idx = prev.findIndex((r) => r.tempId === rowId);
			if (idx >= 0) {
				const updated = [...prev];
				updated[idx] = { ...updated[idx], data: { ...updated[idx].data, [logicalName]: value } };
				return updated;
			}
			return prev;
		});

		// Update drafts for existing rows
		setDrafts((prev) => {
			const draft = prev.get(rowId);
			if (!draft) return prev;

			const next = new Map(prev);
			next.set(rowId, {
				...draft,
				changes: { ...draft.changes, [logicalName]: value },
			});
			return next;
		});

		// Clear validation error for this cell
		setValidationErrors((prev) => {
			const rowErrors = prev.get(rowId);
			if (!rowErrors || !rowErrors[logicalName]) return prev;

			const next = new Map(prev);
			const { [logicalName]: _, ...rest } = rowErrors;
			if (Object.keys(rest).length === 0) {
				next.delete(rowId);
			} else {
				next.set(rowId, rest);
			}
			return next;
		});
	}, []);

	const addNewRow = useCallback(() => {
		const tempId = generateTempId();
		setNewRows((prev) => [...prev, { tempId, data: {} }]);
		return tempId;
	}, []);

	const removeNewRow = useCallback((tempId: string) => {
		setNewRows((prev) => prev.filter((r) => r.tempId !== tempId));
		setValidationErrors((prev) => {
			if (!prev.has(tempId)) return prev;
			const next = new Map(prev);
			next.delete(tempId);
			return next;
		});
	}, []);

	const isDirty = useCallback(
		(rowId: string, logicalName: string): boolean => {
			const draft = drafts.get(rowId);
			if (!draft) return false;
			if (!(logicalName in draft.changes)) return false;

			const original = draft.original[logicalName];
			const current = draft.changes[logicalName];

			// Handle lookup objects
			if (original && typeof original === "object" && original.id) {
				return original.id !== current?.id;
			}

			return original !== current;
		},
		[drafts]
	);

	const hasDirtyRows = useCallback((): boolean => {
		if (newRows.length > 0) return true;

		for (const [, draft] of drafts) {
			for (const logicalName of Object.keys(draft.changes)) {
				const original = draft.original[logicalName];
				const current = draft.changes[logicalName];

				if (original && typeof original === "object" && original.id) {
					if (original.id !== current?.id) return true;
				} else if (original !== current) {
					return true;
				}
			}
		}

		return false;
	}, [drafts, newRows]);

	const getCellValue = useCallback(
		(rowId: string, logicalName: string): any => {
			// Check new rows first
			const newRow = newRows.find((r) => r.tempId === rowId);
			if (newRow) {
				return newRow.data[logicalName] ?? null;
			}

			// Check drafts
			const draft = drafts.get(rowId);
			if (!draft) return undefined;

			if (logicalName in draft.changes) {
				return draft.changes[logicalName];
			}

			return draft.original[logicalName] ?? null;
		},
		[drafts, newRows]
	);

	const validate = useCallback(
		(actionProperties: any[]): boolean => {
			const errors = new Map<string, Record<string, string>>();
			let isValid = true;

			const validateRow = (rowId: string, rowData: Record<string, any>) => {
				const rowErrors: Record<string, string> = {};
				actionProperties.forEach((props) => {
					const logicalName = props.LogicalName;
					if (!logicalName) return;

					const value = rowData[logicalName] ?? null;
					const result = validateField(value, props);
					if (!result.IsValid && result.Message) {
						rowErrors[logicalName] = result.Message;
						isValid = false;
					}
				});

				if (Object.keys(rowErrors).length > 0) {
					errors.set(rowId, rowErrors);
				}
			};

			// Validate existing rows (merge original + changes)
			for (const [rowId, draft] of drafts) {
				if (Object.keys(draft.changes).length === 0) continue;
				const mergedData = { ...draft.original, ...draft.changes };
				validateRow(rowId, mergedData);
			}

			// Validate new rows
			newRows.forEach((row) => {
				validateRow(row.tempId, row.data);
			});

			setValidationErrors(errors);
			return isValid;
		},
		[drafts, newRows]
	);

	const getCommitPayload = useCallback((): InlineGridCommitPayload => {
		const modified: InlineGridCommitPayload["modified"] = [];
		const created: InlineGridCommitPayload["created"] = [];

		for (const [rowId, draft] of drafts) {
			if (Object.keys(draft.changes).length > 0) {
				// Only include actually dirty fields
				const dirtyChanges: Record<string, any> = {};
				for (const [key, value] of Object.entries(draft.changes) as [string, any][]) {
					const original = draft.original[key];
					if (original && typeof original === "object" && original.id) {
						if (original.id !== (value as any)?.id) dirtyChanges[key] = value;
					} else if (original !== value) {
						dirtyChanges[key] = value;
					}
				}

				if (Object.keys(dirtyChanges).length > 0) {
					modified.push({ rowId, data: dirtyChanges });
				}
			}
		}

		newRows.forEach((row) => {
			created.push({ tempId: row.tempId, data: row.data });
		});

		return { modified, created };
	}, [drafts, newRows]);

	const getValidationError = useCallback(
		(rowId: string, logicalName: string): string | undefined => {
			return validationErrors.get(rowId)?.[logicalName];
		},
		[validationErrors]
	);

	return useMemo(
		() => ({
			isEditMode,
			drafts,
			newRows,
			validationErrors,
			enterEditMode,
			exitEditMode,
			updateCell,
			addNewRow,
			removeNewRow,
			isDirty,
			hasDirtyRows,
			getCellValue,
			validate,
			getCommitPayload,
			getValidationError,
		}),
		[
			isEditMode,
			drafts,
			newRows,
			validationErrors,
			enterEditMode,
			exitEditMode,
			updateCell,
			addNewRow,
			removeNewRow,
			isDirty,
			hasDirtyRows,
			getCellValue,
			validate,
			getCommitPayload,
			getValidationError,
		]
	);
};
