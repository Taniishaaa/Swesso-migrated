import React, { useEffect, useState } from "react";
import "./css/dbrow.css";
import { supabase } from "../supabaseClient";
import { createPortal } from "react-dom";
import { generateDBRow } from "../api/modules";
import type { ProjectModuleRow } from "../types/modules";
import ModuleAlertModal from "../components/ModuleAlertModal";
import ConfirmModal from "../components/ConfirmModal";
import ModuleReport from "../components/ModuleReport";

export type { ProjectModuleRow };

// -------------------- constants --------------------
const isoIds = [125, 100, 80, 63, 40, 32, 20, 16];
const elcbIds = [100, 63, 40];
const mcbIds = [10, 50];
const conIds = [20, 40, 63];

const createInitialCounts = () => {
    const obj: Record<string, string> = {};
    isoIds.forEach((n) => {
      obj[`iso${n}`] = "";
      obj[`iso${n}_pole`] = "TP";
    });

    elcbIds.forEach((n) => {
      obj[`elcb${n}`] = "";
      obj[`elcb${n}_pole`] = "2P";
      obj[`elcb${n}_elr`] = "300MA";
    });

    mcbIds.forEach((n) => {
      obj[`mcb${n}`] = "";
      obj[`mcb${n}_pole`] = "SP";
    });

    conIds.forEach((n) => {
      obj[`con${n}`] = "";
      // 63A contactor must be 3P only
      obj[`con${n}_pole`] = n === 63 ? "3P" : "DP";
    });

    obj["conTimer"] = "";
    obj["con_strTimer"] = "";
    obj["c_others"] = "";

    return obj;
  };

type DBRowModuleProps = {
  module: ProjectModuleRow;
  /** No longer used here (pricing happens server-side); kept so the parent needn't change. */
  orgName?: string;
  onModuleChange: (updated: ProjectModuleRow) => void;
  onModuleDeleted: () => void;
};

const DBRowModule: React.FC<DBRowModuleProps> = ({
  module,
  onModuleChange,
  onModuleDeleted,
}) => {
  // -------------------- hydration --------------------

const [title, setTitle] = useState("");
const [quantity, setQuantity] = useState<number | "">(1);

const [brand, setBrand] = useState<string>("");
const [sccRating, setSccRating] = useState<string>("6kA");

const [counts, setCounts] = useState<Record<string, string>>(createInitialCounts());

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [persistentErrors, setPersistentErrors] = useState<Record<string, string>>({});
  // modal + controlled modal inputs
  const [showModal, setShowModal] = useState(false);
 const [labour16, setLabour16] = useState<number>(20);
const [labour24, setLabour24] = useState<number>(25);
const [overheadPercent, setOverheadPercent] = useState<number>(3);
const [profitPercent, setProfitPercent] = useState<number>(20);
const [generating, setGenerating] = useState(false);

  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [displayReport, setDisplayReport] = useState<any | null>(null);

  // -------------------- effects --------------------
// -------- hydrate when module changes --------
useEffect(() => {
  if (!module) return;

  const input = module.input_json || {};

  // basic meta
  setTitle(module.title || "");
  setQuantity(module.quantity ?? 1);

  // breaker info
  setBrand(input.brand || "");
  setSccRating(input.sccRating || "6kA");

  // counts
  setCounts(input.counts || createInitialCounts());

  // costing fields
  setLabour16(input.labour16 ?? 20);
  setLabour24(input.labour24 ?? 25);
  setOverheadPercent(input.overheadPercent ?? 3);
  setProfitPercent(input.profitPercent ?? 20);

  // restore report if exists
  setDisplayReport(module.output_json?.display ?? null);

// eslint-disable-next-line react-hooks/exhaustive-deps
}, [module.id]);

  // lock page scroll while modal is open
  useEffect(() => {
    if (!showModal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev || "";
    };
  }, [showModal]);

  // transient isolator errors
  useEffect(() => {
    const newTransient: Record<string, string> = {};
    isoIds.forEach((n) => {
      const key = `iso${n}`;
      const val = (counts[key] || "").toString().trim();
      newTransient[`${key}-error`] =
        val !== "" && val !== "1" ? "Only a value of 1 is allowed." : "";
    });
    setErrors((prev) => ({ ...prev, ...newTransient }));
  }, [counts]);

  // -------------------- helpers --------------------
  const handleCountChange = (key: string, value: string) => {
    const isMoney = key === "c_others";
    const sanitized = isMoney
      ? value.replace(/[^0-9.]/g, "")
      : value.replace(/[^0-9]/g, "");

    if (key.startsWith("iso")) {
      setCounts((prev) => ({ ...prev, [key]: sanitized }));
      const num = parseInt(sanitized || "0", 10) || 0;
      if (num > 1) {
        setCounts((prev) => ({ ...prev, [key]: "" }));
        setPersistentErrors((prev) => ({
          ...prev,
          [`${key}-error`]: "Only a value of 1 is allowed.",
        }));
        setErrors((prev) => ({ ...prev, [`${key}-error`]: "" }));
        return;
      }
      setPersistentErrors((prev) => {
        const copy = { ...prev };
        delete copy[`${key}-error`];
        return copy;
      });
      setErrors((prev) => ({ ...prev, [`${key}-error`]: "" }));
      return;
    }

    setCounts((prev) => ({ ...prev, [key]: sanitized }));
  };

  const handlePoleChange = (key: string, value: string) => {
    if (key === "con63_pole") return;
    setCounts((prev) => ({ ...prev, [key]: value }));
  };

//handlers
async function handleGenerateReport() {
  if (generating) return;
  setGenerating(true);
  try {
    // Validation, pricing, layout and saving all happen in the calc-dbrow Edge Function.
    const updated = await generateDBRow({
      moduleId: module.id,
      title,
      quantity,
      input: {
        brand,
        sccRating,
        counts,
        labour16,
        labour24,
        overheadPercent,
        profitPercent,
      },
    });

    setTitle(updated.title);
    setDisplayReport(updated.output_json?.display ?? null);
    setShowModal(false);
    onModuleChange(updated);
  } catch (err) {
    console.error("Error generating DBRow report:", err);
    setAlertMsg(err instanceof Error ? err.message : "Failed to generate report.");
  } finally {
    setGenerating(false);
  }
}

const resetCounts = async () => {
  if (!window.confirm("Reset all inputs and calculated values?")) return;

  const clearedInput = {
    brand: "",
    sccRating: "6kA",
    counts: createInitialCounts(),
    labour16: 20,
    labour24: 25,
    overheadPercent: 3,
    profitPercent: 20,
  };

  const { error } = await supabase
    .from("project_modules")
    .update({
      unit_price: null,
      total_price: null,
      input_json: clearedInput,
      output_json: null,
    })
    .eq("id", module.id);

  if (error) {
    console.error("Error resetting DBRow module:", error);
    setAlertMsg("Failed to reset module.");
    return;
  }

  // UI reset
  setBrand("");
  setSccRating("6kA");
  setCounts(clearedInput.counts);
  setLabour16(20);
  setLabour24(25);
  setOverheadPercent(3);
  setProfitPercent(20);
  setDisplayReport(null);

  // Notify workspace
  onModuleChange({
    ...module,
    unit_price: null,
    total_price: null,
    input_json: clearedInput,
    output_json: null,
  });
};

const handleSaveMetaOnly = async () => {

  // ===== TITLE VALIDATION =====
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

  const inputJson = {
    brand,
    sccRating,
    counts,
    labour16,
    labour24,
    overheadPercent,
    profitPercent,
  };

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
    console.error("Error saving DBRow module:", error);
    setAlertMsg("Error saving module.");
    return;
  }

  onModuleChange({
    ...module,
    title,
    quantity: Number(quantity || 0),
    input_json: inputJson,
  });
};

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

const selectedIncomer = isoIds
    .map((n) => `iso${n}`)
    .find((id) => counts[id] === "1");

  // -------------------- render --------------------
return (
  <>
    <div className="dbrow-page">
      {/* ===== ProjectWorkspace Toolbar (dbrow-style) ===== */}
      <div className="dbrow-module-toolbar">
        <div className="dbrow-module-toolbar-left">
          <div className="dbrow-module-title">
            <span>Title:</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Module name"
          />
          </div>
          <div className="dbrow-module-qty">
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
        <div className="dbrow-module-toolbar-right">
          <button
            type="button"
            className="dbrow-delete-button"
            onClick={handleDelete}
          >
            Delete
          </button>
          <button
            type="button"
            className="dbrow-save-button"
            onClick={handleSaveMetaOnly}
          >
            Save
          </button>
        </div>
      </div>

      {/* ===== DBROW MODULE CONTENT (UNCHANGED) ===== */}
      <div id="DBRowModule" className="container">
        <h2>DB-Row</h2>

        <div className="space-y-4">
          {/* Breaker type + SCC rating */}
          <section className="card breaker-box dbrow-top-box">
            <div className="full-width-field full-width-field-top">
              <label>Type of breaker:</label>
              <select value={brand} onChange={(e) => setBrand(e.target.value)}>
                <option value="">Select a breaker</option>
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

              <label>SCC Rating:</label>
              <select
                value={sccRating}
                onChange={(e) => setSccRating(e.target.value)}
              >
                <option value="3kA">3kA</option>
                <option value="6kA">6kA</option>
                <option value="10kA">10kA</option>
              </select>
            </div>
          </section>

          {/* ISOLATORS */}
          <section>
            <h3>Enter Quantity for Isolators</h3>

            {isoIds.map((amp) => (
              <div
                key={amp}
                className="field-card breaker-box dbrow-box dbrow-box-iso"
              >
                <div className="full-width-field full-width-field-iso">
                  <label className="dbrow-label-amp">{amp}A:</label>

                  <input
                    type="text"
                    value={counts[`iso${amp}`]}
                    onChange={(e) =>
                      handleCountChange(`iso${amp}`, e.target.value)
                    }
                    disabled={
                      !!selectedIncomer && selectedIncomer !== `iso${amp}`
                    }
                    className={
                      errors[`iso${amp}-error`] ||
                      persistentErrors[`iso${amp}-error`]
                        ? "border-red-600"
                        : ""
                    }
                  />

                  <label className="dbrow-label-attr">Pole Rating:</label>
                  <select
                    value={counts[`iso${amp}_pole`]}
                    onChange={(e) =>
                      handlePoleChange(`iso${amp}_pole`, e.target.value)
                    }
                  >
                    <option value="DP">2 Pole</option>
                    <option value="TP">3 Pole</option>
                    <option value="4P">4 Pole</option>
                  </select>
                </div>

                <span className="error-msg dbrow-error">
                  {persistentErrors[`iso${amp}-error`] ||
                    errors[`iso${amp}-error`] ||
                    ""}
                </span>
              </div>
            ))}
          </section>

          {/* ELCBs */}
          <section>
            <h3>ELCBs</h3>

            {elcbIds.map((amp) => (
              <div
                key={amp}
                className="field-card breaker-box dbrow-box dbrow-box-elcb"
              >
                <div className="full-width-field full-width-field-elcb">
                  <label className="dbrow-label-amp">{amp}A:</label>

                  <input
                    type="text"
                    value={counts[`elcb${amp}`]}
                    onChange={(e) =>
                      handleCountChange(`elcb${amp}`, e.target.value)
                    }
                  />

                  <label className="dbrow-label-attr">Pole:</label>
                  <select
                    value={counts[`elcb${amp}_pole`]}
                    onChange={(e) =>
                      handlePoleChange(`elcb${amp}_pole`, e.target.value)
                    }
                  >
                    <option value="2P">2 Pole</option>
                    <option value="4P">4 Pole</option>
                  </select>

                  <label className="dbrow-label-attr">ELR:</label>
                  <select
                    value={counts[`elcb${amp}_elr`]}
                    onChange={(e) =>
                      handlePoleChange(`elcb${amp}_elr`, e.target.value)
                    }
                  >
                    <option value="300MA">300MA</option>
                    <option value="100MA">100MA</option>
                    {(amp === 63 || amp === 40) && (
                      <option value="30MA">30MA</option>
                    )}
                  </select>
                </div>
              </div>
            ))}
          </section>

          {/* MCBs */}
          <section>
            <h3>MCBs</h3>

            {mcbIds.map((id) => (
              <div
                key={id}
                className="field-card breaker-box dbrow-box dbrow-box-mcb"
              >
                <div className="full-width-field full-width-field-mcb">
                  <label className="dbrow-label-amp">
                    {id === 10 ? "10-40A:" : "50/60A:"}
                  </label>

                  <input
                    type="text"
                    value={counts[`mcb${id}`]}
                    onChange={(e) =>
                      handleCountChange(`mcb${id}`, e.target.value)
                    }
                  />

                  <label className="dbrow-label-attr">Pole:</label>
                  <select
                    value={counts[`mcb${id}_pole`]}
                    onChange={(e) =>
                      handlePoleChange(`mcb${id}_pole`, e.target.value)
                    }
                  >
                    <option value="SP">1 Pole</option>
                    <option value="TP">3 Pole</option>
                  </select>
                </div>
              </div>
            ))}
          </section>

          {/* Contactors & Accessories */}
          <section>
            <h3>Contactors & Accessories</h3>

            {conIds.map((amp) => (
              <div
                key={amp}
                className="field-card breaker-box dbrow-box dbrow-box-con"
              >
                <div className="full-width-field full-width-field-con">
                  <label className="dbrow-label-amp">{amp}A Contactor:</label>

                  <input
                    type="text"
                    value={counts[`con${amp}`]}
                    onChange={(e) =>
                      handleCountChange(`con${amp}`, e.target.value)
                    }
                  />

                  <label className="dbrow-label-attr">Pole:</label>
                  {amp === 63 ? (
                    <select value="3P" disabled>
                      <option value="3P">3 Pole</option>
                    </select>
                  ) : (
                    <select
                      value={counts[`con${amp}_pole`]}
                      onChange={(e) =>
                        handlePoleChange(`con${amp}_pole`, e.target.value)
                      }
                    >
                      <option value="DP">2 Pole</option>
                      <option value="TP">3 Pole</option>
                    </select>
                  )}
                </div>
              </div>
            ))}

            <div className="field-card breaker-box dbrow-box dbrow-box-simple">
              <div className="full-width-field full-width-field-simple">
                <label className="dbrow-label-amp">24hr Timers</label>
                <input
                  type="text"
                  value={counts["conTimer"]}
                  onChange={(e) =>
                    handleCountChange("conTimer", e.target.value)
                  }
                />
              </div>
            </div>

            <div className="field-card breaker-box dbrow-box dbrow-box-simple">
              <div className="full-width-field full-width-field-simple">
                <label className="dbrow-label-amp">Staircase Timers</label>
                <input
                  type="text"
                  value={counts["con_strTimer"]}
                  onChange={(e) =>
                    handleCountChange("con_strTimer", e.target.value)
                  }
                />
              </div>
            </div>

            <div className="field-card breaker-box dbrow-box dbrow-box-simple">
              <div className="full-width-field full-width-field-simple">
                <label className="dbrow-label-amp">Other Misc Cost</label>
                <input
                  type="text"
                  value={counts["c_others"]}
                  onChange={(e) =>
                    handleCountChange("c_others", e.target.value)
                  }
                />
              </div>
            </div>
          </section>

          {/* Actions */}
          <div className="module-action-row">
  <button
    type="button"
    className="module-btn module-btn-primary"
    onClick={() => setShowModal(true)}
  >
    Generate Report
  </button>

  <button
    type="button"
    className="module-btn module-btn-secondary"
    onClick={resetCounts}
  >
    Reset
  </button>
</div>

          {/* Output */}
<ModuleReport report={displayReport} />

          </div>
        </div>
      </div>

    {/* Modal */}
    {showModal &&
      createPortal(
        <div
          className="modal-overlay"
          onClick={() => setShowModal(false)}
          aria-hidden={!showModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            className="modal-dialog"
          >
            <h3>Enter Additional Costs</h3>

            <div className="mt-2">
              <label>16 type row</label>
              <input
                value={String(labour16)}
                onChange={(e) =>
                  setLabour16(parseFloat(e.target.value || "0"))
                }
                onWheel={(e) => e.currentTarget.blur()}
                className="modal-input mb-3"
              />
            </div>

            <div>
              <label>24 type row</label>
              <input
                value={String(labour24)}
                onChange={(e) =>
                  setLabour24(parseFloat(e.target.value || "0"))
                }
                onWheel={(e) => e.currentTarget.blur()}
                className="modal-input mb-3"
              />
            </div>

            <div>
              <label>Overhead Expenses (%)</label>
              <input
                value={String(overheadPercent)}
                onChange={(e) =>
                  setOverheadPercent(parseFloat(e.target.value || "0"))
                }
                onWheel={(e) => e.currentTarget.blur()}
                className="modal-input mb-3"
              />
            </div>

            <div>
              <label>Profit Percentage (%)</label>
              <input
                value={String(profitPercent)}
                onChange={(e) =>
                  setProfitPercent(parseFloat(e.target.value || "0"))
                }
                onWheel={(e) => e.currentTarget.blur()}
                className="modal-input mb-3"
              />
            </div>

            <div className="modal-actions">
              <button
                onClick={handleGenerateReport}
                disabled={generating}
                className="btn btn-accent"
              >
                {generating ? "Generating..." : "Continue"}
              </button>

              <button
                onClick={() => setShowModal(false)}
                className="btn btn-ghost"
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

export default DBRowModule;

