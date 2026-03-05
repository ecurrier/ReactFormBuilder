import { useEffect } from "react";

interface DevConsoleToggleProps {
	onToggle: () => void;
}

export const DevConsoleToggle = ({ onToggle }: DevConsoleToggleProps) => {
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.ctrlKey && e.shiftKey && e.key === "D") {
				e.preventDefault();
				onToggle();
			}
		};
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [onToggle]);

	return (
		<button
			onClick={onToggle}
			title="Dev Console (Ctrl+Shift+D)"
			style={{
				position: "fixed",
				bottom: 16,
				right: 16,
				zIndex: 9999,
				width: 40,
				height: 40,
				borderRadius: "50%",
				border: "2px solid #0d6efd",
				background: "#fff",
				color: "#0d6efd",
				fontSize: 18,
				fontWeight: "bold",
				cursor: "pointer",
				boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
			}}>
			D
		</button>
	);
};
