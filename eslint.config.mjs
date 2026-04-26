import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  /**
   * Listing request panel syncs many fields from props / preview URLs via effects.
   * `react-hooks/set-state-in-effect` rejects that pattern; disabling here until a refactor
   * (derive state, or reset in event handlers only).
   */
  {
    files: ["src/components/dashboard/ShopFirstListingRequestPanel.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "scripts/**",
  ]),
]);

export default eslintConfig;
