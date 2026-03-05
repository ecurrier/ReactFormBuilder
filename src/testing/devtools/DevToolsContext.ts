import { createContext, useContext } from "react";

export interface DevToolsAPI {
	reloadWithConfig: (configKey: string) => void;
}

export const DevToolsContext = createContext<DevToolsAPI | null>(null);

export const useDevTools = (): DevToolsAPI | null => {
	return useContext(DevToolsContext);
};
