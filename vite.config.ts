import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" makes the built site work whether it is served from a domain
// root or from a sub-folder (handy when handing a static build to a customer).
export default defineConfig({
  plugins: [react()],
  base: "./",
});
