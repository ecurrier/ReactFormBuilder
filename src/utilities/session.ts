import type { ExtendedWindow } from "@types";

export const resolveRequestorId = (): string | null => {
	if (typeof window === "undefined") {
		return null;
	}

	const extWindow = window as ExtendedWindow;
	return extWindow.Microsoft?.Dynamic365?.Portal?.User?.contactId ?? null;
};
