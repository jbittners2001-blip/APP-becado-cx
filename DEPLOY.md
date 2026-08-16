# Despliegue y configuración de la Fase 2

La app es 100 % de navegador (sin backend). Para que funcionen el respaldo
en Google Drive y la generación con IA, hay que **publicarla por HTTPS** y
que cada usuario ponga sus propias credenciales.

## 1. Publicar en Firebase Hosting

```bash
npm install
npm run build                 # genera dist/
npm install -g firebase-tools # una sola vez
firebase login
# Edita .firebaserc y pon el ID real de tu proyecto de Firebase
firebase deploy
```

Tu app queda en `https://TU-PROYECTO.web.app`.

> Alternativas equivalentes: GitHub Pages, Netlify o Vercel. Lo único
> imprescindible es servir `dist/index.html` por HTTPS (OAuth de Google
> **no** funciona abriendo el archivo local `file://`).

## 2. Configurar Google Drive (OAuth) — una vez por proyecto

1. Entra a <https://console.cloud.google.com> y crea (o elige) un proyecto.
2. **APIs y servicios → Biblioteca →** habilita **Google Drive API**.
3. **APIs y servicios → Pantalla de consentimiento OAuth**: tipo "Externo",
   completa nombre y correo. Agrega el scope
   `https://www.googleapis.com/auth/drive.file`. Añade tu correo como
   usuario de prueba (o publica la app).
4. **Credenciales → Crear credenciales → ID de cliente de OAuth →**
   tipo **Aplicación web**. En **Orígenes de JavaScript autorizados** agrega
   la URL donde publicaste (p. ej. `https://TU-PROYECTO.web.app`, y
   `http://localhost:5173` para desarrollo con `npm run dev`).
5. Copia el **Client ID** (`...apps.googleusercontent.com`).
6. En la app: **⚙ Configuración → ☁️ Google Drive**, pega el Client ID,
   Guardar, y luego **⬆ Guardar en Drive** / **⬇ Restaurar de Drive**.

El scope `drive.file` implica que la app **solo** ve el archivo
`beca-rpg-contenido.json` que ella misma crea; nunca el resto de tu Drive.

## 3. Configurar la IA — cada usuario, con su propia clave

**⚙ Configuración → ✨ Inteligencia artificial**: elige proveedor, pega tu
API key y (opcional) ajusta el modelo.

- **Claude (Anthropic)** — recomendado. Clave desde
  <https://console.anthropic.com>.
- **Gemini (Google)** — clave desde <https://aistudio.google.com/app/apikey>.
- **ChatGPT (OpenAI)** — clave desde <https://platform.openai.com/api-keys>.

La clave se guarda solo en el navegador (localStorage). No la uses en un
equipo público compartido. Sin clave, el Taller sigue funcionando con el
flujo de copiar el prompt y pegar el resultado a mano.
