const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Check if an ID is a temporary UUID (starts with a specific pattern or doesn't match GUID format)
 */
export const isTempId = (id?: string | null): boolean => {
	if (!id || typeof id !== "string") {
		return false;
	}

	// Temp IDs are UUIDs but we can distinguish them by checking if they start with our pattern
	// or by checking if they exist in pending records
	return id.startsWith("temp-") || !guidPattern.test(id);
};

/**
 * Generate a UUID v4 for temporary record IDs
 */
export const generateTempId = (): string => {
	return `temp-${crypto.randomUUID()}`;
};

export const sanitizeGuid = (value: string): string => {
	if (!value) {
		return value;
	}

	return value.startsWith("temp-") ? value.slice(5) : value;
};
