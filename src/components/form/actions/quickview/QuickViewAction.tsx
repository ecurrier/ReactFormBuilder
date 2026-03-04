import React, { useMemo } from "react";
import { FieldInput } from "@components";
import { useQuickViewData } from "@hooks/useQuickViewData";
import type { AnyFormState, ReactActionConfiguration, QuickViewProperties, TableEntryFormState } from "@app-types";

type QuickViewActionProps = {
	action: ReactActionConfiguration;
	formState: AnyFormState;
	entityName?: string;
};

const QuickViewAction: React.FC<QuickViewActionProps> = ({ action, formState, entityName }) => {
	const properties = action.Properties as QuickViewProperties;
	const primaryEntityName = entityName || formState.primaryEntityName || "";
	const primaryRecordId = "recordId" in formState ? formState.recordId : undefined;

	const { data, isLoading, error, lookupRecordId } = useQuickViewData({
		properties,
		formState,
		primaryEntityName,
		primaryRecordId,
	});

	// Build a read-only proxy formState that serves fetched data to FieldInput components
	const quickViewFormState: TableEntryFormState = useMemo(
		() => ({
			type: "tableEntry" as const,
			primaryEntityName: properties.QuickViewEntityLogicalName || "",
			registerField: () => {},
			updateFieldValue: () => {},
			getFieldValue: (path: string) => {
				if (!data) return null;
				const fieldName = path.split(".").pop();
				if (!fieldName) return null;

				// Check for OData formatted value first (for lookups, choices, dates, etc.)
				const formattedKey = `${fieldName}@OData.Community.Display.V1.FormattedValue`;
				if (data[formattedKey] !== undefined) {
					return data[formattedKey];
				}

				return data[fieldName] ?? null;
			},
			getFieldMetadata: () => undefined,
		}),
		[data, properties.QuickViewEntityLogicalName]
	);

	// Collect and sort all actions from QuickViewSteps, forced to read-only
	const readOnlyActions = useMemo(() => {
		if (!properties.QuickViewSteps) return [];

		return properties.QuickViewSteps.flatMap((step) => [...(step.Actions ?? [])].sort((a, b) => (a.Order ?? 0) - (b.Order ?? 0))).map((a) => ({
			...a,
			Properties: {
				...a.Properties,
				IsReadOnly: true,
				IsRequired: false,
			},
		}));
	}, [properties.QuickViewSteps]);

	return (
		<div className="quick-view-section">
			{properties.DisplayName && <h4 className="quick-view-title">{properties.DisplayName}</h4>}

			{isLoading && <p className="text-muted">Loading related record...</p>}

			{error && (
				<div className="alert alert-warning" role="alert">
					Unable to load related data: {error}
				</div>
			)}

			{!isLoading && !error && !lookupRecordId && <p className="text-muted">No record selected.</p>}

			{!isLoading && !error && data && (
				<>
					{readOnlyActions.map((readOnlyAction) => (
						<FieldInput
							key={readOnlyAction.Id ?? readOnlyAction.Name}
							action={readOnlyAction}
							formState={quickViewFormState}
							entityName={properties.QuickViewEntityLogicalName}
						/>
					))}
				</>
			)}
		</div>
	);
};

export default QuickViewAction;
