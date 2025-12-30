import React from "react";
import PropTypes from "prop-types";
import { DateTimeFormat } from "@constants/enums";

export const DateTimeInput = ({ commonProps, dateTimeFormat, dateTimeBehavior }) => {
    // value comes in as "2025-12-30T00:00:00Z"... for date only we need to just use the date portion
    // consider using something like moment.js for more robust date handling
    // may need to deal with converstion later
	switch (dateTimeFormat) {
		case DateTimeFormat.DateOnly:
			return (
				<>
					<input {...commonProps} type="date" />
				</>
			);

			break;
		case DateTimeFormat.DateAndTime:
			return (
				<>
					<input {...commonProps} type="datetime-local" />
				</>
			);
			break;
		default:
			return (
				<>
					<input {...commonProps} type="date" />
				</>
			);
			break;
	}

	/*
	switch (dateTimeBehavior) {
		case "UserLocal":
			// Handle UserLocal behavior
			break;
		case "DateOnly":
			// Handle DateOnly behavior
			break;
		case "TimeZoneIndependent":
			// Handle TimeZoneIndependent behavior
			break;
		default:
			// Handle default or unknown behavior
			break;
	}
            */
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
