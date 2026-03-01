import { createContext, useContext } from "react";
import type { FormStateAPI } from "@app-types";

export const FormStateContext = createContext<FormStateAPI | null>(null);

export const useFormStateContext = (): FormStateAPI => {
	const ctx = useContext(FormStateContext);
	if (!ctx) {
		throw new Error("useFormStateContext must be used within a FormStateContext.Provider");
	}
	return ctx;
};
