import { UserFormSessionEvent } from "./UserFormSessionEvent";

export interface UserFormSession {
	Id: string;
	FormInstanceId: string;
	ContactId: string;
	OrganizationId: string;
	LastActive: Date;
	Events: UserFormSessionEvent[];
}
