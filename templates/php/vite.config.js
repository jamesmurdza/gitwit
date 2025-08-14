import path from "path"
import { defineConfig } from "vite"
import php from "vite-plugin-php"
export default defineConfig({
  plugins: [php()],
  server: {
    host: "0.0.0.0",
    allowedHosts: true, // Allow all hosts
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
