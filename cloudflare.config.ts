import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  accountId: "31e10441428ce46909b07b4574ca62f2",
  worker: defineWorker({
    name: "hookline",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-09",
    compatibilityFlags: ["nodejs_compat"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      DB: bindings.d1({ name: "hookline" }),
    },
  }),
});
