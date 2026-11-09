// POST /functions/v1/calc-mdb
// Body: { moduleId, title, quantity, input: { breakerType, values } }
// Runs as the CALLING USER (their JWT), so RLS applies to every query.
// Returns the updated project_modules row.

import { createClient } from "npm:@supabase/supabase-js@2";
import { calculateMDB } from "./calc.ts";
import { loadPrices } from "./prices.ts";
import { parseRequest, ValidationError } from "./validate.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*", // tighten to your site origin in production
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!authHeader || !token) return json({ error: "Unauthorized." }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  try {
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: "Unauthorized." }, 401);
    const userId = userData.user.id;

    const { moduleId, title, quantity, input } = parseRequest(await req.json().catch(() => null));

    // RLS makes this return nothing for modules the user doesn't own.
    const { data: mod, error: modErr } = await supabase
      .from("project_modules").select("id, project_id, module_type").eq("id", moduleId).single();
    if (modErr || !mod) return json({ error: "Module not found." }, 404);
    if (mod.module_type !== "MDB") return json({ error: "Wrong module type." }, 400);

    const { data: dupes, error: dupErr } = await supabase
      .from("project_modules").select("id")
      .eq("project_id", mod.project_id).eq("title", title).neq("id", moduleId);
    if (dupErr) throw dupErr;
    if (dupes && dupes.length > 0) {
      return json({ error: "A module with this title already exists in this project." }, 409);
    }

    const { data: profile, error: profErr } = await supabase
      .from("profiles").select("organization").eq("id", userId).single();
    if (profErr || !profile?.organization) return json({ error: "Organization not found for user." }, 400);

    const prices = await loadPrices(supabase, profile.organization);
    if (prices.length === 0) return json({ error: "Price book is empty." }, 500);

    const result = calculateMDB(input, prices);
    const totalPrice = result.unitPrice * quantity;

    const { data: updated, error: updErr } = await supabase
      .from("project_modules")
      .update({
        title,
        quantity,
        unit_price: result.unitPrice,
        total_price: totalPrice,
        input_json: { ...input, ...result.derived }, // derived: totalWidth + outCombinedMccbGroupings
        output_json: { domain: result.domain, items: result.items, display: result.display },
      })
      .eq("id", moduleId)
      .select()
      .single();
    if (updErr) throw updErr;

    await supabase.from("projects").update({ updated_at: new Date().toISOString() }).eq("id", mod.project_id);

    return json({ module: updated });
  } catch (err) {
    if (err instanceof ValidationError) return json({ error: err.message }, 400);
    console.error("calc-mdb failed:", err);
    return json({ error: "Internal error." }, 500);
  }
});
