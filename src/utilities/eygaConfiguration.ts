import { retrieveRecord } from "@api";
import { EygaApi } from "@utilities";

export interface EygaConfiguration {
	ApiKey: string;
	AllowedFileTypes: ValidFileType[];
	MaxFileSizeMB: number;
	ApiEndpoints: Record<EygaApi, string>[];
}

export interface ValidFileType {
	MimeType: string;
	Extensions: string[];
}

export const retrieveEygaConfiguration = async (): Promise<EygaConfiguration> => {
	// Placeholder for actual implementation to fetch configuration from EYGA service
	// This could involve making an HTTP request to a configuration endpoint
	// First, check cache (not implemented here for brevity)

	// If cache not initialized, retrieve via fetch
	const fetchXml = `
        <fetch top="1">
            <entity name="eyfrcc_eygaconfiguration">
                <attribute name="eyfrcc_eygaconfigurationid" />
                <attribute name="eyfrcc_eygaapikey" />
                <attribute name="eyfrcc_allowedextensions" />
                <attribute name="eyfrcc_maxfilesizemb" />
                <attribute name="eyfrcc_documentapiurl" />
                <attribute name="eyfrcc_addressapiurl" />
            </entity>
        </fetch>`;

	const response = await retrieveRecord("eyfrcc_eygaconfiguration", fetchXml);
	if (!response) {
		throw new Error("Failed to retrieve EYGA configuration");
	}

	const validFileTypes: ValidFileType[] = JSON.parse(response.eyfrcc_allowedextensions).map((item: any) => ({
		MimeType: item.m,
		Extensions: item.e.split(","),
	}));

	return {
		ApiKey: response.eyfrcc_eygaapikey,
		AllowedFileTypes: validFileTypes,
		MaxFileSizeMB: response.eyfrcc_maxfilesizemb || 10,
		ApiEndpoints: {
			[EygaApi.Documents]: response.eyfrcc_documentapiurl,
			[EygaApi.Address]: response.eyfrcc_addressapiurl,
			[EygaApi.SamGov]: response.eyfrcc_samgovapiurl,
		},
	} as EygaConfiguration;
};
