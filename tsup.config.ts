import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    iso: "src/iso.ts",
    "shared-worker-server": "src/shared-worker-server.ts",
    "shared-worker-client": "src/shared-worker-client.ts",
    transport: "src/transport.ts",
    "web-socket-transport": "src/web-socket-transport.ts",
    "web-socket-server": "src/web-socket-server.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
});
