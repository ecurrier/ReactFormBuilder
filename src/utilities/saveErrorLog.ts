import type { SaveError } from "../types/SaveOrchestrator";

export interface SaveDetailNode {
	id: string;
	scope: string;
	entityName: string;
	label?: string;
	status?: string;
	errors: SaveError[];
	children: SaveDetailNode[];
}

interface ErrorLogPayload {
	timestamp: string;
	formName?: string;
	savePhase: string;
	summary: {
		total: number;
		saved: number;
		failed: number;
	};
	details: SaveDetailNode[];
	ungroupedErrors: Array<{ phase: string; message: string }>;
}

export function generateSaveErrorLog(payload: ErrorLogPayload): string {
	return JSON.stringify(payload, null, 2);
}

export function downloadSaveErrorLog(payload: ErrorLogPayload): void {
	const content = generateSaveErrorLog(payload);
	const blob = new Blob([content], { type: "application/json" });
	const url = URL.createObjectURL(blob);

	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = `save-error-log-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
	document.body.appendChild(anchor);
	anchor.click();

	document.body.removeChild(anchor);
	URL.revokeObjectURL(url);
}
