import { ApiError, ApiErrorResponse } from "@/services/api";

/**
 * Solution-specific error message overrides
 * This can be extended in your application
 */
export const CUSTOM_ERROR_MESSAGES: Record<string, string> = {
	"9004010C": "Table Permissions or Web Api Site Settings are missing for the requested entity.",
};

export const getErrorMessage = (code: string, defaultMessage: string): string => {
	// Check custom overrides, fall back to the original message
	return CUSTOM_ERROR_MESSAGES[code] || defaultMessage;
};

export const parseApiError = async (response: Response): Promise<ApiError> => {
	try {
		const data = (await response.json()) as ApiErrorResponse;

		if (!data.error) {
			return new ApiError(`Unexpected API response: ${response.status} ${response.statusText}`, "UNKNOWN_ERROR", response.status);
		}

		const errorDetail = data.error;
		const innerError = errorDetail.innererror;

		// Use innerError details if available (when Webapi/error/innererror Site Setting is enabled)
		const code = innerError?.code || errorDetail.code;
		const message = innerError?.message || errorDetail.message;
		const type = innerError?.type;

		const formattedMessage = `${type ? `[${code}, ${type}]` : `[${code}]`} - ${message}`;
		const customMessage = getErrorMessage(code, formattedMessage);

		return new ApiError(customMessage, code, response.status, type);
	} catch (error) {
		return new ApiError(`HTTP Error: ${response.status} ${response.statusText}`, "PARSE_ERROR", response.status);
	}
};
