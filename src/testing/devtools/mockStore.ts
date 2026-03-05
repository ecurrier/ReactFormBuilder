export type LatencyMode = "instant" | "realistic" | "slow";

export interface MockStoreState {
	/** If true, all mock handlers return 500 errors */
	forceErrors: boolean;

	/** Controls delay() calls in handlers */
	latencyMode: LatencyMode;

	/** Per-entity mock data keyed by entity set name, then by record ID */
	data: Record<string, Record<string, Record<string, any>>>;
}

// Immutable snapshot reference — replaced on every mutation so useSyncExternalStore detects changes
let snapshot: MockStoreState = {
	forceErrors: false,
	latencyMode: "realistic",
	data: {},
};

// --- Subscription (for useSyncExternalStore) ---

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
	listeners.forEach((l) => l());
}

export function subscribe(listener: Listener): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function getSnapshot(): MockStoreState {
	return snapshot;
}

// --- Mutations ---

function update(partial: Partial<MockStoreState>) {
	snapshot = { ...snapshot, ...partial };
	notify();
}

export function setForceErrors(value: boolean) {
	update({ forceErrors: value });
}

export function setLatencyMode(mode: LatencyMode) {
	update({ latencyMode: mode });
}

export function loadDataset(data: MockStoreState["data"]) {
	update({ data });
}

/** Insert or update a record in the store. Returns the record ID used as the key. */
export function upsertRecord(entitySetName: string, recordId: string, record: Record<string, any>) {
	const entityData = snapshot.data[entitySetName] ?? {};
	const merged = { ...entityData[recordId], ...record };
	update({
		data: {
			...snapshot.data,
			[entitySetName]: {
				...entityData,
				[recordId]: merged,
			},
		},
	});
}

/** Delete a record from the store. */
export function deleteRecord(entitySetName: string, recordId: string) {
	const entityData = snapshot.data[entitySetName];
	if (!entityData?.[recordId]) return;
	const { [recordId]: _, ...rest } = entityData;
	update({
		data: {
			...snapshot.data,
			[entitySetName]: rest,
		},
	});
}

// --- Direct access for MSW handlers ---

export function getStore(): MockStoreState {
	return snapshot;
}
