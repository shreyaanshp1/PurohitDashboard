import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const demoEnvKeys = ["USERNAME", "PASSWORD", "2FA_SECRET", "NAME", "ROLE"];

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const exposeLocalDemoCredentials = command === "serve";

  return {
    base: process.env.GITHUB_PAGES_BASE || "/",
    define: Object.fromEntries(
      demoEnvKeys.map((key) => [
        `__DEV_DEMO_${key}__`,
        JSON.stringify(exposeLocalDemoCredentials ? env[`VITE_DEMO_${key}`] || "" : "")
      ])
    ),
    plugins: [react()],
    server: {
      proxy: {
        "/api": "http://127.0.0.1:8787"
      }
    }
  };
});
