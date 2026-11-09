import React, { useState, useEffect } from "react";
import "./css/CBank.css"; // shared module layout / toolbar / button styles
import { supabase } from "../supabaseClient";
import { generateMeterBox } from "../api/modules";
import type { ProjectModuleRow } from "../types/modules";
import ModuleAlertModal from "../components/ModuleAlertModal";
import ConfirmModal from "../components/ConfirmModal";
import ModuleReport from "../components/ModuleReport";

export type { ProjectModuleRow };

type MeterBoxModuleProps = {
  module: ProjectModuleRow;
  /** Not used here (pricing happens server-side); kept so the parent passes the same props as the other modules. */
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
  "Z",
  "Y",
];

const INCOMER_RATINGS = [100, 125, 160, 200, 250, 300, 400];

// Defaults shown in the form (the server applies the same defaults for blank fields)
const DEFAULT_COPPER = 47;
const DEFAULT_LABOUR = 50;
const DEFAULT_LABOUR_METER = 25;

const MeterBoxModule: React.FC<MeterBoxModuleProps> = ({
  module,
  onModuleChange,
  onModuleDeleted,
}) => {
  const [title, setTitle] = useState("");
  const [quantity, setQuantity] = useState<number | "">(1);

  const [brand, setBrand] = useState("");
  const [incomer, setIncomer] = useState<number | "">("");
  const [ct, setCt] = useState(false);
  const [meter, setMeter] = useState(false);

  const [copperValue, setCopperValue] = useState<number | "">(DEFAULT_COPPER);
  const [labourBase, setLabourBase] = useState<number | "">(DEFAULT_LABOUR);
  const [labourMeter, setLabourMeter] = useState<number | "">(DEFAULT_LABOUR_METER);
  const [overheadPercent, setOverheadPercent] = useState<number | "">(0);
  const [profitPercent, setProfitPercent] = useState<number | "">(0);

  const [generating, setGenerating] = useState(false);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [displayReport, setDisplayReport] = useState<any | null>(null);

  // -------- hydrate when module changes --------
  useEffect(() => {
    if (!module) return;
    const input = module.input_json || {};

    setTitle(module.title || "");
    setQuantity(module.quantity ?? 1);

    setBrand(input.brand || "");
    setIncomer(input.incomer ?? "");
    setCt(!!input.ct);
    setMeter(!!input.meter);

    setCopperValue(input.copperValue ?? DEFAULT_COPPER);
    setLabourBase(input.labourBase ?? DEFAULT_LABOUR);
    setLabourMeter(input.labourMeter ?? DEFAULT_LABOUR_METER);
    setOverheadPercent(input.overheadPercent ?? 0);
    setProfitPercent(input.profitPercent ?? 0);

    setDisplayReport(module.output_json?.display ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module.id]);

  const numField =
    (setter: (v: number | "") => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setter(v === "" ? "" : Number(v));
    };

  const currentInput = () => ({
    brand,
    incomer,
    ct,
    meter,
    copperValue,
    labourBase,
    labourMeter,
    overheadPercent,
    profitPercent,
  });

  // -------- reset --------
  const handleReset = async () => {
    setBrand("");
    setIncomer("");
    setCt(false);
    setMeter(false);
    setCopperValue(DEFAULT_COPPER);
    setLabourBase(DEFAULT_LABOUR);
    setLabourMeter(DEFAULT_LABOUR_METER);
    setOverheadPercent(0);
    setProfitPercent(0);
    setDisplayReport(null);

    const clearedInput = {
      brand: "",
      incomer: "",
      ct: false,
      meter: false,
      copperValue: DEFAULT_COPPER,
      labourBase: DEFAULT_LABOUR,
      labourMeter: DEFAULT_LABOUR_METER,
      overheadPercent: 0,
      profitPercent: 0,
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
      console.error("Error resetting module:", error);
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

  // -------- generate (all validation / pricing happens in the calc-meterbox Edge Function) --------
  const handleGenerate = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const updated = await generateMeterBox({
        moduleId: module.id,
        title,
        quantity,
        input: currentInput(),
      });

      setTitle(updated.title);
      setDisplayReport(updated.output_json?.display ?? null);
      onModuleChange(updated);
    } catch (err) {
      console.error("Error generating Meter Box report:", err);
      setAlertMsg(err instanceof Error ? err.message : "Failed to generate report.");
    } finally {
      setGenerating(false);
    }
  };

  // -------- save title / quantity / inputs only --------
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
      return;
    }
    if (existing && existing.length > 0) {
      setAlertMsg("A module with this title already exists in this project.");
      return;
    }

    const nQty = quantity === "" ? 0 : quantity;
    const inputJson = currentInput();

    const { error } = await supabase
      .from("project_modules")
      .update({ title, quantity: nQty, input_json: inputJson })
      .eq("id", module.id);

    if (error) {
      console.error("Error saving module:", error);
      setAlertMsg("Error saving module.");
      return;
    }

    onModuleChange({ ...module, title, quantity: nQty, input_json: inputJson });
  };

  // -------- delete --------
  const handleDelete = () => setConfirmOpen(true);

  const confirmDelete = async () => {
    setConfirmOpen(false);

    const { error } = await supabase.from("project_modules").delete().eq("id", module.id);

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
              onChange={numField(setQuantity)}
              onWheel={(e) => e.currentTarget.blur()}
            />
          </div>
        </div>
        <div className="cbank-module-toolbar-right">
          <button type="button" className="cbank-delete-button" onClick={handleDelete}>
            Delete
          </button>
          <button type="button" className="cbank-save-button" onClick={handleSaveMetaOnly}>
            Save
          </button>
        </div>
      </div>

      <h2>METER BOX</h2>

      <form id="meterBoxForm" onSubmit={(e) => e.preventDefault()}>
        <div className="section two-column">
          <div>
            <label htmlFor="meterbox-brand">Make:</label>
            <select
              id="meterbox-brand"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              required
            >
              <option value="">Select a make</option>
              {brandOptions.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>

        <h3>Select Incomer</h3>
        <div className="radio-row">
          {INCOMER_RATINGS.map((n) => (
            <label key={n}>
              <input
                type="radio"
                name="meterbox-incomer"
                value={n}
                checked={incomer === n}
                onChange={() => setIncomer(n)}
              />
              {n}A
            </label>
          ))}
        </div>

        <h3>Metering Options</h3>
        <div className="radio-row">
          <label>
            <input type="checkbox" checked={ct} onChange={(e) => setCt(e.target.checked)} />
            CT
          </label>
          <label>
            <input type="checkbox" checked={meter} onChange={(e) => setMeter(e.target.checked)} />
            Meter
          </label>
        </div>

        <div className="section single-column">
          <div>
            <label>Copper value</label>
            <input
              type="number"
              min={0}
              value={copperValue}
              onChange={numField(setCopperValue)}
              onWheel={(e) => e.currentTarget.blur()}
              placeholder={`Default = ${DEFAULT_COPPER}`}
            />
          </div>

          <div>
            <label>Labour cost (AED)</label>
            <input
              type="number"
              min={0}
              value={labourBase}
              onChange={numField(setLabourBase)}
              onWheel={(e) => e.currentTarget.blur()}
              placeholder={`Default = ${DEFAULT_LABOUR}`}
            />
          </div>

          <div>
            <label>Extra labour when Meter is selected (AED)</label>
            <input
              type="number"
              min={0}
              value={labourMeter}
              onChange={numField(setLabourMeter)}
              onWheel={(e) => e.currentTarget.blur()}
              placeholder={`Default = ${DEFAULT_LABOUR_METER}`}
            />
          </div>

          <div>
            <label>Overhead (in %)</label>
            <input
              type="number"
              min={0}
              value={overheadPercent}
              onChange={numField(setOverheadPercent)}
              onWheel={(e) => e.currentTarget.blur()}
              placeholder="Default = 0%"
            />
          </div>

          <div>
            <label>Profit (in %)</label>
            <input
              type="number"
              min={0}
              value={profitPercent}
              onChange={numField(setProfitPercent)}
              onWheel={(e) => e.currentTarget.blur()}
              placeholder="Default = 0%"
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

          <button type="button" className="module-btn module-btn-secondary" onClick={handleReset}>
            Reset
          </button>
        </div>

        <ModuleReport report={displayReport} />
      </form>

      {alertMsg && <ModuleAlertModal message={alertMsg} onClose={() => setAlertMsg(null)} />}

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

export default MeterBoxModule;
