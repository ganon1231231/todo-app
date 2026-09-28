# Dr.Coach! Mobile Companion v0.5

**Multi-gestor**: Tampermonkey/Violentmonkey (Android, Edge, PC/Mac) · **Safari iOS/iPadOS** con las apps «Userscripts» o «Stay» · Tampermonkey dentro del navegador Orion.

## Qué hace
- **Píldora fija «DC · Español/Original»** dentro de Medicospira: confirma que el script está vivo y sirve para alternar el idioma con un toque (sin depender del Workspace). **Punto rojo = fallo de red.**
- Permite seleccionar y copiar texto dentro de Medicospira (barrita flotante «Copiar / → Stem»).
- `→ Stem` envía la selección al campo Caso clínico de Dr.Coach!.
- Traduce Medicospira **en el mismo iframe** y **reemplaza** el inglés por español (no modo bilingüe).
- El botón `Español / Original` del Workspace controla este userscript (y la píldora se sincroniza).
- Mantiene traducción en páginas dinámicas del QBank.
- **Novedad v0.4**: también corre sobre la página de Dr.Coach! para autodiagnóstico — si pulsas «Español» y el QBank no contesta, muestra un aviso con los pasos para arreglarlo (permisos, Safari vs app instalada, planes B/C).
- **Novedad v0.4.2 (Orion-proof)**: la red va **fetch primero (CORS)** — no depende de `GM_xmlhttpRequest`, que Orion rompe con sus «Limited runtime host permissions». Cascada de motores: Google gtx → Google alternativo (clients5) → MyMemory → Bing (GM). Si todo falla: aviso «⚠ La traducción falló — <motivo>» con la causa y el arreglo concreto.
- **Novedad v0.5.0 (motor por lotes, ~10× más rápido)**: antes cada nodo de texto era una petición HTTP (100-300 peticiones por página ⇒ minutos). Ahora agrupa **~25 textos por petición** (clients5 multi-q con mapeo nativo 1:1, respaldo gtx con delimitador `@@@`, y cascada por-texto solo para rezagados) ⇒ una página del QBank se traduce en **segundos**. **Circuit breaker**: si un proveedor da HTTP 429 se esquiva 60 s. **Caché persistente** (400 entradas en el almacenamiento del gestor): revisitar una pregunta = instantáneo. **Progreso en la píldora**: «DC · 34/120» mientras traduce.
- **Novedad v0.5.1 (Google bloquea gtx + diagnóstico)**: Google responde a gtx con HTTP 200 + HTML «Sorry…» en muchas IPs (rompe el parse sin dar 429) → ahora **clients5 (dict-chrome-ex) va primero** en lotes y por-texto, los fallos de parse repetidos **penalizan 60 s** al proveedor, y tras un fallo de red el motor **reintenta solo** al expirar la penalización. MyMemory ya no recorta textos largos (trocea por frases) y detecta cuota agotada. **Pulsación larga en la píldora DC = panel de diagnóstico** que prueba los 4 motores en vivo (✅/❌ + latencia + motivo) con «Copiar resultado» para reportar.
- **Novedad v0.5.2 (progreso real + lotes auto-reparables + watchdog)**: el contador de la píldora **por fin avanza de verdad** («DC · 13/82» — antes se clavaba en 0/N toda la traducción y parecía rota). Los lotes que fallan de forma intermitente se **parten por la mitad y se reintentan solos** (split-retry): un bloque problemático ya no arrastra 25 textos al modo lento individual — verificado en pruebas forzando el fallo de todos los lotes grandes: la página queda traducida igual. Y un **watchdog de arranque** recrea la píldora si a los 4 s no existe (arranque colgado a medias).
- **Novedad v0.5.3 (centro de control en la página de Dr.Coach!)**: el badge efímero de 5 s se sustituye por una **píldora PERMANENTE «DC · …»** con el **estado del QBank en vivo**: verde «DC · QBank v0.5.3 ✓» (conectado, leyendo la versión real del handshake), ámbar «DC · QBank sin responder» (el gestor no inyecta DENTRO del iframe) y «DC · vX» fuera del Workspace. Al tocarla se abre un panel con el **arreglo de 1 toque «↗ Abrir QBank en pestaña propia»** (abre el src real del iframe — la misma pregunta — como página principal, donde el gestor SÍ inyecta y la píldora DC traduce con el motor por lotes), los pasos exactos del permiso («Todos los sitios web: Permitir» — «Preguntar» nunca pregunta dentro de los iframes) y **«Copiar informe»** con versión del script, versión del Companion del QBank, URL, src del iframe y frescura de la señal. Las señales del QBank solo se aceptan del iframe real de Medicospira (nada de falsos «conectado» por spoofing).

## Instalación

### iPad (Safari) — app «Userscripts» (gratis, recomendada)
1. App Store → instalar **«Userscripts»** (Justin Wasack).
2. Ajustes → Safari → Extensiones → **Userscripts**: activar y dar permiso **«Todos los sitios web» → Permitir** (no «Preguntar»).
3. Instalar el script: abrir en Safari https://ganon1231231.github.io/todo-app/companions/mobile-userscript/DrCoach-Mobile-Companion.user.js → la app muestra el **aviso de instalación** → aceptar. (Alternativa manual: descargar el archivo y moverlo a la carpeta «Userscripts» con la app Archivos, luego ↻ en la app.)
4. **Importante**: usar Dr.Coach **dentro de Safari** — las extensiones no corren en la app instalada de pantalla de inicio.
5. Recargar Dr.Coach! → Workspace → dentro del QBank debe verse la píldora **«DC · Español»**.

### iPad (Safari) — alternativa «Stay»
Instalar Stay (App Store), activarla en Extensiones y usar su importador por URL con el mismo enlace de arriba (es compatible con la sintaxis de Tampermonkey).

### iPad — alternativa «Orion» (Tampermonkey real)
Instalar **Orion Browser** (Kagi) desde el App Store → dentro de Orion, abrir la Chrome Web Store → añadir **Tampermonkey** → instalar el script desde el enlace de arriba. Experiencia idéntica al escritorio.

**Importante en Orion** (ver guía para el detalle): la auto-actualización de scripts está rota — cuando salga versión nueva, **borra el script y reinstálalo desde la URL**; y concede permiso a Tampermonkey para `ganon1231231.github.io` y `usmle.medicospira.com` («Permitir siempre en este sitio»), o verás «Tampermonkey has no access to this page».

### Android / Lenovo (Edge) — Tampermonkey
1. Desactiva/elimina el userscript de Immersive Translate para evitar traducciones duplicadas.
2. Tampermonkey → crear/importar script → instala `DrCoach-Mobile-Companion.user.js` (o pega la URL de arriba en la pestaña «Utilidades» → Importar).
3. Recarga Dr.Coach! y Workspace.
4. Pulsa `Español` en la cabecera del Workspace (o la píldora «DC · Español» dentro del QBank).

## Solución de problemas
Guía completa con las 7 causas típicas y las señales rápidas: **[`docs/IPAD-SAFARI.md`](../../docs/IPAD-SAFARI.md)** § «Solución de problemas». Resumen: usar Safari (no la PWA instalada), permiso «Todos los sitios web» → Permitir, script en verde en el popup, y recargar Safari por completo.

## Actualizaciones automáticas
El script declara `@updateURL`/`@downloadURL` apuntando al sitio publicado: Tampermonkey y Stay comprueban actualizaciones solas con cada release (la versión va en la cabecera). En «Userscripts», abrir el enlace del script en Safari ofrece la actualización.

## Privacidad / red
La traducción automática móvil usa Google Translate (2 hosts), MyMemory y Bing como fallbacks mediante endpoints web sin clave. El texto a traducir se envía a esos servicios. No lo uses para texto con datos clínicos identificables de pacientes reales.
