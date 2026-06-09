// Local ESLint plugin (ESM — repo package.json has "type": "module").
import noSupabaseeicRls from "./no-supabaseeic-rls.js";

export default {
  rules: {
    "no-supabaseeic-rls": noSupabaseeicRls,
  },
};
