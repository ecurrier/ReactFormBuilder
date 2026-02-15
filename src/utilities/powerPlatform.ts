const FORM_CONTENT_FIELD = "eyfrcc_formcontent";

interface XrmAttribute {
	getValue?: () => unknown;
}

interface XrmEntity {
	getId?: () => string;
}

interface XrmPage {
	data?: {
		entity?: XrmEntity;
	};
	getAttribute?: (attributeName: string) => XrmAttribute | null;
}

interface XrmLike {
	Page?: XrmPage;
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

export const isPowerPlatformBuild = (): boolean => import.meta.env.MODE === "power-platform";
