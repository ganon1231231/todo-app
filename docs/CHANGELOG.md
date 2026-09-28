# Dr.Coach! — Registro de cambios

## v3.4.2 · Userscript v0.5.4: RESTAURACIÓN del motor v0.5.0 (la era que traducía todo y rápido) + píldora discreta arrastrable

- **Reporte real del usuario**: «¿de qué me sirve la pastilla (que está horrible, interfiriendo con mi UI, no me gusta) si al final no funciona nada. No traduce. Después de lo del Study Board con paleta de colores y el sync, todo se jodió. Podía traducir TODO y rápido y ahora no puedo nada. Soluciónalo».
- **Investigación con el historial git completo**: la era dorada del usuario es exactamente **v3.3.6 / userscript v0.5.0**. En la v3.3.7 (Study Board + sync) el traductor quedó intocado — pero después, en la **v0.5.1, se reordenó el motor** basándose en un diagnóstico de nuestro sandbox (Google bloqueando gtx): se puso clients5 primero en lotes y por-texto y se añadieron penalizaciones por racha de parse + split-retry. Ese reorden — no el Study Board ni el sync — es el sospechoso de romper la traducción en el dispositivo real, donde el orden v0.5.0 funcionaba de maravilla.
- **Fix #1 — motor restaurado a v0.5.0 verbatim**: en lotes, **Google gtx PRIMERO** y clients5 de respaldo (con circuit breaker 429 de 60 s, igual que entonces); por texto, gtx primero con reintento, luego clients5 → MyMemory → Bing. Fuera: penalizaciones por racha de parse (v0.5.1), split-retry (v0.5.2). Se conservan mejoras que no tocan el orden: progreso REAL en la píldora (v0.5.2), reintento automático al expirar el circuit breaker, caché persistente, watchdog de arranque y anti-spoof del handshake (v0.5.3).
- **Fix #2 — la píldora de la página Dr.Coach! deja de estorbar**: la píldora permanente con texto de la v0.5.3 («horrible, interfiriendo con mi UI») se convierte en un **punto de 16 px semitransparente** (opacidad 0.42; sube al tocar/hover): **toca = panel de estado** (igual que antes), **mantén y arrastra = se mueve a cualquier esquina y recuerda la posición** (localStorage/GM). Verde = QBank conectado, ámbar pulsante = sin responder, gris = idle. Solo cuando hay un problema se hace notar.
- **Aclaración honesta sobre el sync/Study Board**: esos cambios (v3.3.7) tocan datos de sesiones y el lienzo, y no comparten ninguna línea de código con el traductor; la correlación temporal vino de que el reorden del motor se publicó justo después. Queda verificado con git: `v3.3.7 — traductor intocado (userscript 0.5.0)`.
- **App**: APP_VERSION **3.4.2**, SW `drcoach-3.4.2-release`, `COMPANION_VERSION` esperada **0.5.4**.
- **QA**: `node --check` OK · harness Medicospira: píldora «DC · Español» → clic → DOM traducido con el orden gtx-first (fetch espiado: primera petición a translate.googleapis.com) ✓ · harness Dr.Coach!: punto de 16 px presente sin texto ✓, toque → panel ✓, arrastre → posición cambia y persiste ✓, iframe con READY real → punto verde ✓, 0 errores de página ✓.

## v3.4.0 · Userscript v0.5.3: centro de control en la página de Dr.Coach! — «QBank sin respuesta» deja de ser invisible

- **Reporte real del usuario**: «Y nuevamente no funcionó. ¿Qué hiciste esa vez que sí funcionó en Safari? Revisa nuestro chat» + las respuestas al diagnóstico remoto de 3 puntos: (1) el aviso **SÍ aparece** en la página de Dr.Coach!, (2) la píldora **DC NO aparece** dentro del QBank, (3) abre Dr.Coach **en Safari como website** (no desde la PWA de pantalla de inicio).
- **Diagnóstico confirmado por esas 3 respuestas**: el gestor SÍ ejecuta el script en la página superior de Dr.Coach! (por eso el aviso aparece) pero **NO lo inyecta DENTRO del iframe de Medicospira** (por eso ni píldora ni traducción). Sin inyección en el subframe no hay código nuestro corriendo ahí: es un estado del dispositivo (permiso de la extensión revertido a «Preguntar» — que en iframes nunca pregunta — o gestor sin inyección en subframes), no un bug del motor (el v0.5.2 está verificado end-to-end en producción con contador real y split-retry).
- **Lo que hacía que funcionara la vez anterior** (reconstrucción del chat, Tasks 30-41): app Userscripts con permiso «Todos los sitios web → Permitir» + script instalado por URL + Dr.Coach abierto dentro de Safari + auto-update a 0.5.0/0.5.2. Hoy falta exactamente esa pieza de permiso/inyección dentro del QBank.
- **Fix — centro de control (userscript v0.5.3)**: el badge efímero de 5 s se sustituye por una **píldora PERMANENTE** («DC · vX», abajo a la izquierda, safe-area) con el **estado del QBank en vivo** (refresco 2 s): verde «DC · QBank v0.5.3 ✓» (conectado — lee la versión real del handshake), ámbar **«DC · QBank sin responder»** (iframe en pantalla sin señal durante 15 s) e «idle» fuera del Workspace. El fallo de inyección, que antes era 100 % silencioso, ahora se ve siempre.
- **Panel de soluciones (tocar la píldora)**: estado fila a fila + **arreglo de 1 toque «↗ Abrir QBank en pestaña propia»** — abre el src real del iframe (la misma pregunta de Medicospira) como página principal, donde el gestor SÍ inyecta y la píldora DC traduce con el motor por lotes + pasos exactos del permiso («Todos los sitios web: Permitir», cerrar Safari del todo) + **«Copiar informe»** con versión del script, versión del Companion del QBank, URL, src del iframe y frescura de la señal para diagnóstico remoto definitivo.
- **Extras**: pulsar «Español» sin respuesta del QBank ahora abre ESTE panel (sustituye al banner estático antiguo); las señales del QBank solo se aceptan del iframe real (`ev.source === frame.contentWindow` — un fake READY desde otra ventana no puede fingir «conectado», verificado); `window.__dcMobileProbe` ampliado (lastSignalAt, qbankCompanionVersion, state).
- **App**: `COMPANION_VERSION` esperada pasa a **0.5.3** (tarjeta de actualización si el iPad sigue con la vieja). APP_VERSION 3.4.0, SW `drcoach-3.4.0-release`.
- **QA (agent-browser, harness con las ramas forzadas)**: píldora top «DC · v0.5.3» idle ✓; panel automático al pulsar «Español» sin QBank (fila «no está en pantalla») ✓; frame silencioso → ámbar «DC · QBank sin responder» ✓; panel con «↗ Abrir QBank en pestaña propia» → `window.open` capturado con el src EXACTO del iframe ✓; frame con companion real (postMessage desde el iframe) → verde «DC · QBank v0.5.3 ✓» + versión capturada ✓; READY falsificado desde la ventana padre RECHAZADO ✓; «Copiar informe» ✓ (en headless sin portapapeles muestra su fallback); rama Medicospira intacta: píldora «DC · Español» → clic → DOM traducido («Chest pain»→«Dolor en el pecho») con el motor por lotes ✓; traza de arranque `[DrCoach Companion] v0.5.3 boot → …` ✓; 0 errores de página en toda la sesión ✓.

## v3.3.9 · Userscript v0.5.2: progreso REAL en la píldora + lotes auto-reparables (split-retry) + watchdog de arranque

- **Reporte real del usuario**: «¿qué rayos pasó? ahora tampoco hace la traducción… no detecta el nuevo script y tampoco funciona. Soluciónalo como cuando funcionaba y traducía súper rápido».
- **Diagnóstico con navegador real + harness instrumentado** (fetch espiado, `console.debug` interceptado, caché limpiada y escenarios repetidos):
  - El motor **SÍ traducía** — pero el contador de la píldora estaba **roto desde v0.5.0**: `done` nunca se incrementa en ninguna de las dos fases ⇒ la píldora mostraba **«DC · 0/332» congelado durante TODA la traducción** y saltaba a «DC · Original» al final. El usuario ve «0/332» quieto y concluye, con toda razón, que «no está traduciendo».
  - **Fallo intermitente de lotes capturado en vivo**: en una de las corridas, los 14 lotes multi-q a clients5 recibieron HTTP 200 (y al re-petir la URL exacta por curl la respuesta era perfecta), pero **todos fallaron dentro del script** y los ~333 textos cayeron en bloque a la cascada lenta por-texto (~15 s en vez de ~2 s). En otras corridas los mismos lotes pasaban sin problema. Fallo del edge de Google imposible de reproducir a demanda ⇒ hay que auto-repararlo en el cliente.
  - Estado de los endpoints (validado con curl): **gtx sigue bloqueado** («Sorry…» HTML), **clients5 multi-q perfecto** (25 textos en ~100 ms, incluso con CORS desde navegador plano), MyMemory OK.
- **Fix #1 — progreso real (v0.5.2)**: `done++` por texto en la fase de lotes (éxitos y en el rescate del split-retry) y en la fase individual (cuenta también fallos, para que el contador llegue siempre al total) ⇒ la píldora ahora muestra **«DC · 13/82 → 30/84 → …»** avanzando en vivo. Verificado en harness: `0/84 → 30/84 → Original` con 84 textos y 0 fallos de lote.
- **Fix #2 — split-retry (lotes auto-reparables)**: si un lote completo falla (salvo 429, que manda al circuit breaker), se **parte por la mitad y cada mitad se reintenta** recursivamente hasta aislarse el subconjunto que de verdad falla; lo rescatado se cachea y se aplica, y solo los irrecuperables van a la cascada individual. **Verificado forzando HTTP 500 en todos los lotes ≥10 textos**: la página quedó traducida igual («Término médico Dolor en el pecho») con el contador avanzando — antes ese escenario dejaba 84 textos traduciéndose uno a uno.
- **Fix #3 — watchdog de arranque**: si a los 4 s la píldora no existe en el DOM (arranque colgado a medias / excepción temprana), se crea igualmente; `bootMedicospira` queda envuelto en try/catch y el arranque deja traza en consola (`[DrCoach Companion] v0.5.2 boot → medicospira`) para diagnóstico remoto.
- **App**: `APP_VERSION` **3.3.9**, SW `drcoach-3.3.9-release`, `COMPANION_VERSION` esperada **0.5.2** (tarjeta de actualización si el iPad sigue con la vieja).
- **QA**: `node --check` OK · harness 84 textos: traducción completa, contador real, toggle bidireccional y auto-boot por caché instantáneo ✓ · harness saboteado (500 en lotes grandes): traducción completa vía split-retry ✓.

## v3.3.8 · Userscript v0.5.1: el traductor vuelve a traducir (Google bloquea gtx) + diagnóstico desde el iPad

- **Reporte real del usuario**: «ya no funciona el traductor en Safari. Sí lo detecta el script pero no está traduciendo».
- **Causa raíz — Google endureció el bloqueo anti-abuso**: el endpoint clásico `translate.googleapis.com/translate_a/single?client=gtx` responde con **HTTP 200 + HTML «Sorry…»** (página de bloqueo) en muchas IPs — lo que rompe el `JSON.parse` pero **no dispara el circuit breaker del 429**, así que la v0.5.0 gastaba 2-4 peticiones muertas por lote contra gtx y degradaba al respaldo cada vez. Validación en vivo: gtx bloqueado (curl), `clients5.google.com/translate_a/t?client=dict-chrome-ex` multi-q **funcionando** (última vía de lotes viva), MyMemory OK, Bing OK.
- **Fix #1 — clients5 primero**: la cascada de lotes y la por-texto ahora prueban **clients5 (dict-chrome-ex) antes que gtx** (lotes: `dict → gtx`; textos: `google-alt → mymemory → bing → google`). Menos peticiones, menos latencia, y el proveedor sano atiende primero.
- **Fix #2 — penalty por HTML de bloqueo**: los fallos de parse (`google-parse` / `dict-parse` / `dict-batch-incomplete`) cuentan racha por proveedor; a los 2 seguidos se penaliza **60 s igual que un 429** → un host cerrado por Google deja de martillarse en cada lote.
- **Fix #3 — reintento automático tras rate-limit**: si una pasada acaba con fallos de red, el motor **reintenta solo** cuando el circuit breaker expira (~60 s); ya no hay que re-tocar la píldora ni recargar la pregunta.
- **Fix #4 — MyMemory por trozos**: los textos largos ya no se recortaban a 480 caracteres: se dividen por frases/espacios en piezas seguras y se concatenan; y detecta `quotaFinished` (cuota agotada) con un error claro. Bing: parse de `params_AbusePreventionHelper` tolerante a comillas simples.
- **DIAGNÓSTICO DESDE EL iPAD — pulsación larga (0,7 s) en la píldora DC**: abre un panel que prueba **en vivo las 4 vías** (clients5 lotes, gtx lotes, MyMemory, Bing) con ✅/❌, latencia y motivo de cada fallo, y un botón **«Copiar resultado»** para pegar el informe en el chat. El toque corto sigue alternando Español/Original (el long-press no altera el idioma). El toast de error ahora remite al long-press, y la píldora muestra la causa del último error en su title.
- **App**: `COMPANION_VERSION` esperada pasa a **0.5.1** (tarjeta «Instalar v0.5.1» si el iPad sigue con la vieja).
- **QA (navegador real, harness con usuarioscript inyectado)**: traducción completa EN→ES con el motor nuevo («Un hombre de 68 años presenta dolor en el pecho…») ✓; toggle bidireccional ✓; long-press → panel con results reales (clients5 ✅ 450 ms · gtx ✅ 1.6 s · MyMemory ✅ 1.7 s · Bing ❌ «red bloqueada» sin gestor, esperado) ✓; el long-press no alterna idioma ✓; `node --check` OK ✓.

## v3.3.7 · Study Board Canva (colores + texto en caja) + fin del «limbo» de sync + retrato sin solapes + UI más limpia

- **Reporte real del usuario**: «en posición vertical algunas cosas se sobreponen»; «en el Study Board quiero cambiar de colores para mis apuntes y que el texto sea en forma de box, como Canva»; «revisa la UI, hay redundancias y mucho texto generado por IA»; «en Datos, un bloque en curso queda en un limbo hasta terminar la sesión (parece error de sync)». Encargo explícito: no tocar la lógica del traductor.
- **Study Board — paleta de color (v3.3.7)**: nueva barra de 6 colores (tinta, rojo, verde, naranja, morado, azul) + selector personalizado (rueda de color del sistema). El color aplica a lápiz, resaltador y texto nuevo; con una selección activa, tocar un color **recolorea** el texto/trazos seleccionados (estilo Canva). El resaltador toma el color elegido con su transparencia (30 %). Color recordado entre sesiones (localStorage).
- **Study Board — texto estilo Canva**: adiós al `prompt()`. Herramienta Texto = **caja editable en el lienzo**: aparece en el punto tocado, escribes directamente (textarea superpuesto con la misma fuente/peso), la caja crece con el contenido, se confirma con clic fuera / Esc / cambiar de herramienta, y una caja vacía se elimina sola. Doble toque reedita cualquier texto. El texto se dibuja ahora en semibold (600) coherente con el editor.
- **Fin del «limbo» de sync (Datos)**: la sesión ahora se sube a la nube **tras CADA respuesta** (`pushSession` en `saveCurrentQuestion`), no solo al iniciar/pausar/terminar → en la nube se ve el progreso N/M en vivo. Además todas las escrituras de sesión estampan `updatedAt`, que el merge de pull ya comparaba pero que las sesiones nunca tuvieron → **el pull ya no puede pisar la copia local fresca con la copia vieja 0/N** (causa real del limbo tras recargar a mitad de bloque).
- **Estado de sync en vivo**: la fila «Estado» de Datos y el chip superior reaccionan al evento `drcoach:sync-status` (throttle 300 ms) en vez de refrescarse solo al entrar a la vista → ya no parece «congelado en error» durante un bloque.
- **Métricas honestas**: el tile «Tiempo» de Hoy y la «Velocidad media» de Analytics leían `durationSec`, campo que **nunca se escribía** (siempre 0/«—») → ahora usan `elapsedSec`, el real. El tile «Bloques» muestra «+1 en curso» cuando hay un bloque activo hoy (deja de parecer que ese bloque no existe).
- **Retrato iPad (721-900 px) anti-solape**: nueva banda de media queries — title-row y actions con wrap, filtros Historial a 2 columnas, padding de contenido reducido, topbar compactada (marca más corta, chip de sync con elipsis, radio-bar del Workspace sin mínimos que desbordan, dock flotante más estrecho), hint del frame recortado, barra contextual del board anclada abajo.
- **UI más limpia (texto)**: frase del día ya no se duplica (topbar = saludo por hora; la frase queda solo en Hoy); microcopys de board/dossier/instalación/ZIP/Focus acortados ~40-60 %; confirms de ID duplicado y de vaciar cola reducidos a lo esencial; toast de recorte a una línea. **Cero cambios funcionales** en traductor (userscript sigue v0.5.0), guardado, review, cobertura o export.

## v3.3.6 · Userscript v0.5.0 «motor por lotes»: traducción ~10× más rápida + caché persistente + progreso visible

- **Reporte real**: «el script de Safari sí logró traducir, sin embargo es extremadamente lento. Demora demasiado traduciendo y no es conectividad».
- **Causa raíz — rendimiento**: el motor v0.4.x hacía **una petición HTTP POR CADA nodo de texto** (una página del QBank = 100-300 nodos → 100-300 peticiones, solo 4 en paralelo ⇒ 15-50 s). Encima, Google gtx tenía **2 reintentos con esperas de 500 ms+1000 ms por nodo**, y **sin memoria de proveedor**: aunque el plan B funcionase, cada nodo volvía a empezar por gtx y pagaba la cascada completa una y otra vez.
- **Motor por lotes (batching)**: técnica de los traductores profesionales — agrupar **~25 textos por petición**. Validado en vivo: `clients5.google.com/translate_a/t?client=dict-chrome-ex` acepta **múltiples `q=`** y devuelve una entrada por texto **en orden** (mapeo nativo 1:1, sin delimitadores); 25 textos en **0,58 s**. Cascada de lotes: **clients5 multi-q → gtx con delimitador `@@@`** (los símbolos sobreviven; textos que lo contienen van individuales) → respaldo por-texto clásico (gtx → clients5 → MyMemory → Bing) solo para los rezagados.
- **Resultados**: ~200 nodos pasan de 15-50 s a **2-4 s** (~10× más rápido); dedupe de textos repetidos (1 texto = 1 traducción compartida por todos sus nodos); render **progresivo** (el texto aparece lote a lote, no al final).
- **Circuit breaker (429-proof)**: si un proveedor responde HTTP 429 se esquiva **60 s** (`gtxPenaltyUntil`/`dictPenaltyUntil`) en lugar de pagar sus reintentos en cada texto; el orden de la cascada se reordena dinámicamente. Reintentos reducidos 2→1 con backoff corto (350 ms).
- **Caché persistente**: las traducciones se guardan en el almacenamiento del gestor (`GM.setValue`, con fallback localStorage) **capadas a 400 entradas** y guardado diferido (3 s / al ocultar la pestaña) → **revisitar una pregunta ya traducida es instantáneo**, incluso tras recargar la página.
- **Progreso visible**: mientras traduce, la píldora muestra **«DC · 34/120»** (contador de textos) y vuelve a «DC · Original» al terminar; la app recibe `postStatus('translating', {done,total})` con el progreso.
- **App**: `COMPANION_VERSION` esperada pasa a **0.5.0** (la detección de Companion obsoleto avisa si sigue instalada una versión vieja).

## v3.3.5 · Userscript v0.4.2 «Orion-proof»: la traducción ya no depende de GM_xmlhttpRequest + detección de Companion obsoleto

- **Reporte real (capturas de Orion/iPad)**: el popup de Tampermonkey lista «Copy + Translate **0.3.0**» (18 KB) y muestra **«Tampermonkey has no access to this page»**; la píldora/detección aparece pero **la traducción no ocurre**.
- **Causa raíz #1 — script desactualizado**: en Orion la **auto-actualización de scripts está rota** (el propio banner naranja de Orion lo advierte: «Limited runtime host permissions might break some Tampermonkey features like *script update*, GM_xmlhttpRequest and others!»). El usuario seguía con v0.3.0, que además solo matcheaba Medicospira. Ahora la **app detecta el Companion obsoleto** por el handshake (`translator: drcoach-mobile-v0.3.0`) y muestra la tarjeta **«⚠ Companion v0.3.0 detectado (la app espera v0.4.2)»** con enlace directo **«Instalar v0.4.2»** + pasos (borrar el viejo, reinstalar por URL, permiso «Permitir siempre»).
- **Causa raíz #2 — red**: `gmRequest()` intentaba PRIMERO `GM_xmlhttpRequest` y solo usaba `fetch` si la API GM no existía. En Orion la API GM **existe pero está rota** por los permisos limitados → la traducción moría sin mensaje. **Fix (userscript v0.4.2)**: nuevo `netRequest()` que hace **`fetch` directo (CORS) primero** — Google gtx permite CORS, así que funciona en Orion aunque GM_xmlhttpRequest esté roto — y deja GM como respaldo **en carrera con timeout duro (8 s)** para que un gestor colgado no bloquee la cascada.
- **Cascada de motores más resistente**: Google gtx (2 reintentos) → **Google alternativo** `clients5.google.com` (dict-chrome-ex) → **MyMemory** (CORS) → Bing (vía GM). Errores traducidos a causas entendibles (`describeNetError`): «el gestor no respondió (Orion: reinstala y da permiso)», «tiempo agotado», «HTTP 429», «red bloqueada por el navegador».
- **Fallo visible, nunca silencioso**: si fallan nodos al traducir, la píldora DC muestra su **punto en rojo**, aparece el aviso **«⚠ La traducción falló — <motivo>»** (12 s, tocable) dentro del QBank y la app recibe `postStatus('error')` → toast «No se pudo traducir: …».
- **Docs**: IPAD-SAFARI.md con nueva sección **«Orion: «Tampermonkey has no access to this page» + script viejo (0.3.x)»** (permiso por sitio para github.io y medicospira.com + reinstalación manual paso a paso), señales de vida actualizadas a v0.4.2, causas #9 del troubleshooting; README del userscript con la cascada y las advertencias de Orion.

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
