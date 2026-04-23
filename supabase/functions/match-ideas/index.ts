// deno-lint-ignore-file no-explicit-any
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { query } = await req.json().catch(() => ({}));
    if (!query || typeof query !== "string" || query.trim().length < 3) {
      return new Response(
        JSON.stringify({ error: "query must be a string of at least 3 chars" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!geminiKey || !supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: "missing env vars" }),
        { status: 500, headers: jsonHeaders },
      );
    }

    // 1. Embed query
    const embedRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/gemini-embedding-001",
          content: { parts: [{ text: query }] },
          taskType: "RETRIEVAL_QUERY",
          outputDimensionality: 3072,
        }),
      },
    );
    if (!embedRes.ok) {
      const txt = await embedRes.text();
      console.error("[match-ideas] Gemini", embedRes.status, txt);
      return new Response(
        JSON.stringify({ error: `gemini embedding failed: ${embedRes.status}` }),
        { status: 502, headers: jsonHeaders },
      );
    }
    const embedJson = await embedRes.json();
    const embedding = embedJson?.embedding?.values;
    if (!Array.isArray(embedding)) {
      return new Response(
        JSON.stringify({ error: "invalid embedding response" }),
        { status: 502, headers: jsonHeaders },
      );
    }

    // 2. RPC match_contacts
    const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/match_contacts`, {
      method: "POST",
      headers: {
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query_embedding: embedding,
        match_threshold: 0.3,
        match_count: 5,
      }),
    });
    if (!rpcRes.ok) {
      const txt = await rpcRes.text();
      console.error("[match-ideas] RPC", rpcRes.status, txt);
      return new Response(
        JSON.stringify({ error: `match_contacts failed: ${rpcRes.status}` }),
        { status: 502, headers: jsonHeaders },
      );
    }
    const rows = await rpcRes.json() as Array<{
      id: string;
      first_name: string;
      last_name: string;
      job_title: string | null;
      company: string | null;
      similarity: number;
    }>;

    const results = rows.map((r) => ({
      id: r.id,
      first_name: r.first_name,
      last_name: r.last_name,
      subtitle: r.company || r.job_title || "",
      similarity: r.similarity,
    }));

    return new Response(JSON.stringify({ results }), { headers: jsonHeaders });
  } catch (err) {
    console.error("[match-ideas] Unexpected", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
