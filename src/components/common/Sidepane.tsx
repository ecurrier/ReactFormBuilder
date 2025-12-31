import React, { useEffect, useRef } from "react";

export interface SidepaneProps {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	children: React.ReactNode;
	width?: string;
}

export const Sidepane: React.FC<SidepaneProps> = ({ isOpen, onClose, title, children, width = "500px" }) => {
	const panelRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape" && isOpen) {
				onClose();
			}
		};

		if (isOpen) {
			document.addEventListener("keydown", handleEscape);
			document.body.style.overflow = "hidden";
		}

		return () => {
			document.removeEventListener("keydown", handleEscape);
			document.body.style.overflow = "";
		};
	}, [isOpen, onClose]);

	if (!isOpen) return null;

	return (
		<>
			<div className="sidepane-overlay" onClick={onClose} />
			<div ref={panelRef} className="sidepane" style={{ width }}>
				<div className="sidepane-header">
					<h2 className="sidepane-title">{title}</h2>
					<button type="button" className="sidepane-close" onClick={onClose} aria-label="Close">
						<span aria-hidden="true">&times;</span>
					</button>
				</div>
				<div className="sidepane-content">{children}</div>
			</div>
		</>
	);
};

export default Sidepane;
