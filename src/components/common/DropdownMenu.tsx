import React, { useRef, useEffect } from "react";

export interface DropdownMenuItem {
	label: string;
	onClick: () => void;
	variant?: "default" | "danger";
	disabled?: boolean;
}

interface DropdownMenuProps {
	isOpen: boolean;
	onClose: () => void;
	items: DropdownMenuItem[];
	align?: "left" | "right";
	position?: "below" | "side";
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({ isOpen, onClose, items, align = "right", position = "below" }) => {
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!isOpen) return;

		const handleClickOutside = (event: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				onClose();
			}
		};

		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				onClose();
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		document.addEventListener("keydown", handleEscape);

		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
			document.removeEventListener("keydown", handleEscape);
		};
	}, [isOpen, onClose]);

	if (!isOpen) return null;
	const positionStyles: React.CSSProperties =
		position === "side"
			? {
					top: 0,
					left: align === "right" ? "100%" : "auto",
					right: align === "left" ? "100%" : "auto",
					marginLeft: align === "right" ? "0.5rem" : "0",
					marginRight: align === "left" ? "0.5rem" : "0",
				}
			: {};

	return (
		<ul ref={menuRef} className={`dropdown-menu ${align === "right" ? "dropdown-menu-right" : "dropdown-menu-left"}`} style={positionStyles}>
			{items.map((item, index) => (
				<li key={index} className={item.disabled ? "disabled" : ""}>
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							if (!item.disabled) {
								item.onClick();
								onClose();
							}
						}}
						disabled={item.disabled}
						style={item.variant === "danger" ? { color: "var(--text-color-danger)" } : undefined}>
						{item.label}
					</button>
				</li>
			))}
		</ul>
	);
};

export default DropdownMenu;
