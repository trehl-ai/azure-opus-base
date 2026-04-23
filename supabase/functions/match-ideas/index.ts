import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  const { query, match_threshold = 0.65, match_count = 10 } = await req.json();

  if (!query || query.trim().length < 3) {
    return new Response(JSON.stringify({ error: "Query zu kurz" }), { status: 400 });
  }

  // 1. Embedding via Gemini
  const embedRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/gemini-embedding-001",
        content: { parts: [{ text: query }] },
      }),
    }
  );

  if (!embedRes.ok) {
    const err = await embedRes.text();
    return new Response(JSON.stringify({ error: `Gemini: ${err}` }), { status: 500 });
  }

  const embedData = await embedRes.json();
  const embedding = embedData.embedding.values;

  // 2. match_contacts RPC
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data, error } = await supabase.rpc("match_contacts", {
    query_embedding: embedding,
    match_threshold,
    match_count,
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ results: data }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
