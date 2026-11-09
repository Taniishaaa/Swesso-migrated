import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../supabaseClient";
import "./css/ProjectWorkspace.css";
import AddModuleModal from "../components/AddModuleModal";
import ModuleAlertModal from "../components/ModuleAlertModal";

import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

import CBank800Module, {
  type ProjectModuleRow as CBankModuleRow,
} from "../modules/CBank800Module";

import MDBModule, {
  type ProjectModuleRow as MDBModuleRow,
} from "../modules/MDBModule";

import SMDBModule, {
  type ProjectModuleRow as SMDBModuleRow,
} from "../modules/SMDBModule";

import DBRowModule, {
  type ProjectModuleRow as DBRowModuleRow,
} from "../modules/DBRowModule";

import Form4Module, {
  type ProjectModuleRow as Form4ModuleRow,
} from "../modules/Form4Module";

import MeterBoxModule, {
  type ProjectModuleRow as MeterBoxModuleRow,
} from "../modules/MeterBoxModule";

/* -------------------- types -------------------- */

type Project = {
  id: string;
  name: string;
  description: string | null;
  total_cost: number | null;
  created_at: string;
  updated_at: string | null;
};

type ProjectModule = {
  id: string;
  project_id: string;
  module_type: string;
  title: string;
  quantity: number;
  unit_price: number | null;
  total_price: number | null;
  input_json: any | null;
  output_json: any | null;
  created_at: string;
  updated_at: string | null;
};

/* -------------------- component -------------------- */

const ProjectWorkspacePage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [modules, setModules] = useState<ProjectModule[]>([]);
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [creatingModule, setCreatingModule] = useState(false);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  /* -------- project report state -------- */
  const [projectReport, setProjectReport] =
    useState<ProjectModule[] | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const [orgName, setOrgName] = useState<string | null>(null);


  /* ---------- auth guard ---------- */
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login", { replace: true });
    }
  }, [authLoading, user, navigate]);

useEffect(() => {
  if (!user) return;

  const loadOrg = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("organization")
      .eq("id", user.id)
      .single();

    if (!error && data?.organization) {
      setOrgName(data.organization);
    } else {
      console.error("Failed to load organization", error);
    }
  };

  loadOrg();
}, [user]);

  /* ---------- load project + modules ---------- */
  useEffect(() => {
    if (!projectId || !user) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: proj, error: projError } = await supabase
          .from("projects")
          .select("id, name, description, total_cost, created_at, updated_at")
          .eq("id", projectId)
          .single();

        if (projError) {
          setError("Could not load project.");
          return;
        }

        setProject(proj as Project);

        const { data: mods, error: modsError } = await supabase
          .from("project_modules")
          .select(
            "id, project_id, module_type, title, quantity, unit_price, total_price, input_json, output_json, created_at, updated_at"
          )
          .eq("project_id", projectId)
          .order("updated_at", { ascending: false });

        if (modsError) {
          setError("Could not load modules.");
        } else if (mods) {
          const casted = mods as ProjectModule[];
          setModules(casted);
          if (casted.length > 0) setActiveModuleId(casted[0].id);
        }
      } catch {
        setError("Something went wrong.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [projectId, user]);

  /* ---------- helpers ---------- */

  const currencyFormatter = new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 2,
  });

  const formatCurrency = (value: number | null) => {
    if (value == null) return "—";
    return currencyFormatter.format(value);
  };

  const getEffectiveTotal = (m: ProjectModule) => {
    if (m.unit_price == null) return 0;
    return m.quantity * m.unit_price;
  };

  /* ---------- effective project total (validated) ---------- */

const effectiveProjectTotal = modules.reduce(
  (sum, m) => sum + getEffectiveTotal(m),
  0
);

const displayProjectTotal =
  project?.total_cost != null &&
  Math.abs(project.total_cost - effectiveProjectTotal) < 0.01
    ? project.total_cost
    : effectiveProjectTotal;


  const activeModule = modules.find((m) => m.id === activeModuleId) || null;

  /* ---------- module actions ---------- */

  const handleAddModule = () => setNavigatorOpen(true);

  const handleCreateModuleOfType = async (moduleType: string) => {
    if (!projectId) return;

    setCreatingModule(true);
    setError(null);

    try {
      const existingOfType = modules.filter((m) => m.module_type === moduleType);
      let maxNumber = 0;

existingOfType.forEach((m) => {
  const match = m.title.match(/\d+$/); // extract ending number
  if (match) {
    const num = parseInt(match[0], 10);
    if (num > maxNumber) {
      maxNumber = num;
    }
  }
});

const defaultTitle = `${moduleType} ${maxNumber + 1}`;

      const { data, error } = await supabase
        .from("project_modules")
        .insert({
          project_id: projectId,
          module_type: moduleType,
          title: defaultTitle,
          quantity: 1,
          input_json: {},
        })
        .select()
        .single();

      if (error) {
  console.error("Module creation failed:", error);
  setAlertMsg("Failed to create module. Try again.");
  return;
}

if (data) {
  setModules((prev) => [data as ProjectModule, ...prev]);
  setActiveModuleId(data.id);
}

      await supabase
  .from("projects")
  .update({ updated_at: new Date().toISOString() })
  .eq("id", projectId);

      setNavigatorOpen(false);
    } finally {
      setCreatingModule(false);
    }
  };

  const handleBackToProjects = () => navigate("/projects");

  const handleDeleteProject = async () => {
  if (!projectId) return;

  // delete all modules first (safety)
  await supabase
    .from("project_modules")
    .delete()
    .eq("project_id", projectId);

  // delete project
  await supabase
    .from("projects")
    .delete()
    .eq("id", projectId);

  navigate("/projects");
};

  /* ---------- project total recompute ---------- */

  const recomputeProjectTotal = async (updatedModules: ProjectModule[]) => {
    if (!projectId) return;

    const total = updatedModules.reduce(
      (sum, m) => sum + (m.total_price ?? 0),
      0
    );

    setProject((prev) =>
      prev ? { ...prev, total_cost: total } : prev
    );

    await supabase
  .from("projects")
  .update({
    total_cost: total,
    updated_at: new Date().toISOString(),
  })
  .eq("id", projectId);

  };

const handleModuleUpdated = async (updated: any) => {
  if (!updated?.id || !projectId) return;

  const now = new Date().toISOString();

  setModules((prev) => {
    const next = prev.map((m) =>
      m.id === updated.id
        ? { ...m, ...updated, updated_at: now }
        : m
    );
    void recomputeProjectTotal(next);
    return next;
  });

  await supabase
    .from("projects")
    .update({ updated_at: now })
    .eq("id", projectId);
};


  const handleModuleDeleted = async (id?: string) => {
    const deleteId = id ?? activeModule?.id;
    if (!deleteId) return;

    setModules((prev) => {
      const next = prev.filter((m) => m.id !== deleteId);
      setActiveModuleId(next[0]?.id ?? null);
      void recomputeProjectTotal(next);
      return next;
    });

    await supabase.from("project_modules").delete().eq("id", deleteId);

    await supabase
  .from("projects")
  .update({ updated_at: new Date().toISOString() })
  .eq("id", projectId);

  };

  /* ---------- project report ---------- */

  const handleGenerateProjectReport = () => {
    const validModules = modules.filter((m) => m.unit_price != null);

    if (validModules.length === 0) {
      setAlertMsg("No modules with generated results yet.");
      return;
    }

    setProjectReport(validModules);
    setReportOpen(true);
  };

const handleDownloadProjectExcel = () => {
  if (!projectReport) return;

  /* =========================
     Sheet 1 — Modules Summary
  ========================= */

  const summaryRows = projectReport.map((m) => ({
    "Module Type": m.module_type,
    Title: m.title,
    Quantity: m.quantity,
    "Unit Price (AED)": m.unit_price ?? 0,
    "Total Price (AED)": getEffectiveTotal(m),
  }));

  const grandTotal = projectReport.reduce(
    (sum, m) => sum + getEffectiveTotal(m),
    0
  );

  summaryRows.push({
    "Module Type": "",
    Title: "TOTAL",
    Quantity: 0,
    "Unit Price (AED)": 0,
    "Total Price (AED)": grandTotal,
  });

  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);

  /* ==================================
     Sheet 2 — Per Module Components
  ================================== */

  const perModuleRows: any[] = [];

  projectReport.forEach((m) => {
    const items = Array.isArray(m.output_json?.items)
      ? m.output_json.items
      : [];

    items.forEach((item: any) => {
      const finalQty = item.quantity * m.quantity;
      const unitPrice = item.unitPrice ?? 0;

      perModuleRows.push({
        Module: m.module_type,
        Title: m.title,
        Item: item.name,
        Quantity: finalQty,
        "Unit Price (AED)": unitPrice,
        "Total (AED)": finalQty * unitPrice,
      });
    });
  });

  const perModuleGrandTotal = perModuleRows.reduce(
    (sum, r) => sum + (r["Total (AED)"] || 0),
    0
  );

  perModuleRows.push({
    Module: "",
    Title: "",
    Item: "TOTAL",
    Quantity: "",
    "Unit Price (AED)": "",
    "Total (AED)": perModuleGrandTotal,
  });

  const perModuleSheet = XLSX.utils.json_to_sheet(perModuleRows);

  /* ==================================
     Sheet 3 — Overall Components (Merged)
  ================================== */

  const mergedMap: Record<string, any> = {};

  projectReport.forEach((m) => {
    const items = Array.isArray(m.output_json?.items)
      ? m.output_json.items
      : [];

    items.forEach((item: any) => {
      const finalQty = item.quantity * m.quantity;
      const unitPrice = item.unitPrice ?? 0;

      // normalize name to use as merge key
      const key = String(item.name || "").trim().toUpperCase();

      if (!mergedMap[key]) {
        mergedMap[key] = {
          Item: item.name,
          Quantity: 0,
          "Unit Price (AED)": unitPrice,
          "Total (AED)": 0,
        };
      }

      mergedMap[key].Quantity += finalQty;
      mergedMap[key]["Total (AED)"] += finalQty * unitPrice;
    });
  });

  const mergedRows = Object.values(mergedMap);

  const mergedGrandTotal = mergedRows.reduce(
    (sum: number, r: any) => sum + (r["Total (AED)"] || 0),
    0
  );

  mergedRows.push({
    Item: "TOTAL",
    Quantity: "",
    "Unit Price (AED)": "",
    "Total (AED)": mergedGrandTotal,
  });

  const mergedSheet = XLSX.utils.json_to_sheet(mergedRows);

  /* =========================
     Build Workbook
  ========================= */

  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, summarySheet, "Modules Summary");
  XLSX.utils.book_append_sheet(wb, perModuleSheet, "Module Components");
  XLSX.utils.book_append_sheet(wb, mergedSheet, "Overall Components");

  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(
    new Blob([buffer], { type: "application/octet-stream" }),
    `${project?.name ?? "Project"}_Final_Report.xlsx`
  );
};


  /* ---------- render module ---------- */

  const renderModuleContent = () => {

if (!orgName) {
  return <div className="project-main-empty">Loading organization...</div>;
}

    if (!activeModule) {
      return (
        <div className="project-main-empty">
          <p>Select a module from the left sidebar.</p>
        </div>
      );
    }

    switch (activeModule.module_type) {
     case "CBANK800":
  return (
    <CBank800Module
      module={activeModule as CBankModuleRow}
      orgName={orgName ?? ""}        
      onModuleChange={handleModuleUpdated}
      onModuleDeleted={handleModuleDeleted}
    />
  );

      case "MDB":
        return (
          <MDBModule
            module={activeModule as MDBModuleRow}
            orgName={orgName ?? ""} 
            onModuleChange={handleModuleUpdated}
            onModuleDeleted={handleModuleDeleted}
          />
        );
      case "SMDB":
        return (
          <SMDBModule
            module={activeModule as SMDBModuleRow}
            orgName={orgName ?? ""} 
            onModuleChange={handleModuleUpdated}
            onModuleDeleted={handleModuleDeleted}
          />
        );
      case "DBROW":
        return (
          <DBRowModule
            module={activeModule as DBRowModuleRow}
            orgName={orgName ?? ""} 
            onModuleChange={handleModuleUpdated}
            onModuleDeleted={handleModuleDeleted}
          />
        );
      case "FORM4":
  return (
    <Form4Module
      module={activeModule as Form4ModuleRow}
      orgName={orgName ?? ""}
      onModuleChange={handleModuleUpdated}
      onModuleDeleted={handleModuleDeleted}
    />
  );
      case "METERBOX":
        return (
          <MeterBoxModule
            module={activeModule as MeterBoxModuleRow}
            orgName={orgName ?? ""}
            onModuleChange={handleModuleUpdated}
            onModuleDeleted={handleModuleDeleted}
          />
        );
      default:
        return null;
    }
  };

  if (!projectId) return null;

  const reportGrandTotal =
    projectReport?.reduce(
      (sum, m) => sum + getEffectiveTotal(m),
      0
    ) ?? 0;

return (
  <>
    <Navbar />
    <main className="project-page">
      {/* HEADER */}
      <section className="project-header">
        <div className="project-header-left">
          <button
            type="button"
            onClick={handleBackToProjects}
            className="project-back-btn"
          >
            ← Back to projects
          </button>
          <h1 className="project-title">{project?.name}</h1>
        </div>

        <div className="project-header-right">
          <div className="project-total-label">Total cost</div>
          <div className="project-total-value">
            {formatCurrency(displayProjectTotal)}
          </div>
          <button
            type="button"
            className="project-generate-report-btn"
            onClick={handleGenerateProjectReport}
          >
            Project Report
          </button>
          <button
            type="button"
            className="project-delete-icon-btn"
            title="Delete Project"
            onClick={() => setConfirmDeleteOpen(true)}
          >
            🗑️
          </button>
        </div>
      </section>

      {/* LAYOUT */}
      <section className="project-layout">
        <aside className="project-sidebar">
          <div className="project-sidebar-header">
            <div className="project-sidebar-title">Modules</div>
            <button
              type="button"
              className="project-add-module-btn"
              onClick={handleAddModule}
            >
              +
            </button>
          </div>

          <div className="project-module-list">
            {modules.map((m) => (
              <button
                key={m.id}
                className={
                  "project-module-item" +
                  (m.id === activeModuleId
                    ? " project-module-item-active"
                    : "")
                }
                onClick={() => setActiveModuleId(m.id)}
              >
                <div className="project-module-title">{m.title}</div>
                <div className="project-module-meta">
                  <span>{m.module_type}</span>
                  <span>Qty: {m.quantity}</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="project-main">
          {renderModuleContent()}
        </section>
      </section>

      {/* PROJECT REPORT MODAL */}
      {reportOpen && projectReport && (
        <div className="project-report-modal-overlay">
          <div className="project-report-modal">
            <div className="project-report-modal-header">
              <h2>Project Report — {project?.name}</h2>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="project-report-close-btn"
              >
                ✕
              </button>
            </div>

            <div className="project-report-modal-body">
              <table className="project-report-table">
                <thead>
                  <tr>
                    <th>Module Type</th>
                    <th>Title</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Total Price</th>
                  </tr>
                </thead>
                <tbody>
                  {projectReport.map((m) => (
                    <tr key={m.id}>
                      <td>{m.module_type}</td>
                      <td>{m.title}</td>
                      <td>{m.quantity}</td>
                      <td>{formatCurrency(m.unit_price)}</td>
                      <td>{formatCurrency(getEffectiveTotal(m))}</td>
                    </tr>
                  ))}

                  <tr className="project-report-total-row">
                    <td colSpan={4}>TOTAL</td>
                    <td>{formatCurrency(reportGrandTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="project-report-modal-footer">
              <button
                type="button"
                className="project-download-excel-btn"
                onClick={handleDownloadProjectExcel}
              >
                Download Excel
              </button>
            </div>
          </div>
        </div>
      )}

      {navigatorOpen && (
        <AddModuleModal
          creating={creatingModule}
          onClose={() => !creatingModule && setNavigatorOpen(false)}
          onChoose={handleCreateModuleOfType}
        />
      )}

      {/* DELETE PROJECT MODAL */}
      {confirmDeleteOpen && (
        <div className="project-report-modal-overlay">
          <div className="project-report-modal project-delete-modal">
            <div className="project-report-modal-header">
              <h2>Delete Project</h2>
              <button
                type="button"
                className="project-report-close-btn"
                onClick={() => setConfirmDeleteOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="project-report-modal-body">
              <p className="project-delete-text">
                Are you sure you want to permanently delete{" "}
                <strong>{project?.name}</strong>?
              </p>
              <p className="project-delete-warning">
                This action cannot be undone.
              </p>
            </div>

            <div className="project-report-modal-footer project-delete-footer">
              <button
                type="button"
                className="project-download-excel-btn project-cancel-btn"
                onClick={() => setConfirmDeleteOpen(false)}
              >
                Cancel
              </button>

              <button
                type="button"
                className="project-download-excel-btn project-delete-btn"
                onClick={handleDeleteProject}
              >
                Delete
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
    </main>
  </>
);

};

export default ProjectWorkspacePage;
