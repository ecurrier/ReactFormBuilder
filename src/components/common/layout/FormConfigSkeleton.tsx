import React from "react";

const FormConfigSkeleton: React.FC = () => {
	return (
		<div aria-busy="true" aria-live="polite">
			<div className="banner">
				<div className="container">
					<div className="banner-main-content">
						<div className="banner-title">
							<h1>
								<span className="skeleton skeleton--title skeleton--w-45" />
							</h1>
						</div>
						<div className="banner-details form-config-skeleton__banner-text">
							<p>
								<span className="skeleton skeleton--text skeleton--w-100 mb-2" />
								<span className="skeleton skeleton--text skeleton--w-100 mb-2" />
								<span className="skeleton skeleton--text skeleton--w-45" />
							</p>
						</div>
						<div className="banner-actions-primary">
							<button type="button" className="btn btn-default skeleton skeleton--button"></button>
							<button type="button" className="btn btn-default skeleton skeleton--button"></button>
						</div>
					</div>
				</div>
			</div>
			<div className="body-content">
				<div className="container">
					<div className="multi-step-form-layout">
						<nav className="multi-step-form-list-group">
							<div className="progress list-group left">
								<span className="skeleton skeleton--pill--tall skeleton--w-80" />
								<span className="skeleton skeleton--pill--tall skeleton--w-80" />
								<span className="skeleton skeleton--pill--tall skeleton--w-80" />
								<span className="skeleton skeleton--pill--tall skeleton--w-80" />
								<span className="skeleton skeleton--pill--tall skeleton--w-80" />
							</div>
						</nav>
						<div className="steps-container">
							<section className="form-config-skeleton__body">
								<div>
									<h1>
										<span className="skeleton skeleton--title skeleton--w-45" />
									</h1>
									<div className="form-config-skeleton__field mb-3">
										<span className="skeleton skeleton--label skeleton--w-18" />
										<span className="skeleton skeleton--input" />
									</div>
									<div className="form-config-skeleton__field mb-3">
										<span className="skeleton skeleton--label skeleton--w-18" />
										<span className="skeleton skeleton--input" />
									</div>
									<div className="form-config-skeleton__field mb-3">
										<span className="skeleton skeleton--label skeleton--w-18" />
										<span className="skeleton skeleton--textarea" />
									</div>
								</div>
							</section>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default FormConfigSkeleton;
