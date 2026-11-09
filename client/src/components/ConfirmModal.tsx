import React from "react";
import "./css/ConfirmModal.css";

type ConfirmModalProps = {
  title?: string;
  message: string;
  warning?: string; 
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  title = "Confirm",
  message,
  warning,
  confirmText = "Delete",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
}) => {
  return (
    <div className="confirm-modal-overlay">
      <div className="confirm-modal">
        <div className="confirm-modal-header">
          <h2>{title}</h2>
          <button className="confirm-modal-close" onClick={onCancel}>
            ✕
          </button>
        </div>

        <div className="confirm-modal-body">
          <p className="confirm-modal-message">{message}</p>
          {warning && (
            <p className="confirm-modal-warning">{warning}</p>
          )}
        </div>

        <div className="confirm-modal-footer">
          <button
            className="confirm-modal-btn confirm-cancel-btn"
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            className="confirm-modal-btn confirm-delete-btn"
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
