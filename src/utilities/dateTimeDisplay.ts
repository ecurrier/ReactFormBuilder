import { DateTimeFormat } from "@constants/enums";
import { localizationSettings, type AppDateDisplayFormat } from "@constants/localization";

const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})/;

const pad = (value: number): string => String(value).padStart(2, "0");

export const normalizeDateTimeFormat = (value?: string | number): number => {
	if (value === DateTimeFormat.DateOnly || value === "DateOnly" || value === 0 || value === "0") {
		return DateTimeFormat.DateOnly;
	}
	if (value === DateTimeFormat.DateAndTime || value === "DateAndTime" || value === 1 || value === "1") {
		return DateTimeFormat.DateAndTime;
	}
	return DateTimeFormat.DateOnly;
};

export const normalizeDateTimeBehavior = (value?: string): "UserLocal" | "TimeZoneIndependent" => {
	if (value === "TimeZoneIndependent") {
		return "TimeZoneIndependent";
	}
	return "UserLocal";
};

const formatDateFromParts = (year: number, month: number, day: number, format: AppDateDisplayFormat): string => {
	if (format === "dd/MM/YYYY") {
		return `${pad(day)}/${pad(month)}/${year}`;
	}
	return `${pad(month)}/${pad(day)}/${year}`;
};

const getDatePartsFromIsoString = (value: string): { year: number; month: number; day: number } | null => {
	const match = value.match(isoDatePattern);
	if (!match) {
		return null;
	}

	const year = Number.parseInt(match[1], 10);
	const month = Number.parseInt(match[2], 10);
	const day = Number.parseInt(match[3], 10);

	if (!year || !month || !day) {
		return null;
	}

	return { year, month, day };
};

const parseDateValue = (value: unknown): Date | null => {
	if (!value) {
		return null;
	}

	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? null : value;
	}

	const parsed = new Date(String(value));
	return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatDateOnlyDisplay = (value: unknown, dateDisplayFormat: AppDateDisplayFormat = localizationSettings.dateDisplayFormat): string => {
	if (!value) {
		return "";
	}

	if (typeof value === "string") {
		const isoParts = getDatePartsFromIsoString(value);
		if (isoParts) {
			return formatDateFromParts(isoParts.year, isoParts.month, isoParts.day, dateDisplayFormat);
		}
	}

	const date = parseDateValue(value);
	if (!date) {
		return "";
	}

	return formatDateFromParts(date.getFullYear(), date.getMonth() + 1, date.getDate(), dateDisplayFormat);
};

export const formatDateTimeDisplayParts = (
	value: unknown,
	dateTimeBehavior?: string,
	dateDisplayFormat: AppDateDisplayFormat = localizationSettings.dateDisplayFormat
): { date: string; time: string } | null => {
	const date = parseDateValue(value);
	if (!date) {
		return null;
	}

	const behavior = normalizeDateTimeBehavior(dateTimeBehavior);
	const useUtc = behavior === "TimeZoneIndependent";

	const year = useUtc ? date.getUTCFullYear() : date.getFullYear();
	const month = (useUtc ? date.getUTCMonth() : date.getMonth()) + 1;
	const day = useUtc ? date.getUTCDate() : date.getDate();
	const hour = useUtc ? date.getUTCHours() : date.getHours();
	const minute = useUtc ? date.getUTCMinutes() : date.getMinutes();

	return {
		date: formatDateFromParts(year, month, day, dateDisplayFormat),
		time: `${pad(hour)}:${pad(minute)}`,
	};
};

export const formatDateValueForDisplay = (value: unknown, dateTimeFormat?: string | number, dateTimeBehavior?: string): string => {
	const normalizedFormat = normalizeDateTimeFormat(dateTimeFormat);

	if (normalizedFormat === DateTimeFormat.DateAndTime) {
		const parts = formatDateTimeDisplayParts(value, dateTimeBehavior);
		return parts ? `${parts.date} ${parts.time}` : "";
	}

	return formatDateOnlyDisplay(value);
};
