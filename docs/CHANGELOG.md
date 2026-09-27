# Dr.Coach! — Registro de cambios

## v3.3.4 · Userscript v0.4.1: señales de vida visibles + diagnóstico desde la propia app (fix Orion «restricted URLs»)

- **Reporte real**: «Nada, no funcionaron los scripts ni en Orion ni en Safari; en Safari al menos la app ya reconoce que hay scripts, y en Orion dice algo como *some URLs are restricted*.»
- **Causa raíz #1 (documentación) encontrada y corregida**: la guía iPad tenía un consejo contradictorio («añade Dr.Coach a la pantalla de inicio… los userscripts funcionan igual dentro del WebView de la PWA») — **falso**: iPadOS nunca ejecuta extensiones de Safari en las web-apps instaladas. El consejo queda reemplazado por la advertencia correcta: **para traducir, Safari siempre**.
- **Orion «Some URLs are restricted by your browser or an extension»**: identificado como fallo conocido de **Tampermonkey 5.5.x** (repo oficial, issue #2846; afecta también a otros navegadores). Documentadas las dos soluciones en `docs/IPAD-SAFARI.md`: **Page Filter Mode → Blacklist** (Dashboard → Settings → Config mode Advanced → Security) y **Content Script API → UserScripts API Dynamic**; si nada, volver a la Opción A (Safari + app Userscripts).
- **Userscript v0.4.1 — prueba inequívoca de inyección**: aviso efímero **«🧩 Companion v0.4.1 activo»** al cargar: dentro del QBank (3 s, junto a la píldora DC) y en la página de Dr.Coach! (5 s, abajo a la izquierda, no interactivo). Si lo ves, el gestor EJECUTA el script; si no lo ves, es problema de permiso/inyección. Etiqueta de versión también en el handshake (`translator: drcoach-mobile-v0.4.1`).
- **Diagnóstico desde la app (sin depender del userscript)**: al pulsar «Español» sin respuesta del QBank, Dr.Coach! v3.3.4 muestra su **propia tarjeta de diagnóstico** con los 3 pasos (actualizar userscript por URL, permiso «Todos los sitios web», Safari vs pantalla de inicio + fix Page Filter de Orion) y enlace a la guía iPad. Detección de **PWA de pantalla de inicio en iOS** (`navigator.standalone` / `display-mode: standalone` + UA) → toast específico «iPadOS no ejecuta extensiones ahí; abre Dr.Coach! en Safari». Si el userscript ya está vivo en la página (`window.__dcMobileProbe`), la app no duplica la tarjeta (el aviso del script ya guía).
- Docs: IPAD-SAFARI.md actualizada (señales de vida v0.4.1, causa #8 Orion, advertencia PWA corregida, nota «si instalaste pegando código a mano no se auto-actualiza»).

## v3.3.3 · Userscript v0.4.0: visible, autónomo y autodiagnóstico (fix «no se activa en iPad»)

- **Reporte real**: con Userscripts/Tampermonkey activados en iPad, «no se activa, como que no reconoce la página». Diagnóstico: el script solo matcheaba `usmle.medicospira.com` (el iframe del QBank) — en la página de Dr.Coach el popup del gestor muestra únicamente los scripts del dominio actual, así que parecía que no corría nada; y si el gestor no tenía permiso sobre el dominio del QBank (o se usaba la PWA instalada, donde las extensiones no corren), nada se ejecutaba en ningún sitio.
- **Match ampliado**: ahora también `https://ganon1231231.github.io/todo-app/*` → el popup del gestor **siempre lista el script** en Dr.Coach, en cualquier dispositivo.
- **Píldora «DC · Español/Original»** (solo Medicospira): botón flotante fijo abajo a la derecha con punto de estado (verde=original, ámbar=traducido). Sirve de **confirmación visual de que el script está vivo** y permite alternar el idioma con un toque — funciona incluso sin el puente del Workspace y con el QBank abierto en pestaña propia (iPadOS Split View: QBank traducido a un lado, Dr.Coach al otro).
- **Autodiagnóstico en Dr.Coach!**: si pulsas el botón «Español» del Workspace y el QBank no responde en 4 s (sin señal READY/STATUS), aparece un aviso con los pasos exactos: permiso «Todos los sitios web» → Permitir, cerrar Safari por completo, no usar la PWA instalada (las extensiones solo corren en Safari), planes B/C. Se muestra una vez por carga; si el Companion o el userscript contestan, jamás aparece.
- **Aislamiento por rama**: el motor de traducción/copia SOLO arranca en Medicospira; en Dr.Coach el script únicamente escucha señales y vigila el botón (cero efectos secundarios en PC/Mac con Companion).
- `GM.addStyle` añadido a los grants (doc oficial Userscripts: `@grant` es imperativo); `renderPill()` integrado al ciclo de traducción; probe interno `window.__dcMobileProbe` para QA.
- Docs: **docs/IPAD-SAFARI.md** con sección completa «🛠️ Solución de problemas» (7 causas típicas + señales rápidas); README del userscript actualizado; instalación por URL ahora usa el aviso nativo de la app Userscripts.

## v3.3.2 · iPad con Safari: userscripts al estilo Tampermonkey

- **Pedido directo**: «¿se podría hacer algo como Tampermonkey en mi iPad usando userscript?» → **Sí**. Nueva guía completa **`docs/IPAD-SAFARI.md`** con las tres vías: app **Userscripts** (gratis, open source, nativa de Safari — recomendada), **Stay** (compatible Tampermonkey) y **Orion** (Tampermonkey real vía extensiones de Chrome/Firefox).
- **Userscript universal (v0.2.0 → v0.3.0)**: `DrCoach-Mobile-Companion.user.js` ahora funciona en **todos** los gestores gracias a un shim GM:
  - Detecta la API moderna `GM.*` (app «Userscripts» de Safari iOS/iPadOS, Greasemonkey 4) **y** las clásicas `GM_*` (Tampermonkey, Violentmonkey, Stay).
  - Preferencias (`drcoach-mobile-language`) con triple vía: `GM.getValue/setValue` → `GM_getValue/setValue` → `localStorage`.
  - Peticiones de red: `GM.xmlHttpRequest` → `GM_xmlhttpRequest` → `fetch` directo como último recurso (cuando el endpoint permite CORS).
  - Portapapeles: `GM.setClipboard` → `GM_setClipboard` → `navigator.clipboard` → `execCommand`.
  - Sin `GM_registerMenuCommand` (no existe en «Userscripts») el control sigue siendo el botón «Español/Original» del Workspace — que es el flujo principal.
- **Instalación directa por URL**: el script declara `@updateURL`/`@downloadURL` contra el sitio publicado (`.../companions/mobile-userscript/DrCoach-Mobile-Companion.user.js`) → Tampermonkey y Stay lo instalan con un clic y se **actualizan solos** con cada release.
- En el iPad se obtiene lo mismo que con Companion en PC/Mac: traducción inline EN→ES del QBank en el iframe, desbloqueo de selección/copiado y envío de selecciones al caso clínico (`→ Stem`).

## v3.3.1 · Copiar y pegar robusto en macOS y Windows

- **Auditoría completa del portapapeles** (pedido del uso real: «a veces no funcionan bien» entre Mac y Windows):
  - Nuevo helper **`copyTextToClipboard()`** con doble vía: API moderna (`navigator.clipboard.writeText`) → fallback clásico (`textarea` + `execCommand('copy')`) para modo portable (`file://`), navegadores viejos y permisos denegados. Verifica el resultado y preserva la selección previa del usuario.
  - **«Pegar imagen»**: errores clasificados (navegador sin API / permiso denegado / portapapeles sin imagen) con instrucciones según plataforma: **«Cmd+V» en Apple, «Ctrl+V» en Windows/Linux** (detección automática).
  - **«Pegar caso»**: si el navegador bloquea la lectura, ahora **enfoca el campo del caso clínico y deja el cursor listo** para pegar manualmente con el atajo correcto de tu sistema.
  - **Nueva vía de pegado**: en sesión/Workspace, `Cmd/Ctrl+V` fuera de un campo de texto **pega texto directamente al caso clínico** (las imágenes ya funcionaban igual); sin pelear con permisos del navegador.
- **Informe para IA (copiar)**: usa el helper con fallback — el «Copiar AI Study Dossier» ya no falla en silencio.
- Los atajos del Study Board (Cmd/Ctrl+Z deshacer, etc.) ya contemplaban ambas plataformas; sin cambios.

## v3.3.0 · De vuelta al traductor simple: Companion y Tampermonkey como camino principal

- **Pedido del uso real**: el traductor integrado de v3.2.x (panel con copiar/pegar, burbuja 🌐, botón ↗) agobiaba en lugar de ayudar. Se retira por completo y el Workspace vuelve al flujo de siempre: **un solo botón «Español / Original»** que alterna el idioma de Medicospira dentro del Workspace.
- **Cómo funciona (como en v2.x)**: el botón manda `postMessage` al QBank y el **Dr.Coach! Companion** (extensión de Chrome en PC/Mac) hace la traducción inline con la API local del navegador. Sin Companion instalado, un toast lo recuerda: «Instala Dr.Coach! Companion para traducir Medicospira dentro del Workspace.»
- **Tampermonkey / móvil**: el usuario-script `companions/mobile-userscript/DrCoach-Mobile-Companion.user.js` sigue operativo (envío de selecciones del QBank al caso clínico con `DRCOACH_MOBILE_SELECTION`). Para iPad, la vía manual queda a criterio del usuario (p. ej. abrir el QBank en pestaña propia y usar la traducción de página de Safari/Chrome cuando toque).
- **Eliminado**: `js/translator.js` (panel, burbuja 🌐, flujos iOS de pegado), botones «Traductor» y «↗» de la barra, y el fallback que abría el panel sin Companion. Barra limpia: **Recargar · Español · Ocultar Coach · ⌂ · ⤢** — idéntica a la de la versión anterior a v3.2.0.
- **Conservado**: `allow="translator"` en el iframe (permiso que el Companion necesita para traducir dentro del frame), todo el protocolo Companion (ping/READY/STATUS), el envío de selecciones y los dos companions en `companions/` intactos.

## v3.2.6 · Cero pasos por dispositivo: el config viaja con la web

- **Pedida por el uso real**: en lugar de pegar Project URL + anon key en cada dispositivo (pestaña «⚙ Conectar nube» de v3.2.5), ahora `config/supabase.config.js` **se sube al repo** y viaja con la web publicada — Mac/Windows/Lenovo/iPad entran con login y Cloud Sync **sin configurar absolutamente nada**.
- **¿Por qué es seguro?** La anon key es la clave **pública** del navegador: Supabase la diseña para ir dentro de toda app frontend y cualquier visitante ya puede verla en DevTools al usar la web. La protección real sigue intacta: **RLS** por fila, cuentas email+contraseña creadas a mano y registro público deshabilitado. La `service_role` key sigue siendo el único secreto y **nunca** entra en este archivo (documentado en el propio config, README, INSTALL-CLOUD y .gitignore).
- **Sin regresión**: quien ya guardó credenciales con «⚙ Conectar nube» sigue funcionando; el archivo tiene prioridad y la pestaña desaparece sola cuando el config está presente. La pestaña queda como plan B (repo clonado sin config, o datos del navegador borrados).
- Docs al día: README (estructura + nota de seguridad), INSTALL-CLOUD (§4, §6, §8), GITHUB-PAGES (resolución de problemas).

## v3.2.5 · Conectar tu Supabase desde la propia app (fix del login en GitHub Pages)

- **Problema**: en el sitio publicado (`usuario.github.io/...`) no aparecía la puerta de login — el archivo `config/supabase.config.js` con credenciales reales **nunca se publica en el repositorio** (regla de seguridad), y sin él la app arrancaba en modo local silencioso.
- **Solución**: nueva pestaña **«⚙ Conectar nube»** en la puerta de entrada — pegas tu **Project URL** y tu **clave anónima (anon public)** → se guardan **solo en el localStorage del dispositivo** → la app arranca en modo nube con login normal. Una vez por dispositivo, sin tocar el repositorio.
- Validaciones con mensajes claros (URL https, clave eyJ… completa, modo privado del navegador), aviso de no pegar la `service_role`, y el botón «Iniciar sesión» redirige al panel si aún no hay conexión.
- `cloud/supabase-client.js`: fallback automático archivo → localStorage; prioridad siempre al archivo local si existe (desarrollo).
- Resultado en cada dispositivo: Mac/Windows/Lenovo/iPad pegan las credenciales una vez → después login + Cloud Sync en todos, con el mismo usuario de Supabase.

## v3.2.4 · Publicación: el link de siempre actualizado (Pages por rama)

- **El repo publica en GitHub Pages por «Deploy from a branch» (main / raíz)** — configuración real del repo `ganon1231231/todo-app`: cada `git push` a `main` reconstruye el sitio en 1-2 minutos, sin Actions ni permisos extra.
- El workflow `deploy-pages.yml` (v3.2.4 inicial) se retiró del repo: el despliegue por rama no lo necesita y exigía permiso adicional de Workflows para subirlo. Guía `docs/GITHUB-PAGES.md` actualizada (rama = recomendado, Actions = alternativa documentada).
- Verificado para subcarpeta de Pages: `index.html` sin rutas absolutas, Service Worker con `register('./sw.js')`, manifest con `start_url`/`scope`/iconos relativos — la PWA se instala igual desde `usuario.github.io/todo-app/`.
- Verificado que `config/supabase.config.js` (credenciales) sigue ignorado por git: al repo solo sube la plantilla `example.js`.
- Respaldo del contenido anterior del repo en la rama `backup/version-anterior`.

## v3.2.3 · El ↗ no sustituye al flujo integrado (y pista de pegado en iOS)

- **Aclaración de diseño**: el botón «↗» es **opcional** — el flujo Workspace (QBank en el marco + panel de sesión al lado) sigue exactamente igual; la pestaña nueva solo es un atajo para cuando toque traducir la página completa con Safari (aA) o Chrome (⋮).
- Investigado y descartado con evidencia: el proxy `translate.goog` de Google envía `CSP: frame-ancestors *.translate.goog`, así que **no puede incrustarse en el iframe** del Workspace — la traducción inline del QBank sin Companion sigue siendo imposible por seguridad del navegador.
- **Nueva pista iOS** en el panel del Traductor (solo iPad/iPhone): explica el botón «Pegar» del sistema que muestra Safari al usar «📋 Pegar y traducir», para que el bucle copiar→traducir no dé la impresión de estar roto.
- QA de ventanas estrechas (Split View de iPad): el Workspace se mantiene sin scroll horizontal a 507 px y a 320 px, con el botón «Traductor» accesible.

## v3.2.2 · Atajo a la traducción completa en iPad

- **Nuevo botón «↗» en la barra del QBank** (Workspace, junto a ⌂ y ⤢): abre Medicospira en su propia pestaña del navegador. Ahí sí funciona la traducción de página completa nativa — Safari en iPad: botón **aA → Traducir página**; Chrome: menú **⋮ → Traducir** — porque dentro del iframe cross-origin ningún traductor de página puede entrar (regla de seguridad del navegador, no es un bug de la app).
- El consejo contextual iPad/iPhone del Traductor integrado ahora señala el atajo ↗ directamente.
- Pensado para probar la app en iPad: abrir la app en Safari → Workspace → ↗ para el QBank entero, y el botón «Traductor» / burbuja 🌐 para textos sueltos. Sin extensiones, sin instalar nada.
- Sin cambios de datos, sincronización ni estructura.

## v3.2.0 · Traductor integrado: todos los dispositivos, cero instalaciones

> Pregunta que cierra esta versión: «¿se te ocurre alguna idea para que los traductores funcionen siempre en cualquier dispositivo, automáticamente, sin instalar extensiones? En iPad no funcionan para el iframe». Respuesta: sí — dejar de depender de extensiones para el texto y meter el traductor DENTRO de la app.

### El límite real (y por qué no era un bug)
- Un sitio web **jamás puede modificar el DOM de un iframe de otro dominio** (política de mismo origen del navegador). Por eso el Companion puede traducir Medicospira inline: es una extensión con `all_frames`, el único mecanismo que el navegador permite — pero solo existe en Chrome/Edge de escritorio, y por eso en iPad no hay forma directa.

### Nuevo — Traductor integrado del Workspace (`js/translator.js`)
- **Botón «Traductor»** en la barra del Workspace: panel con área de origen/resultado, **«📋 Pegar y traducir»** (lee el portapapeles con un toque), traducción automática al escribir (debounce 700 ms), **⇄ intercambiar EN→ES / ES→EN** (mueve el resultado al origen y re-traduce), **Copiar** y badge de motor.
- **Cadena de motores con degradación elegante** — si uno falla prueba el siguiente y el badge muestra quién respondió:
  1. **⚡ En el dispositivo** — Chrome Translator API (Chrome/Edge 138+): gratis, offline, privado; con LanguageDetector para auto-detectar idioma.
  2. **🌐 Google** — endpoint público `translate_a` (CORS abierto, detecta idioma solo, textos largos por fragmentos con corte inteligente por frases).
  3. **📦 MyMemory** — respaldo público (≤480 car/petición, también fragmentado).
- **Consejo contextual para iPad/iPhone**: si no hay motor on-device, el panel muestra cómo traducir la página entera con Safari (aA → «Traducir página») y recuerda que el panel funciona siempre. En Android/escritorio sin Companion sugiere el traductor del navegador.
- **Degradación automática del botón «Español»**: si el Companion no responde (iPad, Safari, Firefox, Chrome viejo), el aviso ya no deja al usuario colgado — abre el Traductor integrado y explica el porqué.

### Nuevo — Burbuja de selección en toda la app
- Selecciona texto en **cualquier vista de Dr.Coach!** (notas, Study Board, dossier, evidencias) → aparece una burbuja **🌐 Traducir** anclada a la selección → tarjeta con la traducción, badge de motor, Copiar y «Traducir de nuevo». Esc/clic fuera la cierran; el scroll la retira con elegancia.
- Auto → ES con detección de idioma; tolerante a selección con ratón y con gestos táctiles (selectionchange + pointerup con debounce).

### Técnico
- Nuevo archivo `js/translator.js` (auto-montaje, sin dependencias, API pública `window.DCTranslator.translate/toggleWorkspacePanel`); preferencias de dirección y modo automático persistidas en `localStorage`.
- `sw.js` pre-cachea `./js/translator.js` (offline OK); `check.sh` §1 lo exige como archivo crítico; estilos `.dc-tr-*` con los tokens de diseño existentes y toque ≥32 px.

## v3.1.0 · Recorte estilo Canva y cero imágenes estiradas

> Síntoma que cierra esta versión: «el crop no lo hace como Canva u otra app — estira absurdamente las imágenes, no es funcional». Dos defectos de fondo en el motor del board, no en el botón.

### Corregido
- **Redimensionar estiraba las imágenes (raíz del «estira absurdamente»)**: arrastrar una esquina cambiaba ancho y alto por separado y sin bloqueo — la imagen quedaba deformada para siempre (una 800×400 arrastrada +100/+150 pasaba a razón 1.29). Ahora **la proporción está bloqueada** al estilo Canva: esquina grande = escala uniforme, la imagen NUNCA se deforma (verificado a píxel: 2.000 → 2.000).
- **El crop heredaba y conservaba la deformación**: si el objeto ya estaba estirado, hornear el recorte mantenía la inconsistencia. Ahora el **marco de recorte usa la proporción REAL del archivo original** — entrar a recortar sana los objetos estirados de versiones anteriores, y al confirmar la nueva geometría sale con la proporción exacta de la región (rectAR == regiónAR, verificado 1.857/1.884/1.5).

### Nuevo — Recorte de dos fases como Canva
- **Ves la imagen COMPLETA atenuada** con la ventana de recorte nítida encima (antes el recorte se aplicaba en vivo y perdías la referencia de qué estabas cortando). Nada se mueve ni cambia de escala mientras ajustas: es geométricamente imposible deformar.
- **8 mangos**: 4 esquinas + 4 bordes (antes solo 4 puntos medios), con rejilla de tercios, borde blanco y cursor contextual por dirección.
- **Arrastrar desde dentro mueve la ventana** por la imagen original (tamaño constante), como en Canva.
- **Recuperar lo cortado**: al volver a entrar en recorte puedes EXPANDIR la ventana hacia fuera y recuperar partes que habías eliminado (antes solo con Ctrl+Z).
- **Confirmar/cancelar claro**: Enter, «Listo ✓» o clic fuera de la imagen APLICAN; Esc CANCELA sin tocar nada (y recupera la herramienta que tenías). Doble clic sobre una imagen entra directo al recorte.
- **Al pegar una imagen, la herramienta pasa a Seleccionar**: la imagen llega seleccionada y manipulable al instante (antes seguía «Pen» y arrastrar dibujaba tinta encima de la foto).

### Técnico
- Estado nuevo: cropFrame (marco fijo, proporción del blob) + cropDraft (fracciones del borrador); el bake ocurre una sola vez al confirmar con nw=f.w·(r−l), nh=f.h·(b−t). Un dedo en tablet sigue recortando; dos dedos siguen haciendo zoom/pan; Undo/Redo intactos (1 entrada por sesión de recorte efectiva).
- QA automatizado (12 pruebas, 0 errores de consola): pegado→selección, lock de proporción, doble clic, borde 1:1 con objeto congelado, bake sin estiramiento, re-expansión, Esc, touch de un dedo, recorte con objeto ROTADO 30° (borde exacto 0.0714==0.0714, centro y rotación preservados) y sanado de legados estirados.

## v3.0.6 · El recorte del Study Board funciona de verdad (corta, no estira)

> Síntoma que cierra esta versión: al pegar una imagen en el Study Board y pulsar **Recortar**, arrastrar los bordes no recortaba (y en tablet era directamente imposible). Causas encontradas en el motor del canvas, no en el botón.

### Corregido
- **La matemática del recorte estaba rota**: el borde arrastrado NO seguía al puntero (fórmula de interpolación incorrecta) — el primer arrastre recortaba de casualidad, y a partir de ahí los mangos quedaban "muertos" en los bordes originales y los ajustes saltaban a saltos. Ahora **el borde sigue 1:1 al dedo/ratón** y puedes volver a ajustar el recorte las veces que quieras.
- **La imagen se ESTIRABA al recortar**: la región recortada se dibujaba estirada para llenar el marco original (texto de preguntas deformado — parecía roto). Ahora el recorte es **real, tipo tijeras**: el objeto pasa a ser exactamente la región visible, la imagen jamás se deforma y el resto desaparece del marco (el archivo original se conserva intacto por si quieres deshacer).
- **En tablet/touch era imposible recortar**: un dedo solo estaba reservado para mover el lienzo, así que los mangos de recorte eran inalcanzables. Ahora, **en modo recorte, un dedo arranca los bordes igual que el ratón**; dos dedos siguen haciendo zoom/pan como siempre.
- **Esc cerraba TODO el Study Board** estando en modo recorte. Ahora Esc va por niveles: sale del recorte → quita la selección → y solo entonces cierra el board.

### Mejorado
- **Al pegar una imagen queda seleccionada** al momento: la barra contextual (Recortar / Duplicar / Eliminar…) aparece sola — antes había que adivinar que había que hacer clic primero sobre la imagen.
- **El botón Recortar muestra el estado**: resaltado + «Listo ✓» mientras el modo recorte está activo (en la barra contextual y en la barra de herramientas).
- **Mangos de recorte más grandes y con zona de agarre amplia (26 px)** para que sea cómodo con el dedo en pantallas táctiles.

## v3.0.5 · La cola de subida ya no se queda atascada — y el diagnóstico te dice la verdad

> Síntoma que cierra esta versión: el diagnóstico mostraba **todo en ✓ (config, sesión, tablas, perfil) pero "Cola de subida: ✗ N cambio(s) pendientes"** con "Registros en error: Ninguno", y esos cambios no se subían nunca. ¿Vaciar la cola o buscar el problema? Esta versión hace las dos cosas: arregla las causas reales y añade el botón **"🧹 Vaciar cola de subida"** para los restos viejos, con la prueba que distingue un caso del otro.

### Corregido
- **Una petición colgada congelaba el motor para siempre**: supabase-js no tiene timeout; una única request que no respondía (cambio de red, portátil dormido a mitad de petición) dejaba el motor "ocupado" para siempre → cada push/pull posterior se saltaba EN SILENCIO y la cola jamás se drenaba (el clásico "N pendientes" sin ningún error visible). Ahora **toda llamada de red tiene límite de tiempo** (15 s sesión / 30 s datos) y un **watchdog de 90 s** libera el motor si algo se atasca igualmente.
- **El error quedaba enmascarado como "N cambios pendientes"**: el temporizador interno sobrescribía el estado "⚠ Error de sync" con la etiqueta de pendientes 45 s después de cada fallo. Ahora los estados de error son **persistentes** hasta que una subida/descarga se recupera de verdad — lo que ves en el indicador es la verdad.
- **Éxito parcial reportado como éxito**: si una subida subía 3 filas y fallaban 2, el panel lo mostraba como pendientes sin error. Ahora un éxito parcial se muestra como error con su motivo.
- **Subidas duplicadas en la cola**: "⬆ Subir todo a la nube" re-encolaba TODAS las filas en cada pulsación; pulsarlo dos veces (o a través de versiones) apilaba duplicados que inflaban el contador "Cola de subida". Ahora la cola se **deduplica sola** (una entrada por tabla+fila, siempre con el dato más reciente).
- **El usuario podía quedar "null" para el motor pero "✓" para el diagnóstico**: un evento de autenticación con sesión nula dejaba al motor saltándose todas las subidas en silencio mientras el diagnóstico (que renueva la sesión él mismo) seguía diciendo "Sesión ✓". El motor ahora **auto-recupera la sesión** antes de rendirse.
- Filas locales dañadas (un texto donde va una lista) ya no bloquean la cola para siempre: los campos lista/jsonb se normalizan al subir.

### Añadido
- **🩺 Diagnóstico v2 — "Prueba de escritura"**: la comprobación que faltaba. Las tablas podían leerse ✓ mientras RLS bloqueaba las ESCRITURAS (el síntoma exacto de una base creada con un schema antiguo). Ahora el diagnóstico sube una escritura de prueba inofensiva (re-graba tu propio perfil con su contenido actual) y te muestra el error REAL de Supabase si algo falla — se acabó adivinar.
- **🩺 Diagnóstico v2 — cola forense**: la fila "Cola de subida" ahora desglosa qué hay atascado (attempts ×N, sessions ×N), desde cuándo, cuánto ocupa, si alguna entrada falló antes (con el motivo), si hay duplicados y si hay entradas >400 KB (boards con imágenes muy grandes).
- **Fila "Motor de sync"** en el diagnóstico: estado actual del motor, último error y cuántas operaciones colgadas recuperó el watchdog.
- **Botón "🧹 Vaciar cola de subida"** (Datos): descarta las subidas pendientes SIN tocar tus datos locales. Con confirmación que te avisa: si la prueba de escritura está en ✗, vaciar descartaría progreso real — arregla eso primero.

## v3.0.4 · Endurecimiento del motor de sync (además de lo arreglado en v3.0.3)

> Si después de v3.0.3 el indicador volvía a mostrar "⚠ Error de sync" de vez en cuando (o al abrir la app), esta versión elimina las causas restantes. Verificado contra el esquema real de Supabase: las 48 columnas que la app usa coinciden una a una y las filas de ejemplo pasan la validación — el problema restante estaba en la GESTIÓN de fallos del motor, no en la base de datos.

### Corregido
- **Peticiones con el token caducado tras dormir el dispositivo**: el motor disparaba pull/push con el JWT viejo antes de que supabase-js lo renovara → 401 → "⚠ Error de sync". Ahora **cada pull y push renueva la sesión primero** si falta menos de 60 s para su expiración.
- **Un solo fallo del pull al arrancar dejaba "⚠ Error de sync" pegado toda la sesión**: el reintento solo existía para subidas. Ahora el pull **se reintenta solo (2 veces, 4 s)** y el temporizador de 45 s **vuelve a descargar cada ~2 min** — la etiqueta de error se recupera sola y el progreso guardado en el OTRO dispositivo llega sin recargar la app.
- **"Sesión expirada" ya no se disfraza de "⚠ Sin conexión"**: los fallos de autenticación (JWT caducado, refresh token inválido) tienen su propio estado con color rojo y mensaje accionable, tanto en el indicador como en la fila "Estado" de la vista Datos.
- **El estado de error y su causa ya no son un secreto**: al pasar el ratón por el indicador se ve el mensaje real de Supabase, y la fila "Estado" del panel Cloud Sync muestra el detalle (truncado) en lugar de un "Conectado" plano.
- Subir preferencias sin usuario activo ahora da un mensaje claro en vez de un error críptico de RLS.

### Añadido
- **Fila "Versión de la app"** en el panel Cloud Sync (Datos): confirma de un vistazo que AMBOS dispositivos corren la misma versión — un dispositivo viejo (≤3.0.2) sigue mandando campos que la nube rechaza.
- **Diagnóstico más útil**: la comprobación de "Sesión" muestra la validez restante del token y, si ya caducó, intenta renovarlo ahí mismo y reporta el resultado.

## v3.0.3 · Reparación de Cloud Sync

> Corrige el **"⚠ Error de sync"** que impedía guardar el progreso en la nube y hacer que apareciera en el otro dispositivo. Los datos locales NUNCA estuvieron en riesgo: el fallo era solo al subir.

### Corregido
- **Las subidas fallaban con columnas inexistentes** ("Could not find the 'updatedAt' column"). El sanitizador de `cloud/sync.js` era una lista negra y dejaba escapar el campo camelCase `updatedAt` que la app añade a cada intento editado (y a todo registro descargado y vuelto a subir): Supabase rechazaba la fila y el indicador quedaba en "⚠ Error de sync". Ahora es una **lista blanca**: se construye la fila solo con las columnas que existen en cada tabla de `supabase/schema.sql`, así que ningún campo legacy o futuro puede colarse de nuevo.
- **Los registros que fallaron 3 veces quedaban aparcados para siempre** (dead-letter) — el motivo del "se queda buggeado". Ahora se reincorporan solos a la cola cada vez que abres la app y, además, hay un botón **"♻ Reintentar registros en error"** en la vista Datos.
- **El pull incremental comparaba el reloj de tu dispositivo con el del servidor** (`.gt('updated_at', hora_local)`): con el reloj adelantado unos minutos, los datos recién subidos desde el otro dispositivo se saltaban en silencio — la causa del "en mi otra cuenta no aparece mi progreso". Ahora el pull es siempre completo (barato para 2 usuarios) y **nunca sobrescribe filas con cambios locales pendientes** en la cola.
- **Las preferencias no se subían si la fila de perfil no existía** (cuentas creadas antes de que el trigger existiera): el `UPDATE` afectaba a 0 filas en silencio. Ahora es `UPSERT` y la fila de perfil se auto-crea en la primera subida.
- El diagnóstico ahora distingue **"⚠ Sin conexión"** (no hay internet) de **"⚠ Error de sync"** (Supabase rechazó algo), también en los pulls.

### Añadido
- **🩺 Ejecutar diagnóstico** (vista Datos): comprueba en un clic la configuración, la sesión, el acceso a las tablas con RLS, la existencia de la fila de perfil y el estado de la cola y de los registros en error — sin abrir la consola.
- **Fila "Registros en error"** en el panel de Cloud Sync de la vista Datos, con contador en vivo.

### Cambiado
- **`supabase/schema.sql` reescrito a prueba de balas**: idempotente (seguro para re-ejecutar), con `ADD COLUMN IF NOT EXISTS` para completar instalaciones a medias, y las dos sentencias que pueden chocar con permisos del proyecto (trigger sobre `auth.users` y alta del bucket) envueltas en `DO … EXCEPTION` para que **un fallo parcial no aborte el resto del script**. Incluye backfill de perfiles para usuarios ya existentes y una consulta de verificación al final.

## Sin publicar (herramientas y docs — la app no cambia)

### Añadido
- **`docs/README.md`**: índice de toda la documentación ("¿cómo hago X?" → guía), visible al navegar la carpeta docs/ en GitHub.
- **`docs/ESTRUCTURA.md`** ampliado: diagrama del ritual de publicación (check → release → push → Pages), entradas nuevas en el mapa (instalar en dispositivos, copia de seguridad) y pasos de check.sh integrados en el ritual manual.
- **`scripts/check.sh` §9**: valida que los enlaces relativos del README y de docs/*.md apunten a archivos que existen (15 comprobados ahora; un renombre que rompa una guía se detecta antes de publicar).
- **`docs/INSTALAR-APP.md`**: guía para instalar Dr.Coach! como aplicación (PWA) en iPad/iPhone (Safari), Android (Chrome), Mac y Windows (Chrome/Edge) — pasos, cómo se actualiza una instalada, dónde viven los datos por dispositivo y tabla de problemas frecuentes.
- **Tarjeta social del repo** (`docs/img/social-preview.png`, 1280×640): imagen de marca con logo, funciones y captura real de la app, lista para subir en Settings → Social preview (pasos en `docs/GITHUB-PAGES.md` § 6).
- **`.github/`**: plantillas de issues (bug e idea) y de pull request, en español y adaptadas a la app (piden el chip de versión, la vista afectada, errores de consola y el estado de la base de datos; recuerdan exportar el progreso antes de tocar nada y no pegar credenciales).
- **`scripts/backup.sh`**: copia de seguridad en un comando — ZIP del proyecto tal cual está (incluye tu `config/supabase.config.js`: es copia local, no subirla a GitHub) + bundle del historial git completo (restaurable con `git clone archivo.bundle`). Conserva las 8 más recientes. `bash scripts/backup.sh [carpeta]`.
- **Capturas del proyecto** en `docs/img/` (escritorio, móvil y acceso) mostradas en el README con texto alternativo descriptivo.
- **`scripts/check.sh`**: chequeo pre-publicación en un comando — estructura crítica, secretos fuera de git, consistencia de versiones (APP_VERSION ↔ CACHE del SW ↔ insignia del README), rutas rotas en `index.html` **y `404.html`**, estado de git, permisos, **recursos offline** (las 10 URLs que cachea el Service Worker y los iconos del manifest existen en disco) y **PWA instalable** (campos mínimos del manifest e iconos 192/512). `bash scripts/check.sh` antes de cada push.
- **`docs/BD-MANTENIMIENTO.md`**: runbook de base de datos — mapa de la IndexedDB local (`mediospira-db`), cómo inspeccionarla con DevTools, tabla síntoma → causa → arreglo, backups export/import y ritual para corregir bugs de datos locales y de nube.
- **`docs/GITHUB-ACTIONS-PAGES.md`**: guía OPCIONAL para deploy automático con GitHub Actions (workflow YAML listo para copiar; por defecto se sigue usando "Deploy from a branch").

### Mejorado
- **`404.html`** pulida: animación de entrada, logo flotante, barra de progreso del cuenta atrás, foco visible para teclado, flecha animada en el botón, nota de tranquilidad ("tu progreso está a salvo") y respeto a `prefers-reduced-motion`.
- **`scripts/release.sh`** más seguro y multiplataforma: rechaza publicar con cambios sin confirmar (con instrucciones), rechaza tags duplicados, verifica que el bump realmente se aplicó (y revierte si falla) y solo sube `js/app.js`/`sw.js` (+README si cambia la insignia) al commit de release. **Corrige un bug de compatibilidad**: ya no usa `sed -i` (fallaba en macOS/BSD); edita vía archivo temporal, así que funciona igual en Mac y Linux. Además actualiza automáticamente la insignia de versión del README.
- **README.md** renovado: insignias de versión/PWA, sección de capturas, `backup.sh` y `.github/` en el árbol de estructura, y fila de backup en la tabla de mantenimiento.

## v3.0.2 · Fiabilidad de la nube + página 404

### Corregido
- **Service Worker ya no cachea respuestas de APIs externas** (Supabase REST/Auth/Storage, Piped/Invidious, Jina). Antes, cualquier GET exitoso se guardaba en caché y podía devolverse luego: los *pulls* de Cloud Sync podían traer datos obsoletos al sincronizar entre dispositivos y las búsquedas de música podían servir resultados viejos. Ahora el SW solo atiende peticiones de la propia app; las APIs van siempre a la red frescas. (El cache de búsquedas de música que describe el README es el de `localStorage`, gestionado por la app — no cambia.)

### Añadido
- **`404.html`** con la marca Dr.Coach!: GitHub Pages la muestra automáticamente en rutas inexistentes y redirige al inicio en 5 s (también con botón directo). Soporta modo claro/oscuro.
- **Diagrama de arquitectura** (Mermaid) en `docs/ESTRUCTURA.md`: se ve el flujo `index.html → js/ → IndexedDB` y el espejo opcional `cloud/ → Supabase`.

## v3.0.1 · Reorganización del proyecto (mantenimiento)

Cambios **solo de estructura**; la app funciona exactamente igual (mismo IndexedDB, mismo progreso, misma nube).

- Archivos agrupados por carpeta para facilitar el mantenimiento:
  - `css/` → estilos (`styles.css`)
  - `js/` → lógica (`db.js` base de datos local, `app.js` app, `zip.js` backups)
  - `assets/img/` y `assets/icons/` → logo, emblema e iconos PWA
  - `config/` → credenciales Supabase (`supabase.config.js` NO se sube a GitHub)
  - `supabase/` → SQL de la base de datos en la nube (`schema.sql`)
  - `companions/` → extensión de navegador y userscript móvil
  - `scripts/` → servidor local (`serve.py`) y launcher de macOS
  - `docs/` → guías (CHANGELOG, INSTALL-CLOUD, DISTRIBUCION, ESTRUCTURA)
- `index.html`, `manifest.webmanifest` y `sw.js` siguen en la raíz (requisito del Service Worker).
- Rutas actualizadas en `index.html`, `sw.js`, `manifest.webmanifest` y `cloud/auth.js`.
- Caché del Service Worker renovada: `drcoach-v3.0.1-reorg` (haz una recarga forzada tras desplegar).
- Nuevo `docs/ESTRUCTURA.md` con el mapa "¿dónde toco qué?".
- Sin cambios en base de datos, schema SQL ni comportamiento.

## v3.0.0 · Cloud Sync

## Resumen

v3.0.0 introduce **Local-first + Cloud Sync** sin sacrificar el modo offline.

- **Auth con Supabase** (2 usuarios, sin registro público). Login en el mismo HTML.
- **Sincronización**: Pull al abrir · Push al guardar (pregunta/sesión/board/edit/review) · Background cada 45 s si hay cambios pendientes.
- **Indicador visual** de estado: ☁ Guardado · ☁ Sincronizando… · ☁ N cambios pendientes · ⚠ Sin conexión · 💾 Solo local.
- **Supabase Storage** para capturas del Study Board con path `study-evidence/{user_id}/{attempt_id}/{image_id}.webp`.
- **Backup/Restore** preservado; al importar, los datos también se empujan a la nube.
- **Multi-dispositivo**: Lenovo Pad → iPad → PC mantienen el mismo progreso cuando se inicia sesión con la misma cuenta.
- **Preferencias locales**: Radio · Música · Volumen · Estado del reproductor no se sincronizan (son del dispositivo).

## Restricciones respetadas

- ✅ Medicospira no se modificó.
- ✅ Tampermonkey / Companion no se tocaron.
- ✅ Copy/paste en QBank sigue igual.
- ✅ Sistema de preguntas y UI v2.6.7 intactos.
- ✅ Funciona 100 % offline; sin config de Supabase, abre en modo local.
- ✅ IndexedDB sigue siendo la fuente de verdad local; Cloud es secundario.

## Arquitectura

```
                Dr.Coach!
                    |
       ---------------------------
       |                         |
   IndexedDB                  Supabase
    LOCAL                      CLOUD
       |                         |
       -------- Sincronización -----

  auth.js  ──── Login overlay ──── Supabase Auth (2 usuarios)
  sync.js  ──── Pull/Push/Background ──── Supabase Postgres
  storage.js ── Upload/download ──── Supabase Storage
  sync-indicator.js ─── Visual feedback en #saveState
  supabase-client.js ── Carga dinámica + fallback offline
```

## Instalación

Ver **`INSTALL-CLOUD.md`** para el setup completo de Supabase (schema SQL + 2 usuarios + bucket).

## Migración desde v2.6.7

La actualización es automática:

1. Sustituye los archivos de la versión anterior en tu hosting (GitHub Pages, servidor local, etc.).
2. Copia `config/supabase.config.example.js` → `config/supabase.config.js` y rellena URL + anon key.
3. Ejecuta `supabase/schema.sql` en tu proyecto de Supabase.
4. Crea los 2 usuarios en Dashboard → Authentication → Users.
5. Recarga Dr.Coach!. Verás el overlay de login. El progreso local existente se mantiene.

Sin config de Supabase, Dr.Coach! sigue funcionando en modo local como en v2.6.7.
