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

	/*
	return (
		<div className="form-config-skeleton" aria-busy="true" aria-live="polite">
			<section className="form-config-skeleton__banner">
				<div className="form-config-skeleton__banner-text">
					<span className="skeleton skeleton--title skeleton--w-45" />
					<span className="skeleton skeleton--text skeleton--w-65" />
					<span className="skeleton skeleton--text skeleton--w-35" />
				</div>
				<div className="form-config-skeleton__banner-actions">
					<span className="skeleton skeleton--button skeleton--w-20" />
					<span className="skeleton skeleton--button skeleton--w-16" />
					<span className="skeleton skeleton--icon" />
				</div>
			</section>

			<section className="form-config-skeleton__steps">
				<span className="skeleton skeleton--pill skeleton--w-12" />
				<span className="skeleton skeleton--pill skeleton--w-16" />
				<span className="skeleton skeleton--pill skeleton--w-14" />
				<span className="skeleton skeleton--pill skeleton--w-18" />
				<span className="skeleton skeleton--pill skeleton--w-12" />
			</section>

			<section className="form-config-skeleton__body">
				<div className="form-config-skeleton__card">
					<div className="form-config-skeleton__card-header">
						<span className="skeleton skeleton--subtitle skeleton--w-30" />
						<span className="skeleton skeleton--text skeleton--w-20" />
					</div>
					<div className="form-config-skeleton__field">
						<span className="skeleton skeleton--label skeleton--w-18" />
						<span className="skeleton skeleton--input" />
					</div>
					<div className="form-config-skeleton__field">
						<span className="skeleton skeleton--label skeleton--w-22" />
						<span className="skeleton skeleton--input" />
					</div>
					<div className="form-config-skeleton__grid">
						<div className="form-config-skeleton__field">
							<span className="skeleton skeleton--label skeleton--w-35" />
							<span className="skeleton skeleton--input" />
						</div>
						<div className="form-config-skeleton__field">
							<span className="skeleton skeleton--label skeleton--w-28" />
							<span className="skeleton skeleton--input" />
						</div>
					</div>
					<div className="form-config-skeleton__field">
						<span className="skeleton skeleton--label skeleton--w-26" />
						<span className="skeleton skeleton--textarea" />
					</div>
				</div>

				<div className="form-config-skeleton__card">
					<div className="form-config-skeleton__card-header">
						<span className="skeleton skeleton--subtitle skeleton--w-25" />
						<span className="skeleton skeleton--pill skeleton--w-10" />
					</div>
					<div className="form-config-skeleton__field">
						<span className="skeleton skeleton--label skeleton--w-20" />
						<span className="skeleton skeleton--input" />
					</div>
					<div className="form-config-skeleton__field">
						<span className="skeleton skeleton--label skeleton--w-32" />
						<span className="skeleton skeleton--input" />
					</div>
					<div className="form-config-skeleton__footer">
						<span className="skeleton skeleton--button skeleton--w-18" />
						<span className="skeleton skeleton--button skeleton--w-12" />
					</div>
				</div>
			</section>
		</div>
	);
	*/
};

export default FormConfigSkeleton;
