/* eslint-disable react-hooks/exhaustive-deps */
// src/modules/Form4Module.tsx
import React, { useState, useEffect } from "react";
import "./css/Form4.css";
import { supabase } from "../supabaseClient";
import ModuleAlertModal from "../components/ModuleAlertModal";
import ConfirmModal from "../components/ConfirmModal";
import { generateForm4 } from "../api/modules";
import type { ProjectModuleRow } from "../types/modules";
import ModuleReport from "../components/ModuleReport";

export type { ProjectModuleRow };

type Form4ModuleProps = {
  module: ProjectModuleRow;
  /** No longer used here (pricing happens server-side); kept so the parent needn't change. */
  orgName?: string;
  onModuleChange: (updated: ProjectModuleRow) => void;
  onModuleDeleted: () => void;
};

const ACB_RATINGS = ["4000", "3200", "2500", "2000", "1600", "1250", "1000"];
const MCCB_INCOMING = ["3200", "2500", "2000", "1600", "1250", "1000"];

const ACB_OUTGOING = ["3200", "2500", "2000", "1600", "1250", "1000", "800", "630"];
const MCCB_OUTGOING = [
  "3200","2500","2000","1600","1250","1000","800","630",
  "500","400","300","250","200","160","125","100","80","63",
  "40","32","25","16","10","sp100"
];

const MCCB_BUS = ["3200", "2500", "2000", "1600", "1250", "1000"];

const ACB_SCC = ["65kA", "50kA", "40kA"];
const MCCB_SCC = ["65kA", "50kA", "35kA", "25kA", "16kA"];

const Form4Module: React.FC<Form4ModuleProps> = ({
  module,
  onModuleChange,
  onModuleDeleted,
}) => {
  
  const [title, setTitle] = useState(module.title);
  const [quantity, setQuantity] = useState<number | "">(module.quantity || 1);
 const [values, setValues] = useState<Record<string, string>>({});
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showModal, setShowModal] = useState<boolean>(false);
 
const [showCostModal, setShowCostModal] = useState(false);
const [generating, setGenerating] = useState(false);

const [displayReport, setDisplayReport] = useState<any | null>(null);

const ACB_VALUE_KEYS = [
  "acb4000","acb3200","acb2500","acb2000","acb1600","acb1250","acb1000",
  "out_acb3200","out_acb2500","out_acb2000","out_acb1600",
  "out_acb1250","out_acb1000","out_acb800","out_acb630",
  "bus_acb4000","bus_acb3200","bus_acb2500","bus_acb2000",
  "bus_acb1600","bus_acb1250","bus_acb1000"
];

const MCCB_VALUE_KEYS = [
  "mccb3200","mccb2500","mccb2000","mccb1600","mccb1250","mccb1000",
  "out_mccb3200","out_mccb2500","out_mccb2000","out_mccb1600",
  "out_mccb1250","out_mccb1000","out_mccb800","out_mccb630",
  "out_mccb500","out_mccb400","out_mccb300","out_mccb250",
  "out_mccb200","out_mccb160","out_mccb125","out_mccb100",
  "out_mccb80","out_mccb63","out_mccb40","out_mccb32",
  "out_mccb25","out_mccb16","out_mccb10","out_mccbsp100",
  "bus_mccb3200","bus_mccb2500","bus_mccb2000",
  "bus_mccb1600","bus_mccb1250","bus_mccb1000"
];

const [totalWidth, setTotalWidth] = useState<number>(0);

const [outCombinedMccbGroupings, setOutCombinedMccbGroupings] = useState<any[]>([]);

  const incomerType = values["breakerType"] || "";

  const showIncomingACB = incomerType === "ACB";
  const showIncomingMCCB = incomerType === "MCCB";

  const showBusACB = incomerType === "ACB";
  const showBusMCCB = incomerType === "MCCB";

  const showOutgoingACB = incomerType === "ACB";
  const showOutgoingMCCB = incomerType === "ACB" || incomerType === "MCCB";

  const acb4000Selected = Number(values["acb4000"] || 0) > 0;
  const acb3200Selected = Number(values["acb3200"] || 0) > 0;
  const forceMaxDepth = acb4000Selected || acb3200Selected;


useEffect(() => {
  const input = module.input_json || {};

  setTitle(module.title || "");
  setQuantity(module.quantity || 1);

  const clonedValues = input.values
    ? JSON.parse(JSON.stringify(input.values))
    : {};

  setValues(clonedValues);

  setTotalWidth(input.totalWidth ?? 0);

  setOutCombinedMccbGroupings(
    input.outCombinedMccbGroupings
      ? JSON.parse(JSON.stringify(input.outCombinedMccbGroupings))
      : []
  );

  setDisplayReport(module.output_json?.display ?? null);

}, [module.id]);

    // AUTO DEPTH ENFORCE (ACB)
  useEffect(() => {
    if (incomerType === "ACB" && forceMaxDepth) {
      setValues((p) => ({
        ...p,
        depth_choice: "1000",
      }));
    }
  }, [incomerType, forceMaxDepth]);

useEffect(() => {
  setValues((prev) => {
    const updated = { ...prev };

    if (incomerType === "ACB") {
      // Clear MCCB-related values
      MCCB_VALUE_KEYS.forEach((k) => delete updated[k]);
    }

    if (incomerType === "MCCB") {
      // Clear ACB-related values
      ACB_VALUE_KEYS.forEach((k) => delete updated[k]);
    }

    return updated;
  });

  // Also reset enclosure-derived refs/state
  setOutCombinedMccbGroupings([]);

  setTotalWidth(0);

}, [incomerType]);


const submitAdditionalInputs = async () => {
  if (generating) return;
  setGenerating(true);
  try {
    // Validation, enclosure sizing, pricing, busbars, labour and saving all happen in the
    // calc-form4 Edge Function.
    const updated = await generateForm4({
      moduleId: module.id,
      title,
      quantity,
      input: { values },
    });

    // the server derives these while sizing the panel
    setTotalWidth(updated.input_json?.totalWidth ?? 0);
    setOutCombinedMccbGroupings(updated.input_json?.outCombinedMccbGroupings ?? []);
    setTitle(updated.title);
    setDisplayReport(updated.output_json?.display ?? null);
    setShowModal(false);
    onModuleChange(updated);
  } catch (err) {
    console.error("Error generating Form 4 report:", err);
    setAlertMsg(err instanceof Error ? err.message : "Failed to generate report.");
  } finally {
    setGenerating(false);
  }
};

const handleReset = async () => {
  setValues({});
  setTotalWidth(0);
  setOutCombinedMccbGroupings([]);
  setDisplayReport(null);

  await supabase
    .from("project_modules")
    .update({
      unit_price: null,
      total_price: null,
      input_json: {
  values: {},
  breakerType: "",
  totalWidth: 0,
  outCombinedMccbGroupings: [],
},
      output_json: null,
    })
    .eq("id", module.id);

  onModuleChange({
    ...module,
    unit_price: null,
    total_price: null,
    input_json: {
  values: {},
  breakerType: "",
  totalWidth: 0,
  outCombinedMccbGroupings: [],
},
    output_json: null,
  });
};

const handleSaveMetaOnly = async () => {

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
    setAlertMsg("Error validating module title.");
    return;
  }

  if (existing && existing.length > 0) {
    setAlertMsg("A module with this title already exists in this project.");
    return;
  }

  const input_json = {
    values,
    breakerType: values["breakerType"] || "",
    totalWidth,
    outCombinedMccbGroupings,
  };

  const { error } = await supabase
    .from("project_modules")
    .update({
      title,
      quantity: Number(quantity || 0),
      input_json,
      unit_price: module.unit_price,
      total_price: module.total_price,
      output_json: module.output_json,
    })
    .eq("id", module.id);

  if (error) {
    console.error(error);
    setAlertMsg("Error saving Form4 module.");
    return;
  }

  onModuleChange({
    ...module,
    title,
    quantity: Number(quantity || 0),
    input_json,
    output_json: module.output_json,
  });
};

  const confirmDelete = async () => {
    setConfirmOpen(false);
    await supabase.from("project_modules").delete().eq("id", module.id);
    onModuleDeleted();
  };

  const numInput = (id: string) => (
    <input
      type="number"
      value={values[id] || ""}
      onChange={(e) =>
        setValues((p) => ({ ...p, [id]: e.target.value }))
      }
      onWheel={(e) => e.currentTarget.blur()}
    />
  );

  return (
    <>
      {alertMsg && (
        <ModuleAlertModal message={alertMsg} onClose={() => setAlertMsg(null)} />
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

      <div className="form4-container">
        {/* === TOOLBAR === */}
        <div className="form4-module-toolbar">
          <div className="form4-module-toolbar-left">
            <div>
              <span>Title:</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Module name"
              />
            </div>
            <div>
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
          <div className="form4-module-toolbar-right">
            <button onClick={() => setConfirmOpen(true)}>Delete</button>
            <button onClick={handleSaveMetaOnly}>Save</button>
          </div>
        </div>

        <h2>MDB - Form 4</h2>

        <form onSubmit={(e) => e.preventDefault()}>
          {/* === Breaker Type & Brand === */}
          <div className="two-col">
            <div>
              <label>Breaker Type (Incomer)</label>
              <select
                value={values["breakerType"] || ""}
                onChange={(e) =>
                  setValues((p) => ({ ...p, breakerType: e.target.value }))
                }
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
                {["ABB","MG","GE","CUTLERH","SEIMENS","LG","L&T","DSMITH","NEW","Y","Z"].map(
                  (b) => (
                    <option key={b} value={b}>{b}</option>
                  )
                )}
              </select>
            </div>
          </div>

          {/* === MCCB DEPTH (EARLY) === */}
          {incomerType === "MCCB" && (
            <div className="single-col">
              <label>Choose enclosure depth</label>
              <select
                value={values["depth_choice"] || ""}
                onChange={(e) =>
                  setValues((p) => ({ ...p, depth_choice: e.target.value }))
                }
              >
                <option value="">-- Select --</option>
                <option value="800">800</option>
                <option value="1000">1000</option>
              </select>
            </div>
          )}

          {/* === ACB DEPTH (CONDITIONAL) === */}
          {incomerType === "ACB" && !forceMaxDepth && (
            <div className="single-col">
              <label>Choose enclosure depth</label>
              <select
                value={values["depth_choice"] || ""}
                onChange={(e) =>
                  setValues((p) => ({ ...p, depth_choice: e.target.value }))
                }
              >
                <option value="">-- Select --</option>
                <option value="800">2000x800x800</option>
                <option value="1000">2000x800x1000</option>
              </select>
            </div>
          )}

          {/* === Incoming ACBs === */}
          {showIncomingACB && (
            <>
              <h3>Incoming ACBs</h3>
              <div className="breaker-header">
                <span className="col-rating">Rating</span>
                <span className="col-qty">Qty</span>
                <span className="col-type">Type</span>
                <span className="col-scc">SCC</span>
                <span className="col-pole">Pole</span>
              </div>

              {ACB_RATINGS.map((r) => (
                <div className="breaker-row" key={`acb${r}`}>
                  <label>{r}A</label>
                  {numInput(`acb${r}`)}

                  <select
                    value={values[`acb${r}_type`] || "drawout"}
                    onChange={(e) =>
                      setValues((p) => ({ ...p, [`acb${r}_type`]: e.target.value }))
                    }
                  >
                    <option value="drawout">Draw-out</option>
                    <option value="fixed">Fixed</option>
                  </select>

                  <select
                    value={values[`acb${r}_scc`] || "65kA"}
                    onChange={(e) =>
                      setValues((p) => ({ ...p, [`acb${r}_scc`]: e.target.value }))
                    }
                  >
                    {ACB_SCC.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>

                  <select
                    value={values[`acb${r}_pole`] || "three"}
                    onChange={(e) =>
                      setValues((p) => ({ ...p, [`acb${r}_pole`]: e.target.value }))
                    }
                  >
                    <option value="three">3 Pole</option>
                    <option value="four">4 Pole</option>
                  </select>
                </div>
              ))}
            </>
          )}

          {/* === Incoming MCCBs === */}
          {showIncomingMCCB && (
            <>
              <h3>Incoming MCCBs</h3>
              <div className="breaker-header">
                <span className="col-rating">Rating</span>
                <span className="col-qty">Qty</span>
                <span className="col-scc">SCC</span>
                <span className="col-pole">Pole</span>
              </div>

              {MCCB_INCOMING.map((r) => (
                <div className="breaker-row" key={`mccb${r}`}>
                  <label>{r}A</label>
                  {numInput(`mccb${r}`)}

                  <select
                    value={values[`mccb${r}_scc`] || "35kA"}
                    onChange={(e) =>
                      setValues((p) => ({ ...p, [`mccb${r}_scc`]: e.target.value }))
                    }
                  >
                    {MCCB_SCC.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>

                  <select
                    value={values[`mccb${r}_poles`] || "TP"}
                    onChange={(e) =>
                      setValues((p) => ({ ...p, [`mccb${r}_poles`]: e.target.value }))
                    }
                  >
                    <option value="TP">3 Pole</option>
                    <option value="4P">4 Pole</option>
                  </select>
                </div>
              ))}
            </>
          )}

          {/* === Bus Couplers === */}
          {showBusACB && (
            <>
              <h3>Bus Couplers - ACB</h3>
              <div className="form4-grid">
                {ACB_RATINGS.map((r) => (
                  <div className="breaker-row" key={`bus_acb${r}`}>
                    <label>{r}A</label>
                    {numInput(`bus_acb${r}`)}
                  </div>
                ))}
              </div>
            </>
          )}

          {showBusMCCB && (
            <>
              <h3>Bus Couplers - MCCB</h3>
              <div className="form4-grid">
                {MCCB_BUS.map((r) => (
                  <div className="breaker-row" key={`bus_mccb${r}`}>
                    <label>{r === "sp100" ? "SP upto 100A" : `${r}A`}</label>
                    {numInput(`bus_mccb${r}`)}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* === Outgoings === */}
          {showOutgoingACB && (
            <>
              <h3>Outgoing ACBs</h3>
              <div className="form4-grid">
                {ACB_OUTGOING.map((r) => (
                  <div className="breaker-row" key={`out_acb${r}`}>
                    <label>{r}A</label>
                    {numInput(`out_acb${r}`)}
                  </div>
                ))}
              </div>
            </>
          )}

          {showOutgoingMCCB && (
            <>
              <h3>Outgoing MCCBs</h3>
              <div className="form4-grid">
                {MCCB_OUTGOING.map((r) => (
                  <div className="breaker-row" key={`out_mccb${r}`}>
                    <label>{r === "sp100" ? "SP upto 100A" : `${r}A`}</label>
                    {numInput(`out_mccb${r}`)}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* === Accessories === */}
          <h3>Accessories</h3>
          <div className="form4-grid">
            {[
              ["mechInterlock", "Mechanical Interlock"],
              ["elecInterlock", "Electrical Interlock"],
              ["earthFault", "Earth Fault"],
              ["shuntTrip", "Shunt Trip"],
              ["uvr", "Undervoltage Relay (UVR)"],
              ["castleKey", "Castle Key Lock"],
              ["ach", "Anticondensation Heater (ACH)"],
              ["closingCoil", "Closing Coil"],
              ["rotaryHandle", "Rotary Handle"]
            ].map(([id, label]) => (
              <div className="breaker-row" key={id}>
                <label>{label}</label>
                {numInput(id)}
              </div>
            ))}
          </div>

          {/* === Actions === */}
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
          def: "1350",
        },
        {
          id: "labour_acb_2500_1600",
          label: "ACB 2500A, 2000A, 1600A",
          def: "1125",
        },
        {
          id: "labour_acb_1250_1000",
          label: "ACB 1250A, 1000A",
          def: "900",
        },
        { id: "labour_mccb_3200", label: "MCCB 3200A", def: "975" },
        {
          id: "labour_mccb_2500_1600",
          label: "MCCB 2500A, 2000A, 1600A",
          def: "900",
        },
        {
          id: "labour_mccb_1250_800",
          label: "MCCB 1250A, 1000A, 800A",
          def: "750",
        },
        {
          id: "labour_mccb_630_300",
          label: "MCCB 630A - 300A",
          def: "375",
        },
        {
          id: "labour_mccb_300_sp100",
          label: "MCCB 300A - SP100",
          def: "112.5",
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
<ModuleReport report={displayReport} />

        </form>
      </div>
    </>
  );
};

export default Form4Module;