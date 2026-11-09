/* eslint-disable react-hooks/rules-of-hooks */
import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../supabaseClient";
import "./css/profile.css";
import ModuleAlertModal from "../components/ModuleAlertModal";
import { loadBasePrices } from "../services/priceService";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  organization: string | null;
};

type PriceRow = Record<string, string>;

const ProfilePage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [search, setSearch] = useState("");

  // Modal & edit state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<PriceRow | null>(null);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  // Redirect if not authenticated
  if (!authLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      setLoading(true);
      setError(null);

      try {
        // Get auth metadata (for full name & organization)
        const { data: authUserData } = await supabase.auth.getUser();
        const authFullName =
          authUserData?.user?.user_metadata?.full_name ?? null;
        const authOrganization =
          authUserData?.user?.user_metadata?.organization ?? null;

        // Try fetching existing profile
        // eslint-disable-next-line prefer-const
        let { data: existingProfile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        // If profile does not exist, create one
        if (profileError && (profileError as any).code === "PGRST116") {
          const { data: insertedProfile, error: insertError } = await supabase
            .from("profiles")
            .insert({
              id: user.id,
              email: user.email,
              full_name:
                authFullName ||
                (user.email ? user.email.split("@")[0] : null),
              organization: authOrganization,
            })
            .select()
            .single();

          if (insertError) {
            console.error("Error creating profile:", insertError);
            setError("Could not create profile.");
          } else {
            existingProfile = insertedProfile;
          }
        } else if (profileError) {
          console.error("Error loading profile:", profileError);
          setError("Could not load profile.");
        }

        if (existingProfile) {
          setProfile(existingProfile as Profile);
        }
      } catch (err) {
        console.error("Unexpected error:", err);
        setError("Something went wrong.");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  // Load the central price book + this organization's overrides

  useEffect(() => {
  const loadPricesWithOverrides = async () => {
    if (!profile?.organization) return;

    try {
      // 1. Load base prices (central price book in the database)
      const basePrices = await loadBasePrices();

      // 2. Load overrides for org
      const overrides = await loadOverrides(profile.organization);

      // 3. Merge & set
      const merged = mergeOverrides(basePrices, overrides);
      setPrices(merged);
    } catch (err) {
      console.error("Failed to load prices:", err);
    }
  };

  loadPricesWithOverrides();
}, [profile?.organization]);



  const displayName =
    profile?.full_name || user?.email?.split("@")[0] || "User";

  const displayEmail = profile?.email || user?.email || "—";

  const displayOrg = profile?.organization || "—";

  // Filter prices by item name (starts with)
  const filteredPrices = prices.filter((row) =>
    row.ITEMS?.toLowerCase().startsWith(search.toLowerCase())
  );

  const handleSaveEdits = async () => {
    if (!editingRow || !profile?.organization) return;

    const payload = {
      org_name: profile.organization,
      code: editedValues.CODE,
      items: editedValues.ITEMS,
      abb: Number(editedValues.ABB),
      mg: Number(editedValues.MG),
      ge: Number(editedValues.GE),
      cutlerh: Number(editedValues.CUTLERH),
      seimens: Number(editedValues.SEIMENS),
      lg: Number(editedValues.LG),
      lt: Number(editedValues["L&T"]),
      dsmith: Number(editedValues.DSMITH),
      new_price: Number(editedValues.NEW),
      mbshi: Number(editedValues["M.BSHI"]),
      z: Number(editedValues.Z),
      updated_at: new Date().toISOString(),
    };

    try {
      await supabase
        .from("org_price_overrides")
        .upsert(payload, { onConflict: "org_name,code" });

      // Update UI locally
      setPrices((prev) =>
        prev.map((row) =>
          row.CODE === editedValues.CODE
            ? { ...row, ...editedValues }
            : row
        )
      );

      setIsModalOpen(false);
      setEditingRow(null);
    } catch (err) {
      console.error("Failed to save prices:", err);
      setAlertMsg("Failed to save prices");
    }
  };

const loadOverrides = async (orgName: string) => {
  const { data, error } = await supabase
    .from("org_price_overrides")
    .select("*")
    .eq("org_name", orgName);

  if (error) {
    console.error("Failed to load overrides:", error);
    return [];
  }

  return data || [];
};

const mergeOverrides = (
  base: PriceRow[],
  overrides: any[]
): PriceRow[] => {
  return base.map((row) => {
    const override = overrides.find(
      (o) => o.code === row.CODE
    );

    if (!override) return row;

    return {
      ...row,
      ITEMS: override.items ?? row.ITEMS,
      ABB: override.abb?.toString() ?? row.ABB,
      MG: override.mg?.toString() ?? row.MG,
      GE: override.ge?.toString() ?? row.GE,
      CUTLERH: override.cutlerh?.toString() ?? row.CUTLERH,
      SEIMENS: override.seimens?.toString() ?? row.SEIMENS,
      LG: override.lg?.toString() ?? row.LG,
      "L&T": override.lt?.toString() ?? row["L&T"],
      DSMITH: override.dsmith?.toString() ?? row.DSMITH,
      NEW: override.new_price?.toString() ?? row.NEW,
      "M.BSHI": override.mbshi?.toString() ?? row["M.BSHI"],
      Z: override.z?.toString() ?? row.Z,
    };
  });
};


  return (
    <>
      <Navbar />

      <main className="profile-page">
        {loading || authLoading ? (
          <div className="profile-loading">Loading your profile...</div>
        ) : (
          <>
            <h1 className="profile-title">My Profile</h1>

            {error && <div className="profile-error">{error}</div>}

            <section className="profile-card">
              <div className="profile-avatar">
                {displayName.charAt(0).toUpperCase()}
              </div>

              <div className="profile-info">
                <div className="profile-name">{displayName}</div>
                <div className="profile-email">
                  <strong>Email:</strong> {displayEmail}
                </div>
                <div className="profile-org">
                  <strong>Organization:</strong> {displayOrg}
                </div>
              </div>
            </section>

            {/* ===== Standard Prices Table (Static) ===== */}
            <section className="profile-prices">
              <h2 className="profile-subtitle">Standard Prices</h2>

              <input
                type="text"
                className="profile-prices-search"
                placeholder="Search item..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              {prices.length === 0 ? (
                <div className="profile-loading">Loading prices...</div>
              ) : (
                <div className="profile-prices-table-wrapper">
                  <table className="profile-prices-table">
                    <thead>
                      <tr>
                        <th>Edit</th>
                        {Object.keys(prices[0]).map((key) => (
                          <th key={key}>{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPrices.map((row, idx) => (
                        <tr key={idx}>
                         <td className="profile-edit-cell">
  <button
    type="button"
    className="profile-edit-icon"
    title="Edit"
    onClick={() => {
      setEditingRow(row);
      setEditedValues(row);
      setIsModalOpen(true);
    }}
  >
    ✏️
  </button>
</td>

                          {Object.values(row).map((val, i) => (
                            <td key={i}>{val}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ===== Edit Modal ===== */}
            {isModalOpen && editingRow && (
              <div className="profile-modal-backdrop">
                <div className="profile-modal">
                  <h3>Edit Prices</h3>

                  <div className="profile-modal-grid">
                    <div className="profile-modal-row">
                      <label>CODE</label>
                      <input value={editedValues.CODE} disabled />
                    </div>

                    {[
                      "ITEMS",
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
                    ].map((key) => (
                      <div key={key} className="profile-modal-row">
                        <label>{key}</label>
                        <input
                          type={key === "ITEMS" ? "text" : "number"}
                          value={editedValues[key] ?? ""}
                          onChange={(e) =>
                            setEditedValues((prev) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>

                  <div className="profile-modal-actions">
                    <button
                      onClick={() => setIsModalOpen(false)}
                      className="profile-modal-cancel"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEdits}
                      className="profile-modal-save"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
      {alertMsg && (
  <ModuleAlertModal
    message={alertMsg}
    onClose={() => setAlertMsg(null)}
  />
)}

    </>
  );
};

export default ProfilePage;
