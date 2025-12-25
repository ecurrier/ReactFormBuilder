export type SaveEntityScope = "primary" | "secondary" | "child";

export type SaveProgressStatus = "saving" | "saved" | "failed";

export interface SaveProgressEvent {
	id: string;
	scope: SaveEntityScope;
	entityName: string;
	label?: string;
	status: SaveProgressStatus;
	message?: string;
}

export type SaveErrorPhase = "primary" | "secondary" | "child" | "validation" | "save" | "reload";

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
