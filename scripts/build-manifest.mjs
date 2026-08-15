/**
 * Genera content/manifest.json leyendo el frontmatter de cada nodo.
 * Uso:  node scripts/build-manifest.mjs
 * Correr SIEMPRE después de agregar o editar un nodo.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const DIR_NODOS = "content/nodos";
const DIR_CARDS = "content/flashcards";

/** Parser mínimo del subconjunto de YAML que usamos */
function parseFrontmatter(texto) {
  const m = texto.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return null;
  const out = {};
  for (const linea of m[1].split("\n")) {
    const mm = linea.match(/^(\w+):\s*(.*)$/);
    if (!mm) continue;
    const [, clave, valorCrudo] = mm;
    let v = valorCrudo.trim();
    if (v === "null" || v === "") v = null;
    else if (v.startsWith("[")) {
      v = v.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean);
    } else if (/^\d+$/.test(v)) v = Number(v);
    out[clave] = v;
  }
  if (!Array.isArray(out.prerequisitos)) out.prerequisitos = [];
  return out;
}

const nodos = readdirSync(DIR_NODOS)
  .filter((f) => f.endsWith(".md"))
  .map((archivo) => {
    const texto = readFileSync(join(DIR_NODOS, archivo), "utf8");
    const fm = parseFrontmatter(texto);
    if (!fm) throw new Error(`Sin frontmatter válido: ${archivo}`);
    const rutaCards = join(DIR_CARDS, `${fm.id}.json`);
    return {
      id: fm.id,
      titulo: fm.titulo,
      clase: fm.clase,
      parent: fm.parent ?? null,
      tipo: fm.tipo ?? null,
      escala: fm.escala ?? null,
      prerequisitos: fm.prerequisitos,
      xp: fm.xp ?? 0,
      archivo: `nodos/${archivo}`,
      flashcards: existsSync(rutaCards) ? `flashcards/${fm.id}.json` : null,
    };
  })
  .sort((a, b) => a.id.localeCompare(b.id));

// Validaciones: enlaces rotos matan la navegación
const ids = new Set(nodos.map((n) => n.id));
const errores = [];
for (const n of nodos) {
  if (n.parent && !ids.has(n.parent))
    errores.push(`${n.id}: padre inexistente "${n.parent}"`);
  for (const p of n.prerequisitos)
    if (!ids.has(p)) errores.push(`${n.id}: prerrequisito inexistente "${p}"`);
  if (!["dominio", "estudio"].includes(n.clase))
    errores.push(`${n.id}: clase inválida "${n.clase}"`);
}
if (errores.length) {
  console.error("Errores en el contenido:\n" + errores.join("\n"));
  process.exit(1);
}

const manifest = {
  version: "2.0.0",
  generadoEl: new Date().toISOString().slice(0, 10),
  totalNodos: nodos.length,
  nodos,
};

writeFileSync("content/manifest.json", JSON.stringify(manifest, null, 2));
console.log(`manifest.json generado: ${nodos.length} nodos, 0 errores.`);
