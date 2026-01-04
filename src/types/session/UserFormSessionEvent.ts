import type { FormInstanceEventTypeValue } from "@constants/enums";

export interface UserFormSessionEvent {
	Id: string;
	UserFormSessionId: string;
	EventType: FormInstanceEventTypeValue;
	CreatedOn: Date;
}
