import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "./",

  plugins: [react(), tailwindcss()],

  server: {
  proxy: {
    "/api": {
      // target: "https://api.kutumbi.com",
      // target: "http://139.59.29.193:3000",
      target: "https://app.knowe.in",
      changeOrigin: true,
      secure: false,

      configure(proxy) {
        proxy.on("proxyReq", (proxyReq, req) => {
          console.log("====== Proxy Request ======");
          console.log("URL:", req.url);
          console.log("Authorization:", req.headers.authorization);
          console.log("Cookie:", req.headers.cookie);
        });
      },
    },
  },
},
});
