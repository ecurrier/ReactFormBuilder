import React from "react";

export interface LoadingIndicatorProps {
	visible?: boolean;
	variant?: "contextual" | "inline" | "full-screen";
	message?: string;
	children?: React.ReactNode;
	showSpinner?: boolean;
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
	visible = false,
	variant = "contextual",
	message = "Loading...",
	children,
	showSpinner = true,
}) => {
	return (
		<div className={`loading-ui ${variant} ${visible ? "visible" : ""}`} role="alert" aria-live="assertive" aria-busy="true">
			<div>
				<div className="loading-ui-header">
					{showSpinner && (
						<div className="spinner">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								xmlnsXlink="http://www.w3.org/1999/xlink"
								width="50px"
								height="50px"
								viewBox="0 0 100 100"
								preserveAspectRatio="xMidYMid"
								aria-hidden="true">
								<g>
									<circle cx="83.321" cy="75.568" r="6">
										<animateTransform
											attributeName="transform"
											type="rotate"
											calcMode="spline"
											values="0 50 50;360 50 50"
											keyTimes="0;1"
											keySplines="0.5 0 0.5 1"
											repeatCount="indefinite"
											dur="1.4s"
											begin="0s"></animateTransform>
									</circle>
									<circle cx="75.568" cy="83.321" r="6">
										<animateTransform
											attributeName="transform"
											type="rotate"
											calcMode="spline"
											values="0 50 50;360 50 50"
											keyTimes="0;1"
											keySplines="0.5 0 0.5 1"
											repeatCount="indefinite"
											dur="1.4s"
											begin="-0.062s"></animateTransform>
									</circle>
									<circle cx="66.073" cy="88.803" r="6">
										<animateTransform
											attributeName="transform"
											type="rotate"
											calcMode="spline"
											values="0 50 50;360 50 50"
											keyTimes="0;1"
											keySplines="0.5 0 0.5 1"
											repeatCount="indefinite"
											dur="1.4s"
											begin="-0.125s"></animateTransform>
									</circle>
									<circle cx="55.482" cy="91.641" r="6">
										<animateTransform
											attributeName="transform"
											type="rotate"
											calcMode="spline"
											values="0 50 50;360 50 50"
											keyTimes="0;1"
											keySplines="0.5 0 0.5 1"
											repeatCount="indefinite"
											dur="1.4s"
											begin="-0.187s"></animateTransform>
									</circle>
									<circle cx="44.518" cy="91.641" r="6">
										<animateTransform
											attributeName="transform"
											type="rotate"
											calcMode="spline"
											values="0 50 50;360 50 50"
											keyTimes="0;1"
											keySplines="0.5 0 0.5 1"
											repeatCount="indefinite"
											dur="1.4s"
											begin="-0.25s"></animateTransform>
									</circle>
									<circle cx="33.927" cy="88.803" r="6">
										<animateTransform
											attributeName="transform"
											type="rotate"
											calcMode="spline"
											values="0 50 50;360 50 50"
											keyTimes="0;1"
											keySplines="0.5 0 0.5 1"
											repeatCount="indefinite"
											dur="1.4s"
											begin="-0.312s"></animateTransform>
									</circle>
									<circle cx="24.432" cy="83.321" r="6">
										<animateTransform
											attributeName="transform"
											type="rotate"
											calcMode="spline"
											values="0 50 50;360 50 50"
											keyTimes="0;1"
											keySplines="0.5 0 0.5 1"
											repeatCount="indefinite"
											dur="1.4s"
											begin="-0.375s"></animateTransform>
									</circle>
									<circle cx="16.679" cy="75.568" r="6">
										<animateTransform
											attributeName="transform"
											type="rotate"
											calcMode="spline"
											values="0 50 50;360 50 50"
											keyTimes="0;1"
											keySplines="0.5 0 0.5 1"
											repeatCount="indefinite"
											dur="1.4s"
											begin="-0.437s"></animateTransform>
									</circle>
									<animateTransform
										attributeName="transform"
										type="rotate"
										calcMode="spline"
										values="0 50 50;0 50 50"
										keyTimes="0;1"
										keySplines="0.5 0 0.5 1"
										repeatCount="indefinite"
										dur="1.4s"></animateTransform>
								</g>
							</svg>
						</div>
					)}
					<p>{message}</p>
				</div>
				{children}
			</div>
		</div>
	);
};

export default LoadingIndicator;
