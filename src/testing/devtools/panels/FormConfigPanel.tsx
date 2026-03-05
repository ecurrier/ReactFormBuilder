import { useState } from "react";
import { useDevTools } from "../DevToolsContext";

const formConfigs: { key: string; name: string; description: string }[] = [
	{ key: "formConfigv1", name: "Full Form", description: "All steps, fields, and actions" },
	{ key: "formConfigMinimal", name: "Minimal", description: "1 step, 2 fields" },
	{ key: "formConfigTableEntry", name: "Table Entry", description: "TableEntry-focused form" },
];

export const FormConfigPanel = () => {
	const devTools = useDevTools();
	const [activeConfig, setActiveConfig] = useState("formConfigv1");
	const [loading, setLoading] = useState(false);

	const handleSwitch = async (key: string) => {
		if (key === activeConfig || !devTools) return;
		setLoading(true);
		setActiveConfig(key);
		devTools.reloadWithConfig(key);
		// Give a moment for visual feedback
		setTimeout(() => setLoading(false), 500);
	};

	return (
		<div>
			{!devTools && <small className="text-muted d-block mb-2">Config switching requires debug mode (?debug=true)</small>}
			{formConfigs.map((cfg) => (
				<div className="form-check" key={cfg.key}>
					<input
						className="form-check-input"
						type="radio"
						name="formConfig"
						id={`config-${cfg.key}`}
						value={cfg.key}
						checked={activeConfig === cfg.key}
						onChange={() => handleSwitch(cfg.key)}
						disabled={loading || !devTools}
					/>
					<label className="form-check-label" htmlFor={`config-${cfg.key}`}>
						{cfg.name} <small className="text-muted">— {cfg.description}</small>
					</label>
				</div>
			))}
			{loading && <small className="text-info d-block mt-1">Loading config...</small>}
		</div>
	);
};
