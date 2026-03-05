import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";
import { loadDataset } from "../devtools/mockStore";
import { datasets } from "../devtools/datasets";

// Initialize the mock store with the default dataset before starting the worker
loadDataset(datasets.default.load());

export const worker = setupWorker(...handlers);
