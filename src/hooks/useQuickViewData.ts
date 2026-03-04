import { useState, useEffect, useRef, useMemo } from "react";
import { ActionType } from "@constants/enums";
import { retrieveRecord } from "@services";
import { buildFetchXmlForRecord } from "@utilities/fetchXml";
import type { AnyFormState, EntityReference, ReactActionConfiguration, QuickViewProperties, FieldInputProperties } from "@app-types";

interface UseQuickViewDataOptions {
	properties: QuickViewProperties;
	formState: AnyFormState;
	primaryEntityName?: string;
	primaryRecordId?: string | null;
}

interface UseQuickViewDataResult {
	data: Record<string, any> | null;
	isLoading: boolean;
	error: string | null;
	lookupRecordId: string | null;
}

/**
 * Recursively extract column logical names from QuickView actions.
 */
function extractColumns(actions: ReactActionConfiguration[]): string[] {
	const columns: string[] = [];
	for (const action of actions) {
		if (action.Type === ActionType.FieldInput) {
			const props = action.Properties as FieldInputProperties;
			if (props.LogicalName) {
				columns.push(props.LogicalName);
			}
			if (props.ChildActions) {
				columns.push(...extractColumns(props.ChildActions));
			}
		}
	}
	return columns;
}

/**
 * Hook that fetches related entity data for a QuickView action.
 *
 * Supports two modes:
 * - Mode A (lookup on form): Watches the lookup field value reactively.
 * - Mode B (lookup not on form): Fetches the lookup value from the parent record once on mount.
 */
export function useQuickViewData({ properties, formState, primaryEntityName, primaryRecordId }: UseQuickViewDataOptions): UseQuickViewDataResult {
	const [data, setData] = useState<Record<string, any> | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [resolvedLookupId, setResolvedLookupId] = useState<string | null>(null);
	const fetchIdRef = useRef(0);

	const entityLogicalName = properties.QuickViewEntityLogicalName;
	const parentLookup = properties.ParentLookup;

	// Extract columns to fetch from QuickViewSteps
	const columns = useMemo(() => {
		const allActions = properties.QuickViewSteps?.flatMap((step) => step.Actions ?? []) ?? [];
		return extractColumns(allActions);
	}, [properties.QuickViewSteps]);

	// Determine if the lookup field is on the form
	const lookupFieldPath = primaryEntityName && parentLookup ? `${primaryEntityName}.${parentLookup}` : null;
	const fieldMetadata = lookupFieldPath ? formState.getFieldMetadata(lookupFieldPath) : undefined;
	const isLookupOnForm = !!fieldMetadata;

	// Mode A: Get lookup value from form state
	const lookupValue = isLookupOnForm && lookupFieldPath ? (formState.getFieldValue(lookupFieldPath) as EntityReference | null) : null;
	const formLookupId = lookupValue?.id ?? null;

	// Mode B: Fetch lookup value from parent record (once on mount)
	useEffect(() => {
		if (isLookupOnForm || !primaryEntityName || !primaryRecordId || !parentLookup || !entityLogicalName) {
			return;
		}

		let cancelled = false;

		const fetchParentLookup = async () => {
			try {
				const fetchXml = buildFetchXmlForRecord(primaryEntityName, primaryRecordId, [parentLookup]);
				const record = await retrieveRecord<Record<string, any>>(primaryEntityName, fetchXml);
				if (cancelled) return;

				// Lookup values in OData come back as _fieldname_value
				const lookupId = record?.[`_${parentLookup}_value`] ?? null;
				setResolvedLookupId(lookupId);
			} catch (err) {
				if (cancelled) return;
				setError(err instanceof Error ? err.message : "Failed to resolve lookup value");
			}
		};

		fetchParentLookup();
		return () => {
			cancelled = true;
		};
	}, [isLookupOnForm, primaryEntityName, primaryRecordId, parentLookup, entityLogicalName]);

	// The effective lookup record ID — from form state (Mode A) or fetched (Mode B)
	const effectiveLookupId = isLookupOnForm ? formLookupId : resolvedLookupId;

	// Fetch the related entity record when we have a lookup ID
	useEffect(() => {
		if (!effectiveLookupId || !entityLogicalName || columns.length === 0) {
			setData(null);
			setError(null);
			setIsLoading(false);
			return;
		}

		const currentFetchId = ++fetchIdRef.current;
		setIsLoading(true);
		setError(null);

		const fetchRelatedRecord = async () => {
			try {
				const fetchXml = buildFetchXmlForRecord(entityLogicalName, effectiveLookupId, columns);
				const record = await retrieveRecord<Record<string, any>>(entityLogicalName, fetchXml);

				if (fetchIdRef.current !== currentFetchId) return;

				setData(record);
				setIsLoading(false);
			} catch (err) {
				if (fetchIdRef.current !== currentFetchId) return;

				setError(err instanceof Error ? err.message : "Failed to load related record");
				setData(null);
				setIsLoading(false);
			}
		};

		fetchRelatedRecord();
	}, [effectiveLookupId, entityLogicalName, columns]);

	return { data, isLoading, error, lookupRecordId: effectiveLookupId };
}
