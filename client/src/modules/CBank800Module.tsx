import React, { useState, useEffect } from "react";
import "./css/CBank.css";
import { supabase } from "../supabaseClient";
import { generateCBank800 } from "../api/modules";
import type { ProjectModuleRow } from "../types/modules";
import ModuleAlertModal from "../components/ModuleAlertModal";
import ConfirmModal from "../components/ConfirmModal";
import ModuleReport from "../components/ModuleReport";

export type { ProjectModuleRow };

type CBank800ModuleProps = {
  module: ProjectModuleRow;
  /** No longer used here (pricing happens server-side); kept so the parent needn't change. */
  orgName?: string;
  onModuleChange: (updated: ProjectModuleRow) => void;
  onModuleDeleted: () => void;
};


const brandOptions = [
  "ABB",
  "MG",
  "GE",
  "CUTLERH",
  "SEIMENS",
  "LG",
  "L&T",
  "DSMITH",
  "NEW",
  "M.BSHI",
  "Z"
];

const CBank800Module: React.FC<CBank800ModuleProps> = ({
  module,
  onModuleChange,
  onModuleDeleted,
}) => {

const [title, setTitle] = useState("");

const [incomerType, setIncomerType] = useState<string>("");
const [capacitor, setCapacitor] = useState("");
const [contactorBrand, setContactorBrand] = useState("");
const [fusesBrand, setFusesBrand] = useState("");
const [incomerBrand, setIncomerBrand] = useState("");
const [incomer, setIncomer] = useState<number | "">("");

const [quantity, setQuantity] = useState<number | "">(1);

const [step5, setStep5] = useState<number | "">("");
const [step10, setStep10] = useState<number | "">("");
const [step20, setStep20] = useState<number | "">("");
const [step25, setStep25] = useState<number | "">("");
const [step50, setStep50] = useState<number | "">("");

const [Rstep10, setRstep10] = useState<number | "">("");
const [Rstep20, setRstep20] = useState<number | "">("");
const [Rstep25, setRstep25] = useState<number | "">("");
const [Rstep50, setRstep50] = useState<number | "">("");

const [miscellaneous, setMiscellaneous] = useState<number | "">("");
const [labour, setLabour] = useState<number | "">(10);
const [overhead, setOverhead] = useState<number | "">(5);

const [generating, setGenerating] = useState(false);

const [alertMsg, setAlertMsg] = useState<string | null>(null);
const [confirmOpen, setConfirmOpen] = useState(false);
const [displayReport, setDisplayReport] = useState<any | null>(null);

useEffect(() => {
  if (!module) return;

  const input = module.input_json || {};

  // Title + quantity
  setTitle(module.title || "");
  setQuantity(module.quantity ?? 1);

  // Basic selections
  setCapacitor(input.capacitor || "");
  setContactorBrand(input.contactorBrand || "");
  setFusesBrand(input.fusesBrand || "");
  setIncomerBrand(input.incomerBrand || "");
  setIncomer(input.incomer ?? "");
  setIncomerType(input.incomerType || "");

  // Steps
  setStep5(input.step5 ?? "");
  setStep10(input.step10 ?? "");
  setStep20(input.step20 ?? "");
  setStep25(input.step25 ?? "");
  setStep50(input.step50 ?? "");

  setRstep10(input.Rstep10 ?? "");
  setRstep20(input.Rstep20 ?? "");
  setRstep25(input.Rstep25 ?? "");
  setRstep50(input.Rstep50 ?? "");

  // Costs
  setMiscellaneous(input.miscellaneous ?? "");
  setLabour(input.labour ?? 10);
  setOverhead(input.overhead ?? 5);

  // Restore report if exists
  setDisplayReport(module.output_json?.display ?? null);

// eslint-disable-next-line react-hooks/exhaustive-deps
}, [module.id]);


const handleReset = async () => {
  // 1) reset local state
  setCapacitor("");
  setContactorBrand("");
  setFusesBrand("");
  setIncomerBrand("");
  setIncomer("");

  setIncomerType("");

  setStep5("");
  setStep10("");
  setStep20("");
  setStep25("");
  setStep50("");

  setRstep10("");
  setRstep20("");
  setRstep25("");
  setRstep50("");

  setMiscellaneous("");
  setLabour(10);
  setOverhead(5);

  setDisplayReport(null);

  // 2) build cleared input_json
  const clearedInput = {
    capacitor: "",
    contactorBrand: "",
    fusesBrand: "",
    incomerBrand: "",
    incomer: "",
    incomerType: "",
    step5: 0,
    step10: 0,
    step20: 0,
    step25: 0,
    step50: 0,
    Rstep10: 0,
    Rstep20: 0,
    Rstep25: 0,
    Rstep50: 0,
    miscellaneous: 0,
    labour: 10,
    overhead: 5,
  };

  // 3) clear prices + report in Supabase
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
    console.error("Error resetting module:", error);
    return;
  }

  // 4) notify parent so project total is recomputed
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

const handleGenerate = async () => {
  if (generating) return;
  setGenerating(true);
  try {
    // All validation, pricing and saving happens in the calc-cbank800 Edge Function.
    const updated = await generateCBank800({
      moduleId: module.id,
      title,
      quantity,
      input: {
        capacitor,
        contactorBrand,
        fusesBrand,
        incomerBrand,
        incomerType,
        incomer,
        step5,
        step10,
        step20,
        step25,
        step50,
        Rstep10,
        Rstep20,
        Rstep25,
        Rstep50,
        miscellaneous,
        labour,
        overhead,
      },
    });

    setTitle(updated.title);
    setDisplayReport(updated.output_json?.display ?? null);
    onModuleChange(updated);
  } catch (err) {
    console.error("Error generating CBank report:", err);
    setAlertMsg(err instanceof Error ? err.message : "Failed to generate report.");
  } finally {
    setGenerating(false);
  }
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

const nStep5 = step5 === "" ? 0 : step5;
const nStep10 = step10 === "" ? 0 : step10;
const nStep20 = step20 === "" ? 0 : step20;
const nStep25 = step25 === "" ? 0 : step25;
const nStep50 = step50 === "" ? 0 : step50;

const nRstep10 = Rstep10 === "" ? 0 : Rstep10;
const nRstep20 = Rstep20 === "" ? 0 : Rstep20;
const nRstep25 = Rstep25 === "" ? 0 : Rstep25;
const nRstep50 = Rstep50 === "" ? 0 : Rstep50;

const nMisc = miscellaneous === "" ? 0 : miscellaneous;
const nLabour = labour === "" ? 0 : labour;
const nOverhead = overhead === "" ? 0 : overhead;
const nQty = quantity === "" ? 0 : quantity;

    const inputJson = {
      capacitor,
      contactorBrand,
      fusesBrand,
      incomerBrand,
      incomer,
      incomerType,
      step5: nStep5,
step10: nStep10,
step20: nStep20,
step25: nStep25,
step50: nStep50,
Rstep10: nRstep10,
Rstep20: nRstep20,
Rstep25: nRstep25,
Rstep50: nRstep50,
miscellaneous: nMisc,
labour: nLabour,
overhead: nOverhead,
    };

    const { error } = await supabase
      .from("project_modules")
      .update({
  title,
  quantity: Number(quantity || 0),
  input_json: inputJson,
})
      .eq("id", module.id);

    if (error) {
      console.error("Error saving module:", error);
      setAlertMsg("Error saving module.");
      return;
    }

   onModuleChange({
  ...module,
  title,
  quantity: nQty,
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

  return (
    <div className="cbank-page">
      {/* toolbar inside project workspace */}
      <div className="cbank-module-toolbar">
        <div className="cbank-module-toolbar-left">
          <div className="cbank-module-title">
            <span>Title:</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Module name"
          />
          </div>
          <div className="cbank-module-qty">
            <span>Qty:</span>
            <input
  type="number"
  value={quantity}
  onChange={(e) => {
    const v = e.target.value;
    setQuantity(v === "" ? "" : Number(v));}}
  onWheel={(e) => e.currentTarget.blur()}
/>

          </div>
        </div>
        <div className="cbank-module-toolbar-right">
          <button
            type="button"
            className="cbank-delete-button"
            onClick={handleDelete}
          >
            Delete
          </button>
          <button
            type="button"
            className="cbank-save-button"
            onClick={handleSaveMetaOnly}
          >
            Save
          </button>
        </div>
      </div>

      <h2>CBANK-800</h2>

      {/* FORM (same layout as original, minus Navbar/back button) */}
      <form id="cbankForm">
        <div className="section two-column">
          <div>
            <label htmlFor="capacitor">Choose the type of Capacitor:</label>
            <select
              id="capacitor"
              value={capacitor}
              onChange={(e) => setCapacitor(e.target.value)}
              required
            >
              <option value="">Select a capacitor</option>
              {brandOptions.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="contactorbrand">Choose the type of Contactor:</label>
            <select
              id="contactorbrand"
              value={contactorBrand}
              onChange={(e) => setContactorBrand(e.target.value)}
              required
            >
              <option value="">Select a contactor</option>
              {brandOptions.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="fusesbrand">Choose the type of Fuses:</label>
            <select
              id="fusesbrand"
              value={fusesBrand}
              onChange={(e) => setFusesBrand(e.target.value)}
              required
            >
              <option value="">Select fuses</option>
              {brandOptions.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="incomerbrand">Choose the type of Incomer:</label>
            <select
              id="incomerbrand"
              value={incomerBrand}
              onChange={(e) => setIncomerBrand(e.target.value)}
              required
            >
              <option value="">Select an incomer</option>
              {brandOptions.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label>
          Arrange Steps (Enter number of steps for 5, 10, 20, 25, 50 KVAR):
        </label>

        <div className="section step-grid">
          {[
            { id: "step5", label: "5 KVAR", state: step5, setter: setStep5 },
            { id: "step10", label: "10 KVAR", state: step10, setter: setStep10 },
            { id: "step20", label: "20 KVAR", state: step20, setter: setStep20 },
            { id: "step25", label: "25 KVAR", state: step25, setter: setStep25 },
            { id: "step50", label: "50 KVAR", state: step50, setter: setStep50 },
          ].map((item) => (
            <div key={item.id}>
              <label>{item.label}:</label>
              <input
                type="number"
                id={item.id}
                min={0}
                value={item.state}
                onChange={(e) => {
                  const v = e.target.value;
                  item.setter(v === "" ? "" : Number(v));}}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder={`Enter steps for ${item.label}`}
              />
            </div>
          ))}
        </div>

        <label>
          Filter Reactor Transf. (Enter number of steps for 10, 20, 25, 50
          KVAR):
        </label>

        <div className="section reactor-grid">
          {[
            { id: "Rstep10", label: "10 KVAR", state: Rstep10, setter: setRstep10 },
            { id: "Rstep20", label: "20 KVAR", state: Rstep20, setter: setRstep20 },
            { id: "Rstep25", label: "25 KVAR", state: Rstep25, setter: setRstep25 },
            { id: "Rstep50", label: "50 KVAR", state: Rstep50, setter: setRstep50 },
          ].map((item) => (
            <div key={item.id}>
              <label>{item.label}:</label>
              <input
                type="number"
                id={item.id}
                min={0}
                value={item.state}
                onChange={(e) => {
                  const v = e.target.value;
                  item.setter(v === "" ? "" : Number(v));}}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder={`Enter steps for ${item.label}`}
              />
            </div>
          ))}
        </div>

        <h3>Select Incomer Type</h3>

        <div className="radio-row">
          <label>
            <input
              type="radio"
              name="incomer-type"
              value="isolator"
              checked={incomerType === "isolator"}
              onChange={(e) => setIncomerType(e.target.value)}
            />
            Isolator
          </label>

          <label>
            <input
              type="radio"
              name="incomer-type"
              value="mccb"
              checked={incomerType === "mccb"}
              onChange={(e) => setIncomerType(e.target.value)}
            />
            MCCB
          </label>
        </div>

        <label htmlFor="incomer">Choose Incomer:</label>
        <select
          id="incomer"
          value={incomer}
          onChange={(e) =>
            setIncomer(e.target.value === "" ? "" : Number(e.target.value))
          }
          required
        >
          <option value="">Select an incomer</option>
          {[100, 125, 160, 200, 300, 400, 600, 800, 1000, 1250, 1600].map(
            (n) => (
              <option key={n} value={n}>
                {n}
              </option>
            )
          )}
        </select>

        <div className="section single-column">
          <div>
            <label>Miscellaneous cost</label>
            <input
              type="number"
              id="miscellaneous"
              min={0}
              value={miscellaneous}
              onChange={(e) => {
                const v = e.target.value;
                setMiscellaneous(v === "" ? "" : Number(v));}}
              onWheel={(e) => e.currentTarget.blur()}
              placeholder="Miscellaneous costs (if any)"
            />
          </div>

          <div>
            <label>Labour Cost (in %)</label>
            <input
              type="number"
              id="labour"
              min={0}
              value={labour}
              onChange={(e) => {
                const v = e.target.value;
                setLabour(v === "" ? "" : Number(v));}}
              onWheel={(e) => e.currentTarget.blur()}
              placeholder="Default = 10%"
            />
          </div>

          <div>
            <label>Overhead Cost (in %)</label>
            <input
              type="number"
              id="overhead"
              min={0}
              value={overhead}
              onChange={(e) => {
                const v = e.target.value;
                setOverhead(v === "" ? "" : Number(v));}}
              onWheel={(e) => e.currentTarget.blur()}
              placeholder="Default = 5%"
            />
          </div>
        </div>

       <div className="module-action-row">
  <button
    type="button"
    className="module-btn module-btn-primary"
    onClick={handleGenerate}
    disabled={generating}
  >
    {generating ? "Generating..." : "Generate Report"}
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

      </form>

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

    </div>
  );
};

export default CBank800Module;