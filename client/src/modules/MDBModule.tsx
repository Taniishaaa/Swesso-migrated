/* eslint-disable react-hooks/exhaustive-deps */
// src/MDBModule.tsx
import React, { useState, useEffect } from "react";
import "./css/MDB.css";
import { supabase } from "../supabaseClient";
import { generateMDB } from "../api/modules";
import type { ProjectModuleRow } from "../types/modules";
import ModuleAlertModal from "../components/ModuleAlertModal";
import ConfirmModal from "../components/ConfirmModal";
import ModuleReport from "../components/ModuleReport";

export type { ProjectModuleRow };

type MDBModuleProps = {
  module: ProjectModuleRow;
  /** No longer used here (pricing happens server-side); kept so the parent needn't change. */
  orgName?: string;
  onModuleChange: (updated: ProjectModuleRow) => void;
  onModuleDeleted: () => void;
};

const MDBModule: React.FC<MDBModuleProps> = ({
  module,
  onModuleChange,
  onModuleDeleted,
}) => {

  const [title, setTitle] = useState<string>("");
  const [quantity, setQuantity] = useState<number | "">(1);

  // === STATE (ported from page version) ====
 const [displayReport, setDisplayReport] = useState<any | null>(null);

const [breakerType, setBreakerType] = useState<string>("");
const [acb4000, setAcb4000] = useState<number>(0);
const [acb3200, setAcb3200] = useState<number>(0);
const [totalWidth, setTotalWidth] = useState<number>(0);
const [outCombinedMccbGroupings, setOutCombinedMccbGroupings] =
  useState<{ enclosure: string; breakers: number[] }[]>([]);

const [values, setValues] = useState<Record<string, string>>({});
const [generating, setGenerating] = useState(false);

const [alertMsg, setAlertMsg] = useState<string | null>(null);
const [confirmOpen, setConfirmOpen] = useState(false);
const [showModal, setShowModal] = useState(false);

  // derived flags from state
  const acb4000Selected = parseInt(values["acb4000"] || "0") > 0;
  const acb3200Selected = parseInt(values["acb3200"] || "0") > 0;

  const showACBDepthSelection =
    breakerType === "ACB" && !acb4000Selected && !acb3200Selected;

  const showACBOutgoings = breakerType === "ACB";
  const showMCCBOutgoings =
    breakerType === "ACB" ||
    breakerType === "MCCB";

  const showACBBus = breakerType === "ACB";
  const showMCCBBus = breakerType === "MCCB";

  const showMCCBDepthSelection = breakerType === "MCCB";

  const ACB_KEYS = [
  "acb4000","acb3200","acb2500","acb2000","acb1600","acb1250","acb1000",
  "out_acb3200","out_acb2500","out_acb2000","out_acb1600","out_acb1250",
  "out_acb1000","out_acb800","out_acb630",
  "bus_acb4000","bus_acb3200","bus_acb2500","bus_acb2000",
  "bus_acb1600","bus_acb1250","bus_acb1000",
];

const MCCB_KEYS = [
  "mccb3200","mccb2500","mccb2000","mccb1600","mccb1250","mccb1000",
  "out_mccb3200","out_mccb2500","out_mccb2000","out_mccb1600",
  "out_mccb1250","out_mccb1000","out_mccb800","out_mccb630",
  "out_mccb500","out_mccb400","out_mccb300","out_mccb250",
  "out_mccb200","out_mccb160","out_mccb125","out_mccb100",
  "out_mccb80","out_mccb63","out_mccb40","out_mccb32",
  "out_mccb25","out_mccb16","out_mccb10","out_mccbsp100",
  "bus_mccb3200","bus_mccb2500","bus_mccb2000",
  "bus_mccb1600","bus_mccb1250","bus_mccb1000",
];

useEffect(() => {
  const input = module.input_json || {};

  setTitle(module.title || "");
  setQuantity(module.quantity || 1);

  const clonedValues = input.values
    ? JSON.parse(JSON.stringify(input.values))
    : {};

  setValues(clonedValues);

  setBreakerType(input.breakerType ?? "");
  setTotalWidth(input.totalWidth ?? 0);
  setOutCombinedMccbGroupings(
  input.outCombinedMccbGroupings
    ? JSON.parse(JSON.stringify(input.outCombinedMccbGroupings))
    : []
);

  setAcb4000(parseInt(clonedValues?.acb4000 || "0") || 0);
  setAcb3200(parseInt(clonedValues?.acb3200 || "0") || 0);

  setDisplayReport(module.output_json?.display ?? null);

}, [module.id]);

const clearKeys = (keys: string[]) => {
  setValues((prev) => {
    const updated = { ...prev };
    keys.forEach((k) => delete updated[k]);
    return updated;
  });
};

const handleBreakerTypeChange = (
  e: React.ChangeEvent<HTMLSelectElement>
) => {
  const type = e.target.value;

  setBreakerType(type);

  if (type === "ACB") {
    // user switched TO ACB → clear all MCCB data
    clearKeys(MCCB_KEYS);
    setOutCombinedMccbGroupings([]);
  }

  if (type === "MCCB") {
    // user switched TO MCCB → clear all ACB data
    clearKeys(ACB_KEYS);
  }

  // reset panel geometry
  setTotalWidth(0);

  clearOutput();
};

const clearOutput = () => {
  setDisplayReport(null);
};

const submitAdditionalInputs = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      // Validation, enclosure sizing, pricing, busbars, labour and saving all happen in the
      // calc-mdb Edge Function.
      const updated = await generateMDB({
        moduleId: module.id,
        title,
        quantity,
        input: { breakerType, values },
      });

      // the server derives these while sizing the panel
      setTotalWidth(updated.input_json?.totalWidth ?? 0);
      setOutCombinedMccbGroupings(updated.input_json?.outCombinedMccbGroupings ?? []);
      setTitle(updated.title);
      setDisplayReport(updated.output_json?.display ?? null);
      setShowModal(false);
      onModuleChange(updated);
    } catch (err) {
      console.error("Error generating MDB report:", err);
      setAlertMsg(err instanceof Error ? err.message : "Failed to generate report.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveMetaOnly = async () => {
    const inputJson = {
      values,
      breakerType,
      totalWidth,
      outCombinedMccbGroupings,
    };

    // prevent duplicate titles
const { data: existing, error: dupError } = await supabase
  .from("project_modules")
  .select("id")
  .eq("project_id", module.project_id)
  .eq("title", title)
  .neq("id", module.id);

if (existing && existing.length > 0) {
  setAlertMsg("A module with this title already exists in this project.");
  return;
}

if (dupError) {
  console.error(dupError);
  return;
}

    const { error } = await supabase
      .from("project_modules")
      .update({
  title,
  quantity: Number(quantity || 0),
  input_json: inputJson,
})
      .eq("id", module.id);

    if (error) {
      console.error("Error saving MDB module:", error);
      setAlertMsg("Error saving MDB module.");
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

  const handleReset = async () => {
    setValues({});
    setBreakerType("");
    setAcb4000(0);
    setAcb3200(0);
    setTotalWidth(0);
    setOutCombinedMccbGroupings([]);
    clearOutput();

    const clearedInput = {
      values: {},
      breakerType: "",
      totalWidth: 0,
      outCombinedMccbGroupings: [],
    };

    const { error } = await supabase
      .from("project_modules")
      .update({
        title,
        quantity: Number(quantity || 0),
        unit_price: null,
        total_price: null,
        input_json: clearedInput,
        output_json: null,
      })
      .eq("id", module.id);

    if (error) {
      console.error("Error resetting MDB module:", error);
      return;
    }

    onModuleChange({
      ...module,
      title,
      quantity: Number(quantity || 0),
      unit_price: null,
      total_price: null,
      input_json: clearedInput,
      output_json: null,
    });
  };

return (
  <>
    {/* Module container inside ProjectWorkspace */}
    <div className="mdb-container">
      {/* === MODULE TOOLBAR === */}
      <div className="mdb-module-toolbar">
        <div className="mdb-module-toolbar-left">
          <div className="mdb-module-title">
            <span>Title:</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Module name"
            />
          </div>

          <div className="mdb-module-qty">
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

        <div className="mdb-module-toolbar-right">
          <button
            type="button"
            className="mdb-delete-button"
            onClick={handleDelete}
          >
            Delete
          </button>
          <button
            type="button"
            className="mdb-save-button"
            onClick={handleSaveMetaOnly}
          >
            Save
          </button>
        </div>
      </div>

      <h2>MDB - FORM 2</h2>

      <form id="MDBForm" onSubmit={(e) => e.preventDefault()}>
        {/* === Breaker Type & Brand === */}
        <div className="mdb-two-col">
          <div>
            <label>Breaker Type (Incomer)</label>
            <select
             value={breakerType}
              onChange={(e) => {
                handleBreakerTypeChange(e);
              }}
            >
              <option value="">-- Select --</option>
              <option value="ACB">ACB</option>
              <option value="MCCB">MCCB</option>
            </select>
          </div>

          <div>
            <label>Breaker Brand</label>
            <select
              value={values["brand"] || ""}
              onChange={(e) =>
                setValues((p) => ({ ...p, brand: e.target.value }))
              }
            >
              <option value="">-- Select --</option>
              {[
                "ABB",
                "MG",
                "GE",
                "CUTLERH",
                "SEIMENS",
                "LG",
                "L&T",
                "DSMITH",
                "NEW",
                "Y",
                "Z",
              ].map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ================= ACB INCOMING ================= */}
        {breakerType === "ACB" && (
          <>
            <h3>Incoming ACBs</h3>

             {showACBDepthSelection && (
              <div style={{ marginTop: 20 }}>
                <label>Choose enclosure depth</label>
                <select
                  value={values["depth_choice"] || ""}
                  onChange={(e) =>
                    setValues((p) => ({
                      ...p,
                      depth_choice: e.target.value,
                    }))
                  }
                >
                  <option value="">-- Select --</option>
                  <option value="800">2000x800x800</option>
                  <option value="1000">2000x800x1000</option>
                </select>
              </div>
            )}

            <div className="breaker-header">
              <span className="col-rating">Rating</span>
              <span className="col-qty">Qty</span>
              <span className="col-type">Type</span>
              <span className="col-scc">SCC</span>
              <span className="col-pole">Pole</span>
            </div>

            {["4000", "3200", "2500", "2000", "1600", "1250", "1000"].map(
              (r) => (
                <div className="breaker-row" key={`acb${r}`}>
                  <label>{r}A</label>

                  <input
                    type="number"
                    value={values[`acb${r}`] || ""}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setValues((p) => ({ ...p, [`acb${r}`]: e.target.value }));
                      if (r === "4000") setAcb4000(val);
                      if (r === "3200") setAcb3200(val);
                    }}
                    onWheel={(e) => e.currentTarget.blur()}
                  />

                  <select
                    value={values[`acb${r}_type`] || "drawout"}
                    onChange={(e) =>
                      setValues((p) => ({
                        ...p,
                        [`acb${r}_type`]: e.target.value,
                      }))
                    }
                  >
                    <option value="drawout">Draw-out</option>
                    <option value="fixed">Fixed</option>
                  </select>

                  <select
                    value={values[`acb${r}_scc`] || "65kA"}
                    onChange={(e) =>
                      setValues((p) => ({
                        ...p,
                        [`acb${r}_scc`]: e.target.value,
                      }))
                    }
                  >
                    {["65kA", "50kA", "40kA"].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>

                  <select
                    value={values[`acb${r}_pole`] || "three"}
                    onChange={(e) =>
                      setValues((p) => ({
                        ...p,
                        [`acb${r}_pole`]: e.target.value,
                      }))
                    }
                  >
                    <option value="three">3 Pole</option>
                    <option value="four">4 Pole</option>
                  </select>
                </div>
              )
            )}

          </>
        )}

        {/* ================= MCCB INCOMING ================= */}
        {breakerType === "MCCB" && (
          <>
            <h3>Incoming MCCBs</h3>

            {showMCCBDepthSelection && (
              <div style={{ marginBottom: 12 }}>
                <label>Choose enclosure depth</label>
                <select
                  value={values["depth_choice_mccb"] || ""}
                  onChange={(e) =>
                    setValues((p) => ({
                      ...p,
                      depth_choice_mccb: e.target.value,
                    }))
                  }
                >
                  <option value="">-- Select --</option>
                  <option value="800">800</option>
                  <option value="1000">1000</option>
                </select>
              </div>
            )}

            <div className="breaker-header">
              <span className="col-rating">Rating</span>
              <span className="col-qty">Qty</span>
              <span className="col-scc">SCC</span>
              <span className="col-pole">Pole</span>
            </div>

            {["3200", "2500", "2000", "1600", "1250", "1000"].map((r) => (
              <div className="breaker-row" key={`mccb${r}`}>
                <label>{r}A</label>

                <input
                  type="number"
                  value={values[`mccb${r}`] || ""}
                  onChange={(e) =>
                    setValues((p) => ({
                      ...p,
                      [`mccb${r}`]: e.target.value,
                    }))
                  }
                  onWheel={(e) => e.currentTarget.blur()}
                />

                <select
                  value={values[`mccb${r}_scc`] || "35kA"}
                  onChange={(e) =>
                    setValues((p) => ({
                      ...p,
                      [`mccb${r}_scc`]: e.target.value,
                    }))
                  }
                >
                  {["65kA", "50kA", "35kA", "25kA", "16kA"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                <select
                  value={values[`mccb${r}_poles`] || "3P"}
                  onChange={(e) =>
                    setValues((p) => ({
                      ...p,
                      [`mccb${r}_poles`]: e.target.value,
                    }))
                  }
                >
                  <option value="3P">3 Pole</option>
                  <option value="4P">4 Pole</option>
                </select>
              </div>
            ))}
          </>
        )}

        {/* ================= BUS COUPLERS ================= */}
        <h3>Bus Couplers</h3>

        {showACBBus && (
          <>
            <h4>ACB</h4>
            <div className="form4-grid">
              {["4000", "3200", "2500", "2000", "1600", "1250", "1000"].map(
                (r) => (
                  <div className="breaker-row" key={`bus_acb${r}`}>
                    <label>{r}A</label>
                    <input
                      type="number"
                      value={values[`bus_acb${r}`] || ""}
                      onChange={(e) =>
                        setValues((p) => ({
                          ...p,
                          [`bus_acb${r}`]: e.target.value,
                        }))
                      }
                      onWheel={(e) => e.currentTarget.blur()}
                    />
                  </div>
                )
              )}
            </div>
          </>
        )}

        {showMCCBBus && (
          <>
            <h4>MCCB</h4>
            <div className="form4-grid">
              {["3200", "2500", "2000", "1600", "1250", "1000"].map((r) => (
                <div className="breaker-row" key={`bus_mccb${r}`}>
                  <label>{r}A</label>
                  <input
                    type="number"
                    value={values[`bus_mccb${r}`] || ""}
                    onChange={(e) =>
                      setValues((p) => ({
                        ...p,
                        [`bus_mccb${r}`]: e.target.value,
                      }))
                    }
                    onWheel={(e) => e.currentTarget.blur()}
                  />
                </div>
              ))}
            </div>
          </>
        )}

        {/* ================= OUTGOINGS ================= */}
        <h3>Outgoing Breakers</h3>

        {showACBOutgoings && (
          <>
            <h4>ACB</h4>
            <div className="form4-grid">
              {["3200", "2500", "2000", "1600", "1250", "1000", "800", "630"].map(
                (r) => (
                  <div className="breaker-row" key={`out_acb${r}`}>
                    <label>{r}A</label>
                    <input
                      type="number"
                      value={values[`out_acb${r}`] || ""}
                      onChange={(e) =>
                        setValues((p) => ({
                          ...p,
                          [`out_acb${r}`]: e.target.value,
                        }))
                      }
                      onWheel={(e) => e.currentTarget.blur()}
                    />
                  </div>
                )
              )}
            </div>
          </>
        )}

        {showMCCBOutgoings && (
          <>
            <h4>MCCB</h4>
            <div className="form4-grid">
              {[
                "3200",
                "2500",
                "2000",
                "1600",
                "1250",
                "1000",
                "800",
                "630",
                "500",
                "400",
                "300",
                "250",
                "200",
                "160",
                "125",
                "100",
                "80",
                "63",
                "40",
                "32",
                "25",
                "16",
                "10",
              ].map((r) => (
                <div className="breaker-row" key={`out_mccb${r}`}>
                  <label>{r}A</label>
                  <input
                    type="number"
                    value={values[`out_mccb${r}`] || ""}
                    onChange={(e) =>
                      setValues((p) => ({
                        ...p,
                        [`out_mccb${r}`]: e.target.value,
                      }))
                    }
                    onWheel={(e) => e.currentTarget.blur()}
                  />
                </div>
              ))}

              <div className="breaker-row">
                <label>SP upto 100A</label>
                <input
                  type="number"
                  value={values["out_mccbsp100"] || ""}
                  onChange={(e) =>
                    setValues((p) => ({
                      ...p,
                      out_mccbsp100: e.target.value,
                    }))
                  }
                  onWheel={(e) => e.currentTarget.blur()}
                />
              </div>
            </div>
          </>
        )}

        {/* ================= OTHER COMPONENTS ================= */}
        <h3>Other Components</h3>
        <div className="form4-grid">
          {[
            "earthFault",
            "uvr",
            "shuntTrip",
            "motor",
            "ach",
            "closingCoil",
            "castleSafety",
            "castleKey",
            "castleStand",
            "electIntlk",
            "rotaryHandle",
          ].map((c) => (
            <div className="breaker-row" key={c}>
              <label>
                {c.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
              </label>
              <input
                type="number"
                value={values[c] || ""}
                onChange={(e) =>
                  setValues((p) => ({ ...p, [c]: e.target.value }))
                }
                onWheel={(e) => e.currentTarget.blur()}
              />
            </div>
          ))}
        </div>
      </form>

      {/* === ACTIONS === */}
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
          onClick={handleReset}
        >
          Reset
        </button>
      </div>

<ModuleReport report={displayReport} />
    </div>

    {/* ===== MODALS ===== */}
    {showModal && (
  <div id="costModal" className="modal-overlay">
    <div className="modal-content">
      <h3>Enter Additional Costs</h3>

      <div className="modal-field">
        <label htmlFor="copperValue">Copper Value:</label>
        <input
          type="number"
          id="copperValue"
          name="copperValue"
          placeholder="Default = 47"
          value={values["copperValue"] || ""}
          onChange={(e) =>
            setValues((prev) => ({
              ...prev,
              copperValue: e.target.value,
            }))
          }
          onWheel={(e) => e.currentTarget.blur()}
        />
      </div>

      <h3>Labour Cost Configuration (AED per unit)</h3>

      {[
        {
          id: "labour_acb_4000_3200",
          label: "ACB 4000A & 3200A",
          def: "900",
        },
        {
          id: "labour_acb_2500_1600",
          label: "ACB 2500A, 2000A, 1600A",
          def: "750",
        },
        {
          id: "labour_acb_1250_1000",
          label: "ACB 1250A, 1000A",
          def: "600",
        },
        { id: "labour_mccb_3200", label: "MCCB 3200A", def: "650" },
        {
          id: "labour_mccb_2500_1600",
          label: "MCCB 2500A, 2000A, 1600A",
          def: "600",
        },
        {
          id: "labour_mccb_1250_800",
          label: "MCCB 1250A, 1000A, 800A",
          def: "500",
        },
        {
          id: "labour_mccb_630_300",
          label: "MCCB 630A - 300A",
          def: "250",
        },
        {
          id: "labour_mccb_300_sp100",
          label: "MCCB 300A - SP100",
          def: "75",
        },
        {
          id: "overheadExpenses",
          label: "Overhead Expenses (%)",
          def: "3",
        },
        {
          id: "profitPercentage",
          label: "Profit Percentage (%)",
          def: "20",
        },
      ].map(({ id, label, def }) => (
        <div className="modal-field" key={id}>
          <label htmlFor={id}>{label}</label>
          <input
            type="number"
            id={id}
            value={values[id] ?? def}
            onChange={(e) =>
              setValues((prev) => ({
                ...prev,
                [id]: e.target.value,
              }))
            }
            onWheel={(e) => e.currentTarget.blur()}
          />
        </div>
      ))}

      <div className="modal-buttons">
        <button type="button" onClick={submitAdditionalInputs} disabled={generating}>
          {generating ? "Generating..." : "Continue"}
        </button>
        <button type="button" onClick={() => setShowModal(false)}>
          Cancel
        </button>
      </div>
    </div>
  </div>
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

export default MDBModule;