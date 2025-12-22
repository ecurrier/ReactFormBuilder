import { UserFormSession } from "./UserFormSession";

export interface FormInstance {
    Id: string;
    FormId: string;
    VersionId: string;
    PrimaryRecordId: string;
    PrimaryRecordLogicalName: string;
    RelatedRecords: FormInstanceRelatedRecord[];
    UserFormSessions: UserFormSession[];
}

export interface FormInstanceRelatedRecord {
    LogicalName: string;
    Id: string;
}