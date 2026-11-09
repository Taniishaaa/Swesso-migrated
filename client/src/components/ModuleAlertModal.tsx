import React from "react";
import "./css/ModuleAlertModal.css";

type Props = {
  message: string;
  onClose: () => void;
};

const ModuleAlertModal: React.FC<Props> = ({ message, onClose }) => {
  return (
    <div className="module-alert-backdrop">
      <div className="module-alert-modal">
        <p>{message}</p>
        <button onClick={onClose}>OK</button>
      </div>
    </div>
  );
};

export default ModuleAlertModal;
