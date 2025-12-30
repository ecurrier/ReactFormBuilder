import React from "react";
import PropTypes from "prop-types";
import { DateTimeFormat } from "@constants/enums";

const pad = (value) => String(value).padStart(2, "0");

const formatUtcDate = (date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

const formatUtcDateTime = (date) => `${formatUtcDate(date)}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;

const formatLocalDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const formatLocalDateTime = (date) => `${formatLocalDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

const normalizeDateTimeFormat = (value) => {
	if (value === DateTimeFormat.DateOnly || value === "DateOnly" || value === 0 || value === "0") {
		return DateTimeFormat.DateOnly;
	}
	if (value === DateTimeFormat.DateAndTime || value === "DateAndTime" || value === 1 || value === "1") {
		return DateTimeFormat.DateAndTime;
	}
	return DateTimeFormat.DateOnly;
};

const normalizeDateTimeBehavior = (value) => {
	if (typeof value !== "string") {
		return "UserLocal";
	}

	if (value === "TimeZoneIndependent") {
		return "TimeZoneIndependent";
	}

	return "UserLocal";
};

const parseDateOnlyUtc = (value) => {
	if (!value) {
		return null;
	}

	const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
	if (!year || !month || !day) {
		return null;
	}

	return new Date(Date.UTC(year, month - 1, day));
};

const parseDateTime = (value, behavior) => {
	if (!value) {
		return null;
	}

	if (behavior === "TimeZoneIndependent") {
		const [datePart, timePart] = value.split("T");
		if (!datePart || !timePart) {
			return null;
		}

		const [year, month, day] = datePart.split("-").map((part) => Number.parseInt(part, 10));
		const [hour, minute] = timePart.split(":").map((part) => Number.parseInt(part, 10));
		if (!year || !month || !day) {
			return null;
		}

		return new Date(Date.UTC(year, month - 1, day, hour || 0, minute || 0));
	}

	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatForInput = (value, format, behavior) => {
	if (!value) {
		return "";
	}

	if (typeof value === "string" && format === DateTimeFormat.DateOnly && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return value;
	}

	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "";
	}

	if (format === DateTimeFormat.DateOnly) {
		return formatUtcDate(date);
	}

	return behavior === "TimeZoneIndependent" ? formatUtcDateTime(date) : formatLocalDateTime(date);
};

export const DateTimeInput = ({ commonProps, dateTimeFormat, dateTimeBehavior }) => {
	const normalizedFormat = normalizeDateTimeFormat(dateTimeFormat);
	const normalizedBehavior = normalizeDateTimeBehavior(dateTimeBehavior);
	const formattedValue = formatForInput(commonProps.value, normalizedFormat, normalizedBehavior);

	const handleChange = (event) => {
		const inputValue = event.target.value;

		if (!inputValue) {
			commonProps.onChange?.(null);
			return;
		}

		let parsedDate = null;
		if (normalizedFormat === DateTimeFormat.DateOnly) {
			parsedDate = parseDateOnlyUtc(inputValue);
		} else {
			parsedDate = parseDateTime(inputValue, normalizedBehavior);
		}

		commonProps.onChange?.(parsedDate ? parsedDate.toISOString() : null);
	};

	const inputProps = {
		...commonProps,
		value: formattedValue,
		onChange: handleChange,
	};

	if (normalizedFormat === DateTimeFormat.DateAndTime) {
		return <input {...inputProps} type="datetime-local" />;
	}

	return <input {...inputProps} type="date" />;
};

DateTimeInput.propTypes = {
	commonProps: PropTypes.shape({
		id: PropTypes.string,
		name: PropTypes.string,
		readOnly: PropTypes.bool,
		required: PropTypes.bool,
		className: PropTypes.string,
		value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
		onChange: PropTypes.func,
		placeholder: PropTypes.string,
	}).isRequired,
	dateTimeFormat: PropTypes.string,
	dateTimeBehavior: PropTypes.string,
};

export default DateTimeInput;
