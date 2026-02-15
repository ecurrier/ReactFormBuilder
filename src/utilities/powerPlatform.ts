const FORM_CONTENT_FIELD = "eyfrcc_formcontent";
const FORM_ENTITY_LOGICAL_NAME = "eyfrcc_form";

type XrmLookupValue = {
	id?: string;
	entityType?: string;
	name?: string;
};

interface XrmAttribute {
	getValue?: () => unknown;
}

interface XrmEntity {
	getId?: () => string;
	getEntityName?: () => string;
}

interface XrmUi {
	getFormType?: () => number;
}

interface XrmPage {
	data?: {
		entity?: XrmEntity;
	};
	ui?: XrmUi;
	getAttribute?: (attributeName: string) => XrmAttribute | null;
}

interface XrmEntityMetadataRelationship {
	ReferencedEntity?: string;
	ReferencingAttribute?: string;
}

interface XrmEntityMetadata {
	ManyToOneRelationships?: XrmEntityMetadataRelationship[];
}

interface XrmUtility {
	getEntityMetadata?: (entityLogicalName: string) => Promise<XrmEntityMetadata>;
}

interface XrmLike {
	Page?: XrmPage;
	Utility?: XrmUtility;
}

const resolveXrmContext = (): XrmLike | null => {
	if (typeof window === "undefined") {
		return null;
	}

	const parentWindow = window.parent as Window & { Xrm?: XrmLike };
	if (parentWindow?.Xrm) {
		return parentWindow.Xrm;
	}

	const currentWindow = window as Window & { Xrm?: XrmLike };
	return currentWindow.Xrm ?? null;
};

export const resolveEmbeddedVersionFormContent = (): unknown => {
	const xrm = resolveXrmContext();
	return xrm?.Page?.getAttribute?.(FORM_CONTENT_FIELD)?.getValue?.() ?? null;
};

export const resolveEmbeddedVersionId = (): string | null => {
	const xrm = resolveXrmContext();
	const id = xrm?.Page?.data?.entity?.getId?.();
	return typeof id === "string" && id.length > 0 ? id.replace(/[{}]/g, "") : null;
};

export const resolveEmbeddedRecordId = (): string | null => {
	const xrm = resolveXrmContext();
	const id = xrm?.Page?.data?.entity?.getId?.();
	return typeof id === "string" && id.length > 0 ? id.replace(/[{}]/g, "") : null;
};

export const resolveEmbeddedRecordLogicalName = (): string | null => {
	const xrm = resolveXrmContext();
	return xrm?.Page?.data?.entity?.getEntityName?.() ?? null;
};

export const isEmbeddedCreateForm = (): boolean => {
	const xrm = resolveXrmContext();
	return xrm?.Page?.ui?.getFormType?.() === 1;
};

const resolveFormLookupAttributeNameFromMetadata = async (entityLogicalName: string): Promise<string | null> => {
	const xrm = resolveXrmContext();
	const entityMetadata = await xrm?.Utility?.getEntityMetadata?.(entityLogicalName);
	if (!entityMetadata?.ManyToOneRelationships?.length) {
		return null;
	}

	const relationship = entityMetadata.ManyToOneRelationships.find((item) => item.ReferencedEntity === FORM_ENTITY_LOGICAL_NAME);
	return relationship?.ReferencingAttribute ?? null;
};

export const resolveEmbeddedFormIdForCreate = async (): Promise<string | null> => {
	const xrm = resolveXrmContext();
	const entityLogicalName = resolveEmbeddedRecordLogicalName();
	if (!xrm?.Page || !entityLogicalName) {
		return null;
	}

	const formLookupAttributeName = await resolveFormLookupAttributeNameFromMetadata(entityLogicalName);
	if (!formLookupAttributeName) {
		return null;
	}

	const rawLookup = xrm.Page.getAttribute?.(formLookupAttributeName)?.getValue?.();
	const lookupValue = (Array.isArray(rawLookup) ? rawLookup[0] : rawLookup) as XrmLookupValue | null;
	const formId = lookupValue?.id;

	return typeof formId === "string" && formId.length > 0 ? formId.replace(/[{}]/g, "") : null;
};

export const isPowerPlatformBuild = (): boolean => import.meta.env.MODE === "power-platform";
