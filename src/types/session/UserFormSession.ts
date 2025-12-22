export interface UserFormSession {
    Id: string;
    FormInstanceId: string;
    ContactId: string;
    OrganizationId: string;
    LastActive: Date;
    CurrentStepId: string;
    CurrentStepIndex: number;
    StepHistory: StepHistoryEntry[];
    ComputedPath: ComputedPathEntry[];
    Events: UserFormSessionEvent[];
}

export interface StepHistoryEntry {
    StepId: string;
}

export interface ComputedPathEntry {
    StepId: string;
    ActionId: string;
}