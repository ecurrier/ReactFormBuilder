import { useMockStore } from "../hooks/useMockStore";
import { setForceErrors, setLatencyMode, type LatencyMode } from "../mockStore";

const latencyOptions: { value: LatencyMode; label: string; description: string }[] = [
	{ value: "instant", label: "Instant", description: "0ms" },
	{ value: "realistic", label: "Realistic", description: "500-1500ms" },
	{ value: "slow", label: "Slow", description: "2-4s" },
];

export const MockControlPanel = () => {
	const store = useMockStore();

	return (
		<div>
			<div className="mb-3">
				<div className="form-check form-switch">
					<input
						className="form-check-input"
						type="checkbox"
						role="switch"
						id="devForceErrors"
						checked={store.forceErrors}
						onChange={(e) => setForceErrors(e.target.checked)}
					/>
					<label className="form-check-label" htmlFor="devForceErrors">
						Force API Errors (500)
					</label>
				</div>
				{store.forceErrors && <small className="text-danger d-block mt-1">All API calls will return 500 errors</small>}
			</div>

			<div>
				<label className="form-label mb-1">
					<strong>Network Latency</strong>
				</label>
				{latencyOptions.map((opt) => (
					<div className="form-check" key={opt.value}>
						<input
							className="form-check-input"
							type="radio"
							name="latencyMode"
							id={`latency-${opt.value}`}
							value={opt.value}
							checked={store.latencyMode === opt.value}
							onChange={() => setLatencyMode(opt.value)}
						/>
						<label className="form-check-label" htmlFor={`latency-${opt.value}`}>
							{opt.label} <small className="text-muted">({opt.description})</small>
						</label>
					</div>
				))}
			</div>
		</div>
	);
};
