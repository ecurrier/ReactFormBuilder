export type AppDateDisplayFormat = "MM/dd/YYYY" | "dd/MM/YYYY";

export interface LocalizationSettings {
	dateDisplayFormat: AppDateDisplayFormat;
}

// Global app-level localization settings.
// In future this can be hydrated from environment or API config.
export const localizationSettings: LocalizationSettings = {
	dateDisplayFormat: "MM/dd/YYYY",
};
