# Beca-RPG × Quirófano Lab (v4)

Sistema de gestión de contenido quirúrgico gamificado. Especialidades →
árbol en LISTA VERTICAL que se expande hacia la derecha → cada nodo con
su carpeta de fuentes, resumen y flashcards con repetición espaciada.

## Qué cambió en v4

**Árbol como lista vertical.** Nada de diagramas SVG: cada nodo es una
fila; sus hijos se indentan hacia la derecha al expandir (▸/▾). Dentro
de cada nivel, los ASPECTOS del nodo (anatomía → criterio → técnica,
siempre en ese orden progresivo) van primero; los SUBTEMAS (entidades
específicas como "Colecistitis") van después, separados por un divisor
— nunca mezclados como si fueran lo mismo.

**Mover nodos: botón "✏️ Modificar" + arrastrar.** Ya no hay un selector
en lista aparte. Tocas "Modificar", arrastras cualquier fila y la
sueltas sobre el dominio que quieras como nuevo padre (protegido contra
ciclos). En modo edición también puedes renombrar en línea y eliminar
con 🗑 (siempre a la Papelera).

**El Taller ahora razona antes de proponer.** Al analizar un
megaresumen:
- Sus secciones de anatomía, criterio y técnica se convierten
  DIRECTAMENTE en los 3 nodos estándar de ese nivel — con el contenido
  que el megaresumen ya trae para cada uno. Siempre se crean los 3, en
  orden progresivo, nunca se olvida la anatomía.
- El resto de entidades específicas se proponen como SUBTEMAS aparte,
  con un tope sugerido de 5 por nivel (se preseleccionan las más
  desarrolladas). Cada subtema elegido es siempre un tema completo —
  ya no hay que decidir "nodo simple vs. tema" sección por sección.

**Configuración y respaldo, global.** Ya no está dentro del Taller.
Desde el ⚙ de la barra superior (o en la pantalla de especialidades):
exportar TODO, solo una especialidad, o un nodo específico con todo lo
que contiene. Cuando el navegador lo permite (Chrome, Edge), usa el
selector real de archivos del sistema — puedes navegar directo a una
carpeta sincronizada con Google Drive Desktop. Importar nunca modifica
el archivo original: crea una copia propia en tu navegador.

## Estructura

```
content/
  manifest.json          generado automáticamente, NO editar a mano
  nodos/*.md               un archivo por nodo semilla
  flashcards/*.json
scripts/
  build-manifest.mjs      regenera el manifest y VALIDA el árbol
src/
  types.ts                 contrato de datos
  content.ts                operaciones del árbol + orden progresivo
  store.tsx                  estado global: progreso + contenido + papelera
  srs.ts                      algoritmo SM-2
  fileIO.ts                   selector real de archivos + fallback
  SelectorEspecialidad.tsx     pantalla de entrada
  SkillTree.tsx                 árbol como lista vertical anidada
  DomainPanel.tsx                panel de un nodo dominio
  NodeModal.tsx                   panel de un nodo de estudio
  Taller.tsx                       fuentes → nodos (racionalizado) → flashcards
  Configuracion.tsx                 exportar/importar con alcance elegido
  AccionesNodo.tsx                   renombrar / eliminar
  CrearNodoManual.tsx                 formulario rápido de creación
  Papelera.tsx                         restaurar o purgar
```

## Comandos

```bash
npm install
node scripts/build-manifest.mjs   # tras agregar o editar nodos semilla
npm run dev
npm run build                     # genera dist/index.html (archivo único)
```

## Reglas de oro

1. **Hogar canónico**: la información vive en el nodo cuyo tema es.
2. **Separación estricta**: contenido y progreso son almacenes distintos.
3. **Gating suave**: los prerrequisitos son guía visual, no candados.
4. **Nada se borra al toque**: toda eliminación pasa por la Papelera.
5. **Orden progresivo siempre**: anatomía → criterio → técnica, nunca
   mezclado al mismo nivel que un subtema específico.
6. **Validación humana**: ningún contenido generado con IA queda
   canónico sin que un cirujano lo revise.

## Roadmap

- [x] Fase 1 — Especialidades + árbol jerárquico + Taller racionalizado +
      configuración global
- [x] Fase 2 — Perfil por becado (progreso separado), respaldo en Google
      Drive del propio usuario (OAuth, scope `drive.file`) e IA integrada
      multi-proveedor (Claude / Gemini / ChatGPT) para generar resúmenes
      y flashcards. Mover nodos por arrastre (drag & drop). Ver `DEPLOY.md`.
- [ ] Fase 3 — Poblar más ramas (digestivo hasta fístula enteroatmosférica)
- [ ] Fase 4 — Interrogación oral con IA en tiempo real
