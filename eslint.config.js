import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // Enforce SINGLE Supabase client — disallow createClient() outside the
      // canonical client.ts. See src/integrations/supabase/client.ts.
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.name='createClient']",
          message:
            "Do not instantiate a new Supabase client. Import the single `supabase` client from '@/integrations/supabase/client'.",
        },
      ],
    },
  },
  {
    // The canonical client file is the ONLY place allowed to call createClient().
    files: ["src/integrations/supabase/client.ts"],
    rules: {
      "no-restricted-syntax": "off",

  },
);
