/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../supabaseClient";
import "./css/SMDB.css";
import { generateSMDB } from "../api/modules";
import type { ProjectModuleRow } from "../types/modules";
import ModuleAlertModal from "../components/ModuleAlertModal";
import ConfirmModal from "../components/ConfirmModal";
import ModuleReport from "../components/ModuleReport";

export type { ProjectModuleRow };

type SMDBModuleProps = {
  module: ProjectModuleRow;
  /** No longer used here (pricing happens server-side); kept so the parent needn't change. */
  orgName?: string;
  onModuleChange: (updated: ProjectModuleRow) => void;
  onModuleDeleted: (id?: string) => void;
};

const isolatorSizes = ["800", "630", "400", "300", "250", "200", "160", "125", "100", "80"];
const mccbSizes = ["800", "630", "400", "300", "250", "200", "160", "125", "100", "80"];
const outgoingSizes = [
    "630","400","300","250","200","160","125","100","80",
    "63","50","40","32","25","16","10","sp100"
  ];

const incomerIds = [
    ...isolatorSizes.map(s => `iso${s}`),
    ...mccbSizes.map(s => `mccb${s}`)
  ];


const SMDBModule: React.FC<SMDBModuleProps> = ({
  module,
  onModuleChange,
  onModuleDeleted,
}) => {
  
const initialValues: Record<string, string> = (() => {
  const init: Record<string, string> = {};

  incomerIds.forEach(id => {
    init[id] = "";
    init[`${id}_scc`] = "35kA";
  });

  outgoingSizes.forEach(s => {
    const id = `out_mccb${s}`;
    init[id] = "";
    init[`${id}_scc`] = s === "sp100" ? "25kA" : "35kA";
  });

  ["ryb", "vm_am", "Handle", "PF", "c_bank", "padlock"].forEach(id => {
    init[id] = "";
  });

  init["copperValue"] = "";
  init["labour_800"] = "250";
  init["labour_630"] = "200";
  init["labour_400"] = "175";
  init["labour_300"] = "150";
  init["labour_250"] = "100";
  init["labour_160"] = "90";
  init["labour_125"] = "70";
  init["labour_pf"] = "50";
  init["labour_handle"] = "25";
  init["overheadExpenses"] = "3";
  init["profitPercentage"] = "20";

  return init;
})();

  // -------------------- meta --------------------
  const [title, setTitle] = useState(module.title);
  const [quantity, setQuantity] = useState<number | "">(module.quantity);

  // -------------------- core form state --------------------
  const [brand, setBrand] = useState<string>("");
  const [currentBreakerType, setCurrentBreakerType] = useState<string>("");

  const [values, setValues] = useState<Record<string, string>>(JSON.parse(JSON.stringify(initialValues)));

  const [selectedIncomer, setSelectedIncomer] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // -------------------- report (session only) --------------------
  const [showModal, setShowModal] = useState<boolean>(false);
  const [generating, setGenerating] = useState(false);
const [displayReport, setDisplayReport] = useState<any | null>(null);
const [alertMsg, setAlertMsg] = useState<string | null>(null);
const [confirmOpen, setConfirmOpen] = useState(false);

  // -------------------- basic helpers --------------------
  const setValue = (id: string, value: string) => {
    setValues((prev) => ({ ...prev, [id]: value }));
  };

  const setError = (id: string, msg: string) => {
    setErrors((prev) => ({ ...prev, [id]: msg }));
  };

  const clearError = (id: string) => {
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  // -------------------- effects --------------------
  // lock page scroll while modal is open
  useEffect(() => {
    if (!showModal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev || "";
    };
  }, [showModal]);

useEffect(() => {
  const input = module.input_json || {};

  setTitle(module.title || "");
  setQuantity(module.quantity || "");

  setBrand(input.brand ?? "");
  setCurrentBreakerType(input.currentBreakerType ?? "");

  const clonedValues = input.values
    ? JSON.parse(JSON.stringify(input.values))
    : JSON.parse(JSON.stringify(initialValues));

  setValues(clonedValues);

  setDisplayReport(module.output_json?.display ?? null);

}, [module.id]);

// =====================
// Workspace helpers
// =====================

const handleDelete = () => {
  setConfirmOpen(true);
};

const confirmDelete = async () => {
  setConfirmOpen(false);

  const { error } = await supabase
    .from("project_modules")
    .delete()
    .eq("id", module.id);

  if (error) {
    console.error("Error deleting module:", error);
    setAlertMsg("Error deleting module.");
    return;
  }

  onModuleDeleted();
};

const handleSaveMetaOnly = async () => {
  const inputJson = {
    brand,
    currentBreakerType,
    values,
  };

  if (!title.trim()) {
  setAlertMsg("Module title cannot be empty.");
  return;
}

const { data: existing, error: dupError } = await supabase
  .from("project_modules")
  .select("id")
  .eq("project_id", module.project_id)
  .eq("title", title)
  .neq("id", module.id);

if (dupError) {
  console.error(dupError);
  return;
}

if (existing && existing.length > 0) {
  setAlertMsg("A module with this title already exists in this project.");
  return;
}

  const { error } = await supabase
    .from("project_modules")
    .update({
      title,
      quantity: Number(quantity || 0),
      input_json: inputJson,
      unit_price: module.unit_price,
      total_price: module.total_price,
      output_json: module.output_json,
    })
    .eq("id", module.id);

  if (error) {
    console.error("Error saving SMDB module:", error);
    setAlertMsg("Error saving module.");
    return;
  }

 onModuleChange({
  ...module,
  title,
  quantity: Number(quantity || 0),
  input_json: inputJson,
  output_json: module.output_json,
});

};
// =====================
// Input handlers
// =====================

// Incomer: only one allowed, value must be "1"
const onIncomerInputChange = (id: string, raw: string) => {
  const v = raw.trim();

  if (v === "") {
    clearError(`${id}-error`);
    setValue(id, "");
    setSelectedIncomer(null);
    return;
  }

  if (v !== "1") {
    setError(`${id}-error`, "Only a value of 1 is allowed.");
    return;
  }

  clearError(`${id}-error`);
  setValue(id, "1");
  setSelectedIncomer(id);
};

// Outgoing breakers: digits only
const onOutgoingInputChange = (id: string, raw: string) => {
  const v = raw.trim();

  if (v === "") {
    setValue(id, "");
    return;
  }

  if (!/^\d+$/.test(v)) return;

  setValue(id, v);
};

// Accessories: 0 / 1 only
const onAccessoryChange = (id: string, raw: string) => {
  const v = raw.trim();

  // allow empty
  if (v === "") {
    clearError(`${id}-error`);
    setValue(id, "");
    return;
  }

  // allow ONLY 0 or 1
  if (v !== "0" && v !== "1") {
    setError(`${id}-error`, "Only 0 or 1 allowed.");
    setValue(id, "");   // ⬅️ THIS was missing
    return;
  }

  clearError(`${id}-error`);
  setValue(id, v);
};


// Padlock: numeric only
const onPadlockChange = (raw: string) => {
  const v = raw.trim();
  if (v === "") {
    setValue("padlock", "");
    return;
  }
  if (!/^\d+$/.test(v)) return;
  setValue("padlock", v);
};

// Generic select handler
const onSelectChange = (id: string, value: string) => {
  setValue(id, value);
};

// Brand is NOT stored inside values
const onBrandChange = (value: string) => {
  setBrand(value);
};

const handlecurrentBreakerTypeChange = (type: string) => {
  setCurrentBreakerType(type);

  // reset incomer selections
  incomerIds.forEach(id => {
    setValue(id, "");
    setValue(`${id}_scc`, "35kA");
    clearError(`${id}-error`);
  });

  setSelectedIncomer(null);

  // Isolator rule
  if (type === "Isolator") {
    setValue("Handle", "");
    setError("Handle-error", "Handle cannot be selected for Isolator.");
  } else {
    clearError("Handle-error");
  }
};

const handleReset = async (e?: React.MouseEvent) => {
  e?.preventDefault();

  const clearedValues = JSON.parse(JSON.stringify(initialValues));

  setValues(clearedValues);
  setErrors({});
  setBrand("");
  setCurrentBreakerType("");
  setSelectedIncomer(null);
  setDisplayReport(null);

  const inputJson = {
    brand: "",
    currentBreakerType: "",
    values: clearedValues,
  };

  await supabase
    .from("project_modules")
    .update({
      unit_price: null,
      total_price: null,
      input_json: inputJson,
      output_json: null,
    })
    .eq("id", module.id);

  onModuleChange({
    ...module,
    unit_price: null,
    total_price: null,
    input_json: inputJson,
    output_json: null,
  });
};

async function submitAdditionalInputs() {
  if (generating) return;
  setGenerating(true);
  try {
    // Validation, pricing, labour, enclosure selection and saving all happen in the
    // calc-smdb Edge Function.
    const updated = await generateSMDB({
      moduleId: module.id,
      title,
      quantity,
      input: {
        brand,
        currentBreakerType,
        values,
      },
    });

    setTitle(updated.title);
    setDisplayReport(updated.output_json?.display ?? null);
    setShowModal(false);
    onModuleChange(updated);
  } catch (err) {
    console.error("Error generating SMDB report:", err);
    setAlertMsg(err instanceof Error ? err.message : "Failed to generate report.");
  } finally {
    setGenerating(false);
  }
}

 // ----- Render helpers ----- //
const renderIsolatorInputs = () => (
  <div
    id="isolatorRatings"
    className="breaker-options section"
    style={{ display: currentBreakerType === "Isolator" ? "block" : "none" }}
  >
    <h3>Enter Quantity for Isolators</h3>
    {isolatorSizes.map((size) => {
      const id = `iso${size}`;
      const sccId = `${id}_scc`;
      const disabled = selectedIncomer !== null && selectedIncomer !== id;
      return (
        <div className="breaker-box" key={id}>
          <div className="full-width-field">
            <label htmlFor={id}>{size}A:</label>
            <input
              type="number"
              id={id}
              name={id}
              value={values[id]}
              disabled={disabled}
              onChange={(e) => onIncomerInputChange(id, e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
            />

            <label htmlFor={sccId}>SCC Rating:</label>
            <select
              id={sccId}
              name={sccId}
              value={values[sccId]}
              onChange={(e) => onSelectChange(sccId, e.target.value)}
            >
              <option value="25kA">25kA</option>
              <option value="35kA">35kA</option>
              <option value="50kA">50kA</option>
            </select>
          </div>
          <span className="error-msg" id={`${id}-error`}>
            {errors[`${id}-error`] || ""}
          </span>
        </div>
      );
    })}
  </div>
);

const renderMccbInputs = () => (
  <div
    id="mccbRatings"
    className="breaker-options section"
    style={{ display: currentBreakerType === "MCCB" ? "block" : "none" }}
  >
    <h3>Enter Quantity for MCCBs</h3>
    {mccbSizes.map((size) => {
      const id = `mccb${size}`;
      const sccId = `${id}_scc`;
      const disabled = selectedIncomer !== null && selectedIncomer !== id;
      return (
        <div className="breaker-box" key={id}>
          <div className="full-width-field">
            <label htmlFor={id}>{size}A:</label>
            <input
              type="number"
              id={id}
              name={id}
              value={values[id]}
              disabled={disabled}
              onChange={(e) => onIncomerInputChange(id, e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
            />

            <label htmlFor={sccId}>SCC Rating:</label>
            <select
              id={sccId}
              name={sccId}
              value={values[sccId]}
              onChange={(e) => onSelectChange(sccId, e.target.value)}
            >
              <option value="25kA">25kA</option>
              <option value="35kA">35kA</option>
              <option value="50kA">50kA</option>
            </select>
          </div>
          <span className="error-msg" id={`${id}-error`}>
            {errors[`${id}-error`] || ""}
          </span>
        </div>
      );
    })}
  </div>
);

const renderOutgoingInputs = () => (
  <div id="out_mccbRatings" className="breaker-options section">
    <h3>Outgoing Breakers:</h3>
    {outgoingSizes.map((size) => {
      const id = `out_mccb${size}`;
      const sccId = `${id}_scc`;
      return (
        <div className="breaker-box" key={id}>
          <div className="full-width-field">
            <label htmlFor={id}>{size === "sp100" ? "SP 100A" : `${size}A`}:</label>
            <input
              type="number"
              id={id}
              name={id}
              value={values[id]}
              onChange={(e) => onOutgoingInputChange(id, e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
            />

            <label htmlFor={sccId}>SCC Rating:</label>
            <select
              id={sccId}
              name={sccId}
              value={values[sccId]}
              onChange={(e) => onSelectChange(sccId, e.target.value)}
            >
              <option value="25kA">25kA</option>
              <option value="35kA">35kA</option>
              <option value="50kA">50kA</option>
            </select>
          </div>
          <span className="error-msg" id={`${id}-error`}>
            {errors[`${id}-error`] || ""}
          </span>
        </div>
      );
    })}
  </div>
);

const renderOtherComponents = () => (
  <div className="section other-components">
    <h3 style={{ gridColumn: "1 / -1" }}>Other Components:</h3>

    <div>
      <label htmlFor="ryb">RYB:</label>
      <input type="number" id="ryb" name="ryb" value={values["ryb"]} onChange={(e) => onAccessoryChange("ryb", e.target.value)} onWheel={(e) => e.currentTarget.blur()} />
      <span className="error-msg" id="ryb-error">{errors["ryb-error"] || ""}</span>
    </div>

    <div>
      <label htmlFor="vm_am">VM / AM :</label>
      <input type="number" id="vm_am" name="vm_am" value={values["vm_am"]} onChange={(e) => onAccessoryChange("vm_am", e.target.value)} onWheel={(e) => e.currentTarget.blur()}/>
      <span className="error-msg" id="vm_am-error">{errors["vm_am-error"] || ""}</span>
    </div>

    <div>
      <label htmlFor="Handle">Handle:</label>
      <input type="number" id="Handle" name="Handle" value={values["Handle"]} onChange={(e) => onAccessoryChange("Handle", e.target.value)} disabled={currentBreakerType === "Isolator"} onWheel={(e) => e.currentTarget.blur()}/>
      <span className="error-msg" id="Handle-error">{errors["Handle-error"] || ""}</span>
    </div>

    <div>
      <label htmlFor="PF">PF Meter:</label>
      <input type="number" id="PF" name="PF" value={values["PF"]} onChange={(e) => onAccessoryChange("PF", e.target.value)} onWheel={(e) => e.currentTarget.blur()} />
      <span className="error-msg" id="PF-error">{errors["PF-error"] || ""}</span>
    </div>

    <div>
      <label htmlFor="padlock">Padlocks</label>
      <input type="number" id="padlock" name="padlock" value={values["padlock"]} onChange={(e) => onPadlockChange(e.target.value)} onWheel={(e) => e.currentTarget.blur()}/>
    </div>
  </div>
);

return (
  <>
    <div className="smdb-page">
      {/* ===== Workspace Toolbar (like smdb / DBRow) ===== */}
      <div className="smdb-module-toolbar">
        <div className="smdb-module-toolbar-left">
          <div className="smdb-module-title">
            <span>Title:</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Module name"
          />
          </div>
          <div className="smdb-module-qty">
            <span>Qty:</span>
            <input
  type="number"
  value={quantity}
  onChange={(e) => {
    const v = e.target.value;
    setQuantity(v === "" ? "" : Number(v));
  }}
  onWheel={(e) => e.currentTarget.blur()}
/>
          </div>
        </div>
        <div className="smdb-module-toolbar-right">
          <button
            type="button"
            className="smdb-delete-button"
            onClick={handleDelete}
          >
            Delete
          </button>
          <button
            type="button"
            className="smdb-save-button"
            onClick={handleSaveMetaOnly}
          >
            Save
          </button>
        </div>
      </div>

      <h2>SMDB</h2>

      <form id="SMDBForm" onSubmit={(e) => e.preventDefault()}>
        {/* ===== Incomer Selection ===== */}
        <div className="section breaker-selection">
          <div>
            <label htmlFor="currentBreakerType">
              Select Breaker Type (Incomer):
            </label>
            <select
              id="currentBreakerType"
              required
              value={currentBreakerType}
              onChange={(e) =>
                handlecurrentBreakerTypeChange(e.target.value)
              }
            >
              <option value="">-- Select --</option>
              <option value="Isolator">Isolator</option>
              <option value="MCCB">MCCB</option>
            </select>
          </div>

          <div>
            <label htmlFor="brand">Choose the type of breaker:</label>
            <select
              id="brand"
              required
              value={brand}
              onChange={(e) => onBrandChange(e.target.value)}
            >
              <option value="" disabled>
                Select a breaker
              </option>
              <option value="ABB">ABB</option>
              <option value="MG">MG</option>
              <option value="GE">GE</option>
              <option value="CUTLERH">CUTLERH</option>
              <option value="SEIMENS">SEIMENS</option>
              <option value="LG">LG</option>
              <option value="L&T">L&T</option>
              <option value="DSMITH">DSMITH</option>
              <option value="NEW">NEW</option>
              <option value="Y">Y</option>
              <option value="Z">Z</option>
            </select>
          </div>
        </div>

        {renderIsolatorInputs()}
        {renderMccbInputs()}
        {renderOutgoingInputs()}
        {renderOtherComponents()}

        {/* ===== Action Buttons ===== */}
<div className="module-action-row">
  <button
    type="button"
    className="module-btn module-btn-primary"
    onClick={() => setShowModal(true)}
  >
    Generate Report
  </button>

  <button
    type="reset"
    className="module-btn module-btn-secondary"
    onClick={handleReset}
  >
    Reset
  </button>
</div>

<ModuleReport report={displayReport} />
      </form>
    </div>

    {/* ===== Cost Modal ===== */}
    {showModal &&
      createPortal(
        <div id="costModal" className="modal-overlay">
          <div className="modal-content">
            <h3>Enter Additional Costs</h3>

            <div className="modal-field">
              <label htmlFor="copperValue">Copper Value:</label>
              <input
                type="number"
                id="copperValue"
                placeholder="Default = 47"
                value={values["copperValue"]}
                onChange={(e) =>
                  setValue("copperValue", e.target.value)
                }
                onWheel={(e) => e.currentTarget.blur()}
              />
            </div>

            <h3>Labour Cost Configuration (AED per unit)</h3>

            {[
              { id: "labour_800", label: "800A" },
              { id: "labour_630", label: "630A" },
              { id: "labour_400", label: "400A" },
              { id: "labour_300", label: "300A" },
              { id: "labour_250", label: "250A and 200A" },
              { id: "labour_160", label: "160A" },
              { id: "labour_125", label: "125A - upto sp 100A" },
              { id: "labour_pf", label: "PF Meter" },
              { id: "labour_handle", label: "Handle" },
              { id: "overheadExpenses", label: "Overhead Expenses (%)" },
              { id: "profitPercentage", label: "Profit Percentage (%)" },
            ].map(({ id, label }) => (
              <div className="modal-field" key={id}>
                <label htmlFor={id}>{label}</label>
                <input
                  type="number"
                  id={id}
                  value={values[id]}
                  onChange={(e) =>
                    setValue(id, e.target.value)
                  }
                  onWheel={(e) => e.currentTarget.blur()}
                />
              </div>
            ))}

            <div className="modal-buttons">
              <button
                type="button"
                onClick={async () => await submitAdditionalInputs()}
                disabled={generating}
              >
                {generating ? "Generating..." : "Continue"}
              </button>
              <button
                type="button"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {alertMsg && (
  <ModuleAlertModal
    message={alertMsg}
    onClose={() => setAlertMsg(null)}
  />
)}

{confirmOpen && (
  <ConfirmModal
  title="Delete Module"
  message="Are you sure you want to delete this module from the project?"
  warning="This action cannot be undone."
  confirmText="Delete"
  cancelText="Cancel"
  onConfirm={confirmDelete}
  onCancel={() => setConfirmOpen(false)}
/>
)}

  </>
);


};


export default SMDBModule;