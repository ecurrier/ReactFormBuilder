import React from "react";

const FormConfigSkeleton: React.FC = () => {
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
};

export default FormConfigSkeleton;
