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

- **⚠️ Las extensiones NO corren en la app instalada**: si abres Dr.Coach desde el icono de «pantalla de inicio», iPadOS no carga extensiones de Safari → los userscripts nunca se ejecutan. **Usa Dr.Coach dentro de Safari** para traducir (el icono instalado está bien para estudiar, pero sin traducción).
- **Traducción nativa de Safari**: para abrir el QBank en pestaña propia sigue existiendo el truco del sistema: **aA → «Traducir página»** (traduce la página entera, pero fuera del Workspace).
- **Privacidad**: el texto traducido se envía a Google (primario) y Bing (fallback) mediante endpoints web sin clave. No traduzcas texto con datos clínicos identificables de pacientes reales.
- **Actualizaciones**: el script declara `@updateURL`/`@downloadURL` contra el sitio publicado — Tampermonkey y Stay se actualizan solos; con la app «Userscripts» basta abrir el enlace del script en Safari y aceptar la actualización cuando avise el CHANGELOG.
- **Sin Companion en iPadOS**: las extensiones de Chrome no existen en Safari; los userscripts SON la vía Companion en iPad. En PC/Mac sigue siendo mejor la extensión Dr.Coach-Companion.

---

## 🛠️ Solución de problemas — «no se activa / no reconoce la página»

### Cómo saber si el script está vivo (v0.4.0)
El script ahora **siempre deja señal visible**:

| Dónde miras | Señal de vida |
|---|---|
| Dentro del QBank (Workspace) | Píldora fija abajo a la derecha: **«DC · Español»** (o «DC · Original» si ya está traduciendo). Tocándola alternas español/original sin usar el botón del Workspace. |
| En la página de Dr.Coach | El popup del gestor (ícono ᴀA → Userscripts/Tampermonkey) ahora **sí lista el script** (antes solo matcheaba el QBank y parecía «no reconocer» la página). |
| Si pulsas «Español» y el QBank no responde | Aparece un **aviso de diagnóstico** con los pasos de abajo, automáticamente. |

### Causas típicas (en orden de probabilidad)

1. **Estás en la app instalada (pantalla de inicio), no en Safari.** iPadOS no ejecuta extensiones en las web-apps instaladas. → Abre `https://ganon1231231.github.io/todo-app/` en Safari.
2. **Permiso del gestor limitado.** Ajustes → Safari → Extensiones → *Userscripts/Tampermonkey/Stay* → **«Todos los sitios web» → Permitir** (no «Preguntar»). En iPadOS 17+: Ajustes → Apps → Safari → Extensiones. Comprueba también el permiso por sitio desde el menú ᴀA → «Permisos del sitio web».
3. **El script está desactivado en el popup del gestor.** Los gestores permiten activar/desactivar cada script por dominio — toca la entrada del script en el popup y verifica que esté en verde.
4. **No se recargó tras activar la extensión.** Cierra Safari por completo (desliza fuera del multitarea) y reabre. Una recarga basta; iOS a veces necesita una segunda.
5. **El gestor no inyecta en iframes cruzados.** El QBank vive en un iframe de `usmle.medicospira.com` dentro de Dr.Coach. La app «Userscripts» **sí** inyecta en subframes (lo marca con la etiqueta `sub` en el popup). Si tu gestor/versión no lo hace:
   - **Plan B**: abre el QBank en pestaña propia — la píldora «DC · Español» funciona igual (el script es autónomo), y con iPadOS **Split View** tienes QBank traducido a un lado y Dr.Coach al otro.
   - **Plan C**: Orion + Tampermonkey (extensión real de escritorio).
6. **El script no se sincronizó en la app Userscripts.** Abre la app → ↻ → el interruptor del script debe estar verde. Si usas iCloud Drive, espera a que la sincronización termine (puede tardar).
7. **Caché del script viejo (v0.3 o anterior).** Abre el enlace del script en Safari y acepta la actualización, o repite la instalación. La versión correcta es **0.4.0** (visible en el popup del gestor).

### Señales rápidas de diagnóstico

- ¿Popup del gestor en Dr.Coach **sí** muestra el script? → El gestor corre bien; el problema está en la inyección del iframe o en el permiso de `medicospira.com`.
- ¿Píldora «DC · Español» **dentro** del QBank? → Todo OK: pulsa la píldora o el botón «Español» del Workspace.
- ¿Píldora fuera pero botón «Español» no traduce? → Los mensajes no cruzan el iframe: usa la píldora directamente (mismo resultado).
- ¿Nada de nada? → Plan B (QBank suelto) u Orion; ambos están en la tabla de arriba.
