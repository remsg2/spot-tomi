import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // « server-only » lève une erreur hors du runtime React Server : neutre en test.
      "server-only": fileURLToPath(new URL("./tests/unit/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // supabase/functions : code Deno pur, testé ici avec ses dépendances simulées.
    include: ["src/**/*.test.{ts,tsx}", "tests/unit/**/*.test.{ts,tsx}", "supabase/functions/**/*.test.ts"],
    exclude: ["**/node_modules/**", ".claude/**"],
  },
});
