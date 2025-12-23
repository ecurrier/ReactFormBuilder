import { UserFormSession } from "./UserFormSession";
import { Version } from "./Version";

export interface FormInstance {
    Id: string;
    FormId: string;
    Version: Version;
    PrimaryRecordId: string;
    PrimaryRecordLogicalName: string;
    RelatedRecords: FormInstanceRelatedRecord[];
    UserFormSessions: UserFormSession[];
}

export interface FormInstanceRelatedRecord {
    LogicalName: string;
    Id: string;
}