import type { MockStoreState } from "../mockStore";
import { getDefaultDataset } from "./default";

export interface DatasetEntry {
	name: string;
	description: string;
	load: () => MockStoreState["data"];
}

export const datasets: Record<string, DatasetEntry> = {
	default: {
		name: "Default",
		description: "Full dataset with all mock records",
		load: getDefaultDataset,
	},
};
