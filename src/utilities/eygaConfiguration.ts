import { retrieveRecord } from "@api";
import { EygaApi } from "@utilities";

export interface EygaConfiguration {
	ApiKey: string;
	AllowedFileTypes: ValidFileType[];
	MaxFileSizeMB: number;
	ApiEndpoints: Record<EygaApi, string>;
}

export interface ValidFileType {
	MimeType: string;
	Extensions: string[];
}

const CONFIG_CACHE_KEY = "eyga-configuration";
const CONFIG_CACHE_TTL_MS = 60 * 60 * 1000;

const getCachedConfiguration = (): EygaConfiguration | null => {
	if (typeof sessionStorage === "undefined") {
		return null;
	}

	try {
		const cachedValue = sessionStorage.getItem(CONFIG_CACHE_KEY);
		if (!cachedValue) {
			return null;
		}

		const cached = JSON.parse(cachedValue) as { value: EygaConfiguration; expiresAt: number };
		if (!cached?.value || !cached.expiresAt) {
			sessionStorage.removeItem(CONFIG_CACHE_KEY);
			return null;
		}

		if (Date.now() > cached.expiresAt) {
			sessionStorage.removeItem(CONFIG_CACHE_KEY);
			return null;
		}

		return cached.value;
	} catch (error) {
		console.warn("Failed to read EYGA configuration cache.", error);
		return null;
	}
};

const setCachedConfiguration = (configuration: EygaConfiguration): void => {
	if (typeof sessionStorage === "undefined") {
		return;
	}

	try {
		const payload = {
			value: configuration,
			expiresAt: Date.now() + CONFIG_CACHE_TTL_MS,
		};
		sessionStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(payload));
	} catch (error) {
		console.warn("Failed to cache EYGA configuration.", error);
	}
};

export const retrieveEygaConfiguration = async (): Promise<EygaConfiguration> => {
	const cachedConfiguration = getCachedConfiguration();
	if (cachedConfiguration) {
		return cachedConfiguration;
	}

	const fetchXml = `
        <fetch top="1">
            <entity name="eyfrcc_eygaconfiguration">
                <attribute name="eyfrcc_eygaconfigurationid" />
                <attribute name="eyfrcc_eygaapikey" />
                <attribute name="eyfrcc_allowedextensions" />
                <attribute name="eyfrcc_maxfilesizemb" />
                <attribute name="eyfrcc_documentapiurl" />
                <attribute name="eyfrcc_addressapiurl" />
                <attribute name="eyfrcc_samgovapiurl" />
            </entity>
        </fetch>`;

	const response = await retrieveRecord("eyfrcc_eygaconfiguration", fetchXml);
	if (!response) {
		throw new Error("Failed to retrieve EYGA configuration");
	}

	const allowedExtensions = JSON.parse(response.eyfrcc_allowedextensions || '{"ValidFileTypes": []}');
	const validFileTypes: ValidFileType[] = allowedExtensions.ValidFileTypes.map((item: { m: string; e: string }) => ({
		MimeType: item.m,
		Extensions: item.e.split(","),
	}));

	const configuration: EygaConfiguration = {
		ApiKey: response.eyfrcc_eygaapikey,
		AllowedFileTypes: validFileTypes,
		MaxFileSizeMB: response.eyfrcc_maxfilesizemb || 10,
		ApiEndpoints: {
			[EygaApi.Documents]: response.eyfrcc_documentapiurl,
			[EygaApi.Address]: response.eyfrcc_addressapiurl,
			[EygaApi.SamGov]: response.eyfrcc_samgovapiurl,
		},
	};

	setCachedConfiguration(configuration);

	return configuration;
};
