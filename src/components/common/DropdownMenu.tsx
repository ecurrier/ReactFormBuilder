import React, { useRef, useEffect, useState } from "react";

export interface DropdownMenuItem {
	label: string;
	onClick: () => void;
	variant?: "default" | "danger";
	disabled?: boolean;
}

interface DropdownMenuProps {
	actions: DropdownMenuItem[];
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({ actions }) => {
	const dropdownRef = useRef<HTMLDivElement>(null);
	const [isOpen, setIsOpen] = useState(false);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setIsOpen(false);
			}
		};

		if (isOpen) {
			document.addEventListener("mousedown", handleClickOutside);
		}

		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [isOpen]);

	const handleToggle = () => {
		setIsOpen((prev) => !prev);
	};

	const handleActionClick = (action: DropdownMenuItem) => {
		if (!action.disabled) {
			action.onClick();
			setIsOpen(false);
		}
	};

	return (
		<div className="dropdown action" ref={dropdownRef}>
			<button className="btn btn-default btn-xs aria-exp" onClick={handleToggle} aria-expanded={isOpen} aria-label="action menu">
				<span className="glyphicon glyphicon-menu-down"></span>
			</button>
			<ul className={`dropdown-menu${isOpen ? " show" : ""}`} role="menu">
				{actions.map((action, index) => (
					<li key={index} className={action.disabled ? "disabled" : ""}>
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								handleActionClick(action);
							}}
							disabled={action.disabled}
							style={action.variant === "danger" ? { color: "var(--text-color-danger)" } : undefined}>
							{action.label}
						</button>
					</li>
				))}
			</ul>
		</div>
	);
};

export default DropdownMenu;
