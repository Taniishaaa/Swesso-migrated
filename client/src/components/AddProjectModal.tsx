import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";
import "./css/ProjectModal.css";

type Project = {
  id: string;
  name: string;
  description: string | null;
  total_cost: number | null;
  created_at: string;
  updated_at: string | null;
};

type AddProjectModalProps = {
  open: boolean;
  onClose: () => void;
  onProjectCreated: (project: Project) => void;
};

const AddProjectModal: React.FC<AddProjectModalProps> = ({
  open,
  onClose,
  onProjectCreated,
}) => {
  const { user } = useAuth();

  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!newProjectName.trim()) {
      setError("Project name is required.");
      return;
    }

    setError(null);
    setCreatingProject(true);

    try {
      const { data, error: insertError } = await supabase
        .from("projects")
        .insert({
          user_id: user.id,
          name: newProjectName.trim(),
          description: newProjectDescription.trim() || null,
        })
        .select(
          "id, name, description, total_cost, created_at, updated_at"
        )
        .single();

      if (insertError) {
        console.error("Error creating project:", insertError);
        setError("Could not create project.");
      } else if (data) {
        onProjectCreated(data as Project);
        setNewProjectName("");
        setNewProjectDescription("");
        onClose();
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      setError("Something went wrong while creating the project.");
    } finally {
      setCreatingProject(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h2>Create New Project</h2>
          <button
            type="button"
            className="modal-close-button"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {error && <div className="modal-error">{error}</div>}

        <form
          onSubmit={handleCreateProject}
          className="modal-form"
        >
          <div className="modal-field">
            <label htmlFor="project-name">
              Project name
            </label>
            <input
              id="project-name"
              type="text"
              value={newProjectName}
              onChange={(e) =>
                setNewProjectName(e.target.value)
              }
              placeholder="e.g. ABC Mall – LV Panels"
            />
          </div>

          <div className="modal-field">
            <label htmlFor="project-description">
              Description (optional)
            </label>
            <textarea
              id="project-description"
              value={newProjectDescription}
              onChange={(e) =>
                setNewProjectDescription(e.target.value)
              }
              placeholder="Short summary of the project..."
              rows={3}
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="modal-cancel-button"
              onClick={onClose}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={creatingProject}
              className="modal-submit-button"
            >
              {creatingProject ? "Creating..." : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProjectModal;
