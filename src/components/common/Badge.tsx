import React from "react";

export type BadgeType = "default" | "primary" | "success" | "info" | "warning" | "danger";

export interface BadgeProps {
	type: BadgeType;
	content: React.ReactNode;
	dark?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({ content, type = "default", dark = false }) => {
	return <span className={`badge ${dark ? "badge-dark" : ""} badge-${type}`}>{content}</span>;
};

export default Badge;
