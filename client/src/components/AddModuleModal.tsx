import React from "react";
import "../pages/css/ProjectWorkspace.css";

type AddModuleModalProps = {
  creating: boolean;
  onClose: () => void;
  onChoose: (moduleType: string) => void;
};

const MODULE_TYPES = [
  { type: "SMDB", label: "SMDB" },
  { type: "MDB", label: "MDB - Form 2" },
  { type: "DBROW", label: "DB Row" },
  { type: "CBANK800", label: "Capacitor Bank 800" },
  { type: "FORM4", label: "MDB - Form 4" },
  { type: "METERBOX", label: "Meter Box" },

];

const AddModuleModal: React.FC<AddModuleModalProps> = ({
  creating,
  onClose,
  onChoose,
}) => {
  return (
    <div
      className="project-modal-backdrop"
      onClick={() => {
        if (!creating) onClose();
      }}
    >
      <div
        className="project-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="project-modal-header">
          <h3 className="project-modal-title">Select a Module</h3>
          <button
            type="button"
            className="project-modal-close"
            onClick={() => {
              if (!creating) onClose();
            }}
          >
            ×
          </button>
        </div>

        <p className="project-modal-text">
          Choose the type of module you want to add to this project.
        </p>

        <div className="project-modal-grid">
          {MODULE_TYPES.map((mt) => (
            <button
              key={mt.type}
              type="button"
              className="project-modal-option"
              disabled={creating}
              onClick={() => onChoose(mt.type)}
            >
              <div className="project-modal-option-title">
                {mt.label}
              </div>
            </button>
          ))}
        </div>

        {creating && (
          <p className="project-modal-footer-text">
            Creating module...
          </p>
        )}
      </div>
    </div>
  );
};

export default AddModuleModal;
