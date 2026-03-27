// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function getAllowedOrigins() {
  const fromEnv = String(Deno.env.get("ALLOWED_ORIGINS") || "").trim();
  const defaults = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5500"
  ];

  if (!fromEnv) return defaults;
  return fromEnv
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

function corsHeadersFor(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin"
  };
}

function isAllowedOrigin(origin, allowedOrigins) {
  return allowedOrigins.includes(origin);
}

Deno.serve(async (req) => {
  const allowedOrigins = getAllowedOrigins();
  const origin = req.headers.get("origin") || "";

  if (!origin || !isAllowedOrigin(origin, allowedOrigins)) {
    return new Response(JSON.stringify({ error: "Origen no permitido" }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }

  const corsHeaders = corsHeadersFor(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { redirectTo } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    if (!Deno.env.get("SUPABASE_URL") || !Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
      return new Response(
        JSON.stringify({ error: "Configuración incompleta" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const { data: cfg, error: cfgError } = await supabase
      .from("configuracion")
      .select("admin_email")
      .eq("id", 1)
      .single();

    if (cfgError || !cfg?.admin_email) {
      return new Response(
        JSON.stringify({ error: "No hay admin_email configurado en Supabase" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const { error } = await supabase.auth.resetPasswordForEmail(String(cfg.admin_email).trim(), {
      redirectTo: String(redirectTo || "")
    });

    if (error) {
      return new Response(
        JSON.stringify({ error: "No se pudo enviar recuperación" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Error interno" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
