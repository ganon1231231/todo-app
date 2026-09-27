# Dr.Coach! en iPad con Safari — userscripts estilo Tampermonkey

**Sí, se puede.** Safari en iPadOS no admite Tampermonkey directamente, pero hay tres formas de ejecutar userscripts que dejan el flujo igual al de tu PC/Mac: el botón **«Español / Original»** del Workspace traduce el QBank dentro del iframe, y al seleccionar texto aparece la barrita **«Copiar / → Stem»**.

El userscript es el mismo para todos los casos: [`companions/mobile-userscript/DrCoach-Mobile-Companion.user.js`](https://ganon1231231.github.io/todo-app/companions/mobile-userscript/DrCoach-Mobile-Companion.user.js) (v0.3.0, multi-gestor).

---

## Opción A — App «Userscripts» (recomendada: gratis, open source, nativa de Safari)

Es el «Tampermonkey de Safari». Pasos en el iPad (5 minutos):

1. **Instalar la app**: App Store → buscar **«Userscripts»** (de Justin Wasack; icono de llave inglesa). Gratis y sin suscripciones.
2. **Primer arranque**: abrir la app una vez. Te pedirá elegir la **carpeta de scripts**: acepta la propuesta de iCloud Drive (o «En mi iPad» si prefieres solo local).
3. **Activar la extensión en Safari**:
   - Ajustes → **Safari** → **Extensiones** → **Userscripts**.
   - Activar el interruptor y en «Permitir estos sitios» / **Todos los sitios web** elegir **Permitir**.
   - (Alternativa granular: permitir solo `ganon1231231.github.io` y `usmle.medicospira.com`.)
   - En iPadOS 17+ la ruta puede ser Ajustes → Apps → Safari → Extensiones.
4. **Añadir el userscript**:
   - Abre en Safari esta URL: `https://ganon1231231.github.io/todo-app/companions/mobile-userscript/DrCoach-Mobile-Companion.user.js`
   - Se descarga a **Descargas** (app Archivos).
   - En Archivos, **mantén pulsado el archivo → Mover → carpeta «Userscripts»**.
5. **Sincronizar**: abre la app Userscripts → pulsa **↻** → debe aparecer `Dr.Coach! Mobile Companion` con el **interruptor en verde**.
6. **Usar**: recarga Dr.Coach! en Safari → entra al Workspace → pulsa **Español**. El QBank se traduce dentro del marco; al seleccionar texto verás la barrita **«Copiar / → Stem»**.

> Consejo: añade Dr.Coach! a la pantalla de inicio (Compartir → «Añadir a pantalla de inicio») para usarla como app. Los userscripts funcionan igual dentro del WebView de la PWA cuando la extensión tiene permiso global.

## Opción B — «Stay» (compatible con Tampermonkey)

1. App Store → instalar **Stay** (versión gratuita suficiente).
2. Abrir Stay → activar la extensión en Ajustes → Safari → Extensiones (permiso en «Todos los sitios web» → Permitir).
3. En Stay, usar el importador por URL con el enlace del userscript de arriba (Stay entiende la sintaxis Tampermonkey).
4. Recargar Dr.Coach! → Workspace → botón «Español».

## Opción C — Navegador «Orion» (Tampermonkey de verdad)

Orion (de Kagi) es el único navegador en iPadOS que instala **extensiones reales de Chrome/Firefox**:

1. App Store → instalar **Orion Browser** (gratis).
2. Dentro de Orion, abrir `chrome.google.com/webstore` → buscar **Tampermonkey** → Añadir.
3. Con Tampermonkey instalado, abrir el enlace del userscript → «Instalar».
4. Entrar a Dr.Coach! desde Orion → Workspace → «Español».

Experiencia 1:1 con tu Mac/PC (incluye el menú de Tampermonkey con «Traducir a español / Ver original»).

---

## Qué obtienes en el iPad con cualquiera de las tres

| Función | Estado |
|---|---|
| Botón «Español/Original» traduce el QBank en el iframe | ✅ |
| Selección y copia de texto en Medicospira (normalmente bloqueadas) | ✅ |
| Barrita flotante «Copiar» y «→ Stem» al caso clínico | ✅ |
| Traducción persistente en páginas dinámicas del QBank | ✅ |
| Control desde el Workspace (READY/STATUS postMessage) | ✅ |

## Notas y límites

- **Traducción nativa de Safari**: para abrir el QBank en pestaña propia sigue existiendo el truco del sistema: **aA → «Traducir página»** (traduce la página entera, pero fuera del Workspace).
- **Privacidad**: el texto traducido se envía a Google (primario) y Bing (fallback) mediante endpoints web sin clave. No traduzcas texto con datos clínicos identificables de pacientes reales.
- **Actualizaciones**: el script declara `@updateURL`/`@downloadURL` contra el sitio publicado — Tampermonkey y Stay se actualizan solos; con la app «Userscripts» basta repetir el paso 4 cuando avise el CHANGELOG.
- **Sin Companion en iPadOS**: las extensiones de Chrome no existen en Safari; los userscripts SON la vía Companion en iPad. En PC/Mac sigue siendo mejor la extensión Dr.Coach-Companion.
