import { useState, useCallback, useEffect, Suspense } from "react";
import { useDraggable } from "./hooks/useDraggable";
import { DevConsoleToggle } from "./DevConsoleToggle";
import { MockControlPanel } from "./panels/MockControlPanel";
import { FormConfigPanel } from "./panels/FormConfigPanel";
import { FormStatePanel } from "./panels/FormStatePanel";

type PanelId = "mock" | "config" | "state";

const panels: { id: PanelId; title: string }[] = [
	{ id: "mock", title: "Mock Controls" },
	{ id: "config", title: "Form Config" },
	{ id: "state", title: "Form State" },
];

const DevConsole = () => {
	const [isOpen, setIsOpen] = useState(() => {
		return localStorage.getItem("devConsole:open") === "true";
	});
	const [activePanel, setActivePanel] = useState<PanelId>("mock");
	const { position, onMouseDown } = useDraggable({ x: 20, y: 20 });

	const toggle = useCallback(() => {
		setIsOpen((prev) => {
			const next = !prev;
			localStorage.setItem("devConsole:open", String(next));
			return next;
		});
	}, []);

	// Keyboard shortcut listener (Ctrl+Shift+D)
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.ctrlKey && e.shiftKey && e.key === "D") {
				e.preventDefault();
				toggle();
			}
		};
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [toggle]);

	if (!isOpen) {
		return <DevConsoleToggle onToggle={toggle} />;
	}

	return (
		<div
			className="card shadow"
			style={{
				position: "fixed",
				top: position.y,
				left: position.x,
				zIndex: 9999,
				width: 380,
				maxHeight: "80vh",
				display: "flex",
				flexDirection: "column",
				fontSize: "0.875rem",
			}}>
			{/* Draggable Header */}
			<div
				className="card-header d-flex justify-content-between align-items-center py-2"
				style={{ cursor: "grab", userSelect: "none" }}
				onMouseDown={onMouseDown}>
				<strong>Dev Console</strong>
				<button type="button" className="btn-close btn-close-sm" aria-label="Close" onClick={toggle} onMouseDown={(e) => e.stopPropagation()} />
			</div>

			{/* Tab Navigation */}
			<div className="card-header p-0 border-top-0">
				<ul className="nav nav-tabs card-header-tabs" style={{ fontSize: "0.8rem" }}>
					{panels.map((panel) => (
						<li className="nav-item" key={panel.id}>
							<button className={`nav-link px-3 py-1 ${activePanel === panel.id ? "active" : ""}`} onClick={() => setActivePanel(panel.id)}>
								{panel.title}
							</button>
						</li>
					))}
				</ul>
			</div>

			{/* Panel Content */}
			<div className="card-body" style={{ overflow: "auto" }}>
				<Suspense fallback={<div>Loading...</div>}>
					{activePanel === "mock" && <MockControlPanel />}
					{activePanel === "config" && <FormConfigPanel />}
					{activePanel === "state" && <FormStatePanel />}
				</Suspense>
			</div>

			{/* Footer */}
			<div className="card-footer py-1 text-muted text-center" style={{ fontSize: "0.7rem" }}>
				Ctrl+Shift+D to toggle
			</div>
		</div>
	);
};

export default DevConsole;
