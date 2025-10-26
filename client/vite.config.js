import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const useHttps = env.VITE_USE_HTTPS === "true";

  let httpsConfig = false;
  if (useHttps) {
    const keyPath = env.VITE_SSL_KEY_FILE ?? "../server/config/dev-tls.key";
    const certPath = env.VITE_SSL_CRT_FILE ?? "../server/config/dev-tls.crt";
    httpsConfig = {
      key: fs.readFileSync(path.resolve(__dirname, keyPath)),
      cert: fs.readFileSync(path.resolve(__dirname, certPath)),
    };
  }

  return {
    plugins: [
      react({
        include: /\.(js|jsx|ts|tsx)$/,
      }),
    ],
    server: {
      host: true,
      https: httpsConfig,
    },
    preview: {
      https: httpsConfig,
    },
  };
});
