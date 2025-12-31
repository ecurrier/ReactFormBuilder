import React from "react";

interface ConfirmationModalProps {
	isOpen: boolean;
	title: string;
	message: string;
	confirmText?: string;
	cancelText?: string;
	onConfirm: () => void;
	onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
	isOpen,
	title,
	message,
	confirmText = "Yes",
	cancelText = "No",
	onConfirm,
	onCancel,
}) => {
	if (!isOpen) {
		return null;
	}

	return (
		<>
			<div className="modal-backdrop fade in"></div>
			<div className="modal modal-lookup in" role="dialog" style={{ display: "block" }} aria-modal="true">
				<div className="modal-dialog modal-lg">
					<div className="modal-content">
						<div className="modal-header">
							<h2 className="modal-title">{title}</h2>
						</div>
						<div className="modal-body">{message}</div>
						<div className="modal-footer">
							<button className="btn btn-secondary" onClick={onCancel}>
								{cancelText}
							</button>
							<button className="btn btn-primary" onClick={onConfirm}>
								{confirmText}
							</button>
						</div>
					</div>
				</div>
			</div>
		</>
	);
};

export default ConfirmationModal;
