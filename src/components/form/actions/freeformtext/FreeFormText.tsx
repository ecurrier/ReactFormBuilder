import React from "react";
import { FreeFormTextStylings } from "@constants/enums";
import type { ReactActionConfiguration, FreeFormTextProperties } from "@app-types";

type FreeFormTextProps = {
	action: ReactActionConfiguration;
};

const FreeFormText: React.FC<FreeFormTextProps> = ({ action }) => {
	const properties = action.Properties as FreeFormTextProperties;

	if (!properties.Content) {
		return null;
	}

	if (properties.Style === FreeFormTextStylings.Header) {
		return <h2>{properties.Content}</h2>;
	}

	return <p>{properties.Content}</p>;
};

export default FreeFormText;
