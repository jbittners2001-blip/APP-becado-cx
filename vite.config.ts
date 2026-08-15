import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// viteSingleFile empaqueta TODO (JS, CSS, contenido) en un único
// index.html que se puede abrir con doble clic, sin servidor.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: "./",
});
