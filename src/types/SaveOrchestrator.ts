export type SaveEntityScope = "primary" | "secondary" | "child" | "upload";

export type SaveProgressStatus = "saving" | "saved" | "failed";

export type SaveOperation = "create" | "update" | "ensure" | "upload";

export interface SaveProgressEvent {
	id: string;
	scope: SaveEntityScope;
	entityName: string;
	label?: string;
	status: SaveProgressStatus;
	message?: string;
	recordId?: string;
	parentEntityName?: string;
	parentRecordId?: string;
	operation?: SaveOperation;
	startedAt?: string;
	finishedAt?: string;
	durationMs?: number;
}

export type SaveErrorPhase = "primary" | "secondary" | "child" | "upload" | "validation" | "save" | "reload";

export interface SaveError {
	phase: SaveErrorPhase;
	message: string;
	entityName?: string;
	recordId?: string;
}

export interface SaveResult {
	success: boolean;
	recordId?: string;
	errors?: SaveError[];
	message?: string;
}
