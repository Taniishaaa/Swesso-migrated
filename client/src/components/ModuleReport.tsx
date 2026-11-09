import React from "react";
import "./css/ModuleReport.css";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

type DisplayReport = {
  summary: Record<string, string | number>;
  components: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  totals: {
  labour?: number;
  overhead?: number;
  profit?: number;  
  misc?: number;
  grandTotal: number;
};
};

type ModuleReportProps = {
  report: DisplayReport | null;
};

const ModuleReport: React.FC<ModuleReportProps> = ({ report }) => {
  if (!report) return null;

  /* ===============================
     EXCEL EXPORT
     =============================== */
  const handleDownloadExcel = () => {
    const workbook = XLSX.utils.book_new();

    /* ===== SUMMARY ===== */
    const summaryRows = Object.entries(report.summary).map(
      ([key, value]) => ({
        Field: formatKey(key),
        Value: value,
      })
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(summaryRows),
      "Summary"
    );

    /* ===== COMPONENTS + TOTALS ===== */
    const rows: any[] = report.components.map((c) => ({
      Component: c.name,
      Quantity: c.quantity,
      UnitPrice: c.unitPrice,
      Total: c.total,
    }));

    // ---- totals appended (ORDER MATTERS) ----
    rows.push({});
    if (report.totals.labour !== undefined)
      rows.push({ Component: "Labour", Total: report.totals.labour });

    if (report.totals.overhead !== undefined)
      rows.push({ Component: "Overhead", Total: report.totals.overhead });

    if (report.totals.profit !== undefined)
  rows.push({ Component: "Profit", Total: report.totals.profit });

    if (report.totals.misc !== undefined)
      rows.push({ Component: "Miscellaneous", Total: report.totals.misc });
    
    rows.push({
      Component: "GRAND TOTAL",
      Total: report.totals.grandTotal,
    });

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(rows),
      "Components"
    );

    const buffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    saveAs(
      new Blob([buffer], {
        type:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      "Module_Report.xlsx"
    );
  };

  /* ===============================
     RENDER
     =============================== */
  return (
    <div className="module-report-card">
      {/* ===== SUMMARY ===== */}
      <h3 className="module-report-title">Summary</h3>
      <table className="module-report-table">
        <tbody>
          {Object.entries(report.summary).map(([k, v]) => (
            <tr key={k}>
              <th className="summary-key">{formatKey(k)}</th>
              <td>{formatValue(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ===== COMPONENTS ===== */}
      <h3 className="module-report-title">Components</h3>
      <table className="module-report-table">
        <thead>
          <tr>
            <th className="component-col">Component</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {report.components.map((c, i) => (
            <tr key={i}>
              <td className="component-col">{c.name}</td>
              <td>{c.quantity}</td>
              <td>{formatValue(c.unitPrice)}</td>
              <td>{formatValue(c.total)}</td>
            </tr>
          ))}

          {/* ===== TOTALS (INLINE) ===== */}
          <tr className="totals-separator">
            <td colSpan={4}></td>
          </tr>

          {report.totals.labour !== undefined && (
            <tr className="totals-row">
              <td>Labour</td>
              <td></td>
              <td></td>
              <td>{formatValue(report.totals.labour)}</td>
            </tr>
          )}

          {report.totals.overhead !== undefined && (
            <tr className="totals-row">
              <td>Overhead</td>
              <td></td>
              <td></td>
              <td>{formatValue(report.totals.overhead)}</td>
            </tr>
          )}

          {report.totals.profit !== undefined && (
  <tr className="totals-row">
    <td>Profit</td>
    <td></td>
    <td></td>
    <td>{formatValue(report.totals.profit)}</td>
  </tr>
)}

          {report.totals.misc !== undefined && (
            <tr className="totals-row">
              <td>Miscellaneous</td>
              <td></td>
              <td></td>
              <td>{formatValue(report.totals.misc)}</td>
            </tr>
          )}

          <tr className="grand-total-row">
            <td>GRAND TOTAL</td>
            <td></td>
            <td></td>
            <td>{formatValue(report.totals.grandTotal)}</td>
          </tr>
        </tbody>
      </table>

      {/* ===== TOOLBAR ===== */}
      <div className="module-report-toolbar">
        <button
          className="module-report-excel-btn"
          onClick={handleDownloadExcel}
        >
          Download Excel
        </button>
      </div>
    </div>
  );
};

export default ModuleReport;

/* ================= HELPERS ================= */

const formatKey = (key: string) =>
  key.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");

const formatValue = (v: string | number) =>
  typeof v === "number" ? v.toFixed(2) : v;
