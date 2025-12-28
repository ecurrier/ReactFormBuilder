import { UserFormSession } from "./UserFormSession";
import { Version } from "./Version";

export interface FormInstance {
    Id: string;
    FormId: string;
    Version: Version;
    PrimaryRecordId: string;
    PrimaryRecordLogicalName: string;
    SecondaryRecords: FormInstanceSecondaryRecord[];
    UserFormSessions: UserFormSession[];
}

export interface FormInstanceSecondaryRecord {
    LogicalName: string;
    Id: string;
}