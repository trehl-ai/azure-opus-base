// ESM module (repo package.json has "type": "module").
// Custom ESLint rule: forbid the anon `supabaseEIC` client on RLS-protected
// tables/RPCs. supabaseEIC carries no session JWT, so auth.uid() is NULL and
// RLS policies return zero rows *silently* (no error). Use the session
// `supabase` client for these. See memory: eoipso_rls_session_client_rule.
export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Prevent using supabaseEIC client on RLS-protected tables and RPCs",
    },
    schema: [],
    messages: {
      noEicOnRls:
        "Use session supabase client for RLS tables. supabaseEIC is anon (auth.uid()=NULL) and returns empty results silently.",
    },
  },
  create(context) {
    const RLS_TABLES = new Set([
      "deals",
      "pipelines",
      "pipeline_stages",
      "deal_activities",
      "user_pipeline_restrictions",
    ]);
    const RLS_RPCS = new Set([
      "get_outreach_stats",
      "get_outreach_activities",
      "get_vr_stiftungen_stats",
    ]);

    function isSupabaseEICCall(node) {
      // supabaseEIC.from('table') or supabaseEIC.rpc('fn')
      return (
        node.type === "CallExpression" &&
        node.callee?.type === "MemberExpression" &&
        node.callee?.object?.name === "supabaseEIC"
      );
    }

    return {
      CallExpression(node) {
        if (!isSupabaseEICCall(node)) return;
        const method = node.callee?.property?.name;
        if (!method) return;
        const arg = node.arguments?.[0];
        if (!arg || arg.type !== "Literal") return;
        const val = arg.value;
        if (
          (method === "from" && RLS_TABLES.has(val)) ||
          (method === "rpc" && RLS_RPCS.has(val))
        ) {
          context.report({ node, messageId: "noEicOnRls" });
        }
      },
    };
  },
};
