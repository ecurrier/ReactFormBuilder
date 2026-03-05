import { useSyncExternalStore } from "react";
import { subscribe, getSnapshot, type MockStoreState } from "../mockStore";

export function useMockStore(): MockStoreState {
	return useSyncExternalStore(subscribe, getSnapshot);
}
