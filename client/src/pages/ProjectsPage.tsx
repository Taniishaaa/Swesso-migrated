/* eslint-disable react-hooks/rules-of-hooks */
import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../supabaseClient";
import AddProjectModal from "../components/AddProjectModal";
import "./css/projects.css";

type Project = {
  id: string;
  name: string;
  description: string | null;
  total_cost: number | null;
  created_at: string;
  updated_at: string | null;
};

type SortOption =
  | "name_asc"
  | "name_desc"
  | "created_desc"
  | "created_asc"
  | "updated_desc"
  | "price_asc"
  | "price_desc";

const ProjectsPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("updated_desc");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Redirect if not authenticated
  if (!authLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  useEffect(() => {
    if (!user) return;

    const loadProjects = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase
  .from("projects")
  .select(`
    id,
    name,
    description,
    total_cost,
    created_at,
    updated_at,
    project_modules (
      quantity,
      unit_price
    )
  `)
  .eq("user_id", user.id);


        if (error) {
          console.error("Error loading projects:", error);
          setError("Could not load projects.");
        } else {
          const computed = (data || []).map((p: any) => {
  const modules = p.project_modules || [];

  const total = modules.reduce(
    (sum: number, m: any) =>
      sum + (m.unit_price ?? 0) * (m.quantity ?? 0),
    0
  );

  return {
    id: p.id,
    name: p.name,
    description: p.description,
    created_at: p.created_at,
    updated_at: p.updated_at,
    total_cost: total, // 
  } as Project;
});

setProjects(computed);
        }
      } catch (err) {
        console.error("Unexpected error:", err);
        setError("Something went wrong.");
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, [user]);

  
const filteredAndSortedProjects = useMemo(() => {
  let result = [...projects];

  // ✅ PREFIX-BASED SEARCH (starts with)
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    result = result.filter((p) =>
      p.name.toLowerCase().startsWith(q)
    );
  }

  // ✅ SORTING
  result.sort((a, b) => {
    switch (sortBy) {
      case "name_asc":
        return a.name.localeCompare(b.name);

      case "name_desc":
        return b.name.localeCompare(a.name);

      case "created_desc":
        return (
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
        );

      case "created_asc":
        return (
          new Date(a.created_at).getTime() -
          new Date(b.created_at).getTime()
        );

      case "updated_desc":
        return (
          new Date(b.updated_at ?? b.created_at).getTime() -
          new Date(a.updated_at ?? a.created_at).getTime()
        );

      case "price_asc":
        return (a.total_cost ?? 0) - (b.total_cost ?? 0);

      case "price_desc":
        return (b.total_cost ?? 0) - (a.total_cost ?? 0);

      default:
        return 0;
    }
  });

  return result;
}, [projects, searchQuery, sortBy]);


  const currencyFormatter = new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 2,
  });

  const formatCurrency = (value: number | null) => {
    if (value == null) return "—";
    return currencyFormatter.format(value);
  };

const formatDate = (date: string) =>
  new Date(date).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <>
      <Navbar />

      <main className="projects-page">
        {loading || authLoading ? (
          <div className="projects-loading">
            Loading projects...
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="projects-header">
              <input
                type="text"
                className="projects-search"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) =>
                  setSearchQuery(e.target.value)
                }
              />

              <select
                className="projects-sort"
                value={sortBy}
                onChange={(e) =>
                  setSortBy(e.target.value as SortOption)
                }
              >
                <option value="updated_desc">
                  Last edited (recent first)
                </option>
                <option value="created_desc">
                  Created date (newest first)
                </option>
                <option value="created_asc">
                  Created date (oldest first)
                </option>
                <option value="name_asc">
                  Name (A–Z)
                </option>
                <option value="name_desc">
                  Name (Z–A)
                </option>
                <option value="price_asc">
                  Price (low → high)
                </option>
                <option value="price_desc">
                  Price (high → low)
                </option>
              </select>

              <button
                type="button"
                className="projects-add-button"
                onClick={() => setIsAddModalOpen(true)}
              >
                + Add Project
              </button>
            </div>

            {error && (
              <div className="projects-error">
                {error}
              </div>
            )}

            {/* Projects list */}
            {filteredAndSortedProjects.length === 0 ? (
              <p className="projects-empty">
                No projects found.
              </p>
            ) : (
              <div className="projects-list">
                {filteredAndSortedProjects.map(
                  (project) => (
                    <div
                      key={project.id}
                      className="project-card"
                      onClick={() =>
                        navigate(
                          `/projects/${project.id}`
                        )
                      }
                    >
                      <div className="project-main">
                        <div className="project-name">
                          {project.name}
                        </div>

                        <div className="project-meta">
  <div className="project-updated">
    Last edited:{" "}
    {formatDate(
      project.updated_at || project.created_at
    )}
  </div>
  <div className="project-created">
    Created:{" "}
    {formatDate(project.created_at)}
  </div>
</div>

                      </div>

                      <div className="project-price">
                        {formatCurrency(
                          project.total_cost
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Add Project Modal */}
      <AddProjectModal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onProjectCreated={(project) =>
          setProjects((prev) => [project, ...prev])
        }
      />
    </>
  );
};

export default ProjectsPage;
