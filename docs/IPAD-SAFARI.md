# Dr.Coach! en iPad con Safari — userscripts estilo Tampermonkey

**Sí, se puede.** Safari en iPadOS no admite Tampermonkey directamente, pero hay tres formas de ejecutar userscripts que dejan el flujo igual al de tu PC/Mac: el botón **«Español / Original»** del Workspace traduce el QBank dentro del iframe, y al seleccionar texto aparece la barrita **«Copiar / → Stem»**.

El userscript es el mismo para todos los casos: [`companions/mobile-userscript/DrCoach-Mobile-Companion.user.js`](https://ganon1231231.github.io/todo-app/companions/mobile-userscript/DrCoach-Mobile-Companion.user.js) (v0.5.4, multi-gestor, motor v0.5.0 restaurado + punto de estado discreto y arrastrable en la página de Dr.Coach!).

---

## La píldora DC NO aparece dentro del QBank (pero sí el aviso en la página de Dr.Coach!)

Este es el caso «el badge aparece, la píldora no». Qué significa cada señal:

- **En la página de Dr.Coach! hay un **punto discreto «DC» (16 px, abajo a la izquierda)** — v0.5.4: semi-transparente, se toca para abrir el panel de estado y se mantiene pulsado para arrastrarlo a otra esquina (recuerda la posición). Que exista = el gestor SÍ ejecuta el script en esa página.
- **Dentro del QBank (Workspace) NO aparece «DC · Español»** = el gestor NO está inyectando el script DENTRO del iframe de Medicospira. Ahí no hay código nuestro que pueda arreglarse a sí mismo: si no se inyecta, no existe. Es un estado del dispositivo (permiso de la extensión en «Preguntar»/revertido, o el gestor no inyecta en subframes) — el síntoma clásico tras una actualización de iPadOS o de la app del gestor.

La píldora de la página de Dr.Coach! muestra el estado del QBank en vivo:

- **«DC · v0.5.4»** (punto verde) — inyección viva; sin QBank en pantalla todavía.
- **«DC · QBank v0.5.4 ✓»** (punto verde) — el Companion dentro del QBank responde: todo conectado, el botón «Español» del Workspace funciona.
- **«DC · QBank sin responder»** (punto ámbar) — el QBank está en pantalla pero no llega señal: el gestor no inyecta dentro del iframe. **Tócala** y el panel te da el arreglo:

  1. **Arreglo inmediato (1 toque, siempre funciona)**: **«↗ Abrir QBank en pestaña propia»** — abre la MISMA página de Medicospira como pestaña principal, donde el gestor SÍ inyecta; busca la píldora DC abajo a la derecha y tócala para traducir.
  2. **Arreglo definitivo (restaura el modo integrado en el Workspace)**: Ajustes → Safari → Extensiones → tu gestor → **«Todos los sitios web» → Permitir** (NO «Preguntar»: dentro de los iframes nunca aparece la pregunta) → cierra Safari por completo (desliza fuera) y vuelve a abrir.

  El panel también tiene **«Copiar informe»** (versión del script, versión del Companion del QBank, URL, src del iframe y frescura de la señal): pégalo en el chat para diagnóstico exacto.

## Si la píldora aparece pero NO traduce: diagnóstico en 10 segundos

**Mantén pulsada la píldora DC (0,7 s)** — se abre un panel que prueba en vivo los 4 motores de traducción (Google clients5, Google gtx, MyMemory, Bing) y muestra ✅/❌ con latencia y motivo:

- **Todo ✅ menos Bing** → normal (Bing necesita gestor con GM.xmlHttpRequest); el resto traduce.
- **❌ en Google gtx con «HTTP 200» o «google-parse»** → Google bloqueó tu IP contra el endpoint clásico; desde v0.5.1 el script usa clients5 primero y funciona igual.
- **❌ en clients5 Y gtx** → Google bloqueó ambas vías para tu IP: usa «Copiar resultado», pégame el informe en el chat y añadimos una vía nueva.
- **❌ MyMemory «cuota agotada»** → límite diario del servicio alcanzado; el motor ya reintenta solo al renovarse.
- El toque corto sigue alternando Español/Original; el long-press solo abre el diagnóstico.

**Nota v0.5.2**: mientras traduce, la píldora muestra el progreso real contando hacia arriba («DC · 13/82»); con la v0.5.1 o anterior el contador se quedaba clavado en «0/N» hasta terminar — si ves el número moverse, está traduciendo aunque la página tarde unos segundos en repintar. Y si un lote falla, ahora se parte y se reintenta solo (split-retry), así que un bloqueo puntual de Google ya no hace que toda la página caiga al modo lento.

## Reinstalación limpia en Safari (cuando la app Userscripts no toma la actualización)

Si actualizaste y la píldora sigue mostrando la versión vieja (o el script «no se detecta»):

1. Abre la app **Userscripts** → pestaña de scripts instalados → **borra** «Dr.Coach! Mobile Companion» (desliza / botón borrar).
2. Cierra la pestaña de Dr.Coach!/Medicospira en Safari (para descargar la pestaña con el script viejo en memoria).
3. Abre en Safari el enlace de instalación de arriba → la app ofrece **instalar de nuevo** → acepta y comprueba que dice **v0.5.4**.
4. Ajustes → Safari → Extensiones → Userscripts sigue en **«Todos los sitios web» → Permitir**.
5. Recarga la página 1-2 veces → dentro del QBank debe aparecer la píldora **«DC · Español»**.

En **Orion** la auto-actualización sigue rota: borrar y reinstalar por URL es siempre el camino.

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

> ⚠️ **Importante**: usa Dr.Coach **dentro de Safari**. El icono de «pantalla de inicio» (PWA instalada) es cómodo para estudiar, pero **iPadOS nunca ejecuta extensiones en las web-apps instaladas** → ahí los userscripts no funcionan y no habrá traducción. Para traducir: Safari siempre.

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

### Orion dice «Some URLs are restricted…»

Si Tampermonkey muestra algo como *«Some URLs are restricted by your browser or an extension»* y ningún script se ejecuta, es un problema conocido de **Tampermonkey 5.5.x** (le pasa también en otros navegadores), no de tu script ni de Orion. Dos soluciones, prueba primero la 1:

1. **Page Filter Mode → Blacklist**:
   - Toca el icono de Tampermonkey → **Dashboard** → pestaña **Settings**.
   - En *Config mode* elige **Advanced** (para ver todas las opciones).
   - Baja a **Security** → **Page Filter Mode** → cámbialo de `Both` a **`Blacklist`** → **Save**.
2. Si sigue igual: en Settings (Advanced) → **Content Script API** → cambia `UserScripts API` a **`UserScripts API Dynamic`** → Save → cierra Orion por completo y reabre.
3. ¿Nada? Usa la **Opción A** (Safari + app Userscripts), que es la vía más estable en iPadOS.

### Orion: «Tampermonkey has no access to this page» + script viejo (0.3.x)

Dos problemas típicos de Orion que se ven en las capturas del popup de Tampermonkey:

**1) «Tampermonkey has no access to this page»** = Orion no le dio permiso a Tampermonkey para ejecutarse en ese sitio. Sin ese permiso, NINGÚN script corre ahí, aunque esté instalado y activado. Solución:

- Toca el **icono de Tampermonkey en la barra de direcciones** de Orion (o menú **••• → Extensiones**). Si ves el aviso «has no access», tócalo o busca el permiso del sitio:
- Concede **«Permitir siempre en este sitio»** (Always Allow on This Website) — y si existe, **«Permitir siempre en todos los sitios»**. En Orion también funciona: **mantén pulsado el icono de la extensión → Permisos**.
- Repite el permiso para **`ganon1231231.github.io`** y para **`usmle.medicospira.com`** (el QBank vive en ese dominio dentro de un iframe).
- Cierra Orion por completo (multitarea → deslizar fuera) y reabre.

**2) Script viejo (0.3.x) instalado** — el banner naranja de Orion («Limited runtime host permissions might break some Tampermonkey features like **script update**…») lo dice: **la auto-actualización de scripts está rota en Orion**. Si tu popup lista «Copy + Translate **0.3.0**», tienes una versión que además solo matcheaba Medicospira. Reinstalación manual:

1. Dashboard de Tampermonkey → pestaña **Installed Userscripts** → papelera en la fila del script viejo.
2. Abre en Orion la URL del script: `https://ganon1231231.github.io/todo-app/companions/mobile-userscript/DrCoach-Mobile-Companion.user.js` → Tampermonkey mostrará **0.5.0** → **Install**.
3. Verifica en Installed Userscripts: debe decir **0.5.0** y ~37 KB.

> A partir de v0.4.2 la traducción **usa primero `fetch` normal (CORS)** en lugar de `GM_xmlhttpRequest` (que Orion rompe con sus «Limited runtime host permissions»). Si aun así falla la red, la píldora DC muestra su **punto en rojo** y aparece un aviso «⚠ La traducción falló» con el motivo concreto.
> A partir de v0.5.0 el motor traduce **por lotes (~25 textos por petición)**: una página del QBank se traduce en **segundos** en vez de minutos, la píldora muestra el **progreso «DC · 34/120»**, y las páginas ya visitadas aparecen traducidas **al instante** (caché persistente).

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

### Cómo saber si el script está vivo (v0.5.0)
El script ahora **siempre deja señal visible**:

| Dónde miras | Señal de vida |
|---|---|
| Dentro del QBank (Workspace) | Aviso efímero **«🧩 Companion v0.5.0 activo»** (3 s) + píldora fija abajo a la derecha: **«DC · Español»** (o «DC · Original» si ya está traduciendo). **Mientras traduce muestra el progreso «DC · 34/120»**. Tocando la píldora alternas español/original sin usar el botón del Workspace. **Punto rojo = fallo de red** (ver aviso ⚠). |
| En la página de Dr.Coach | Aviso efímero **«🧩 Companion v0.5.0 activo»** abajo a la izquierda (5 s) y el popup del gestor (ícono ᴀA → Userscripts/Tampermonkey) **sí lista el script**. |
| Si la traducción falla con el script vivo | Aviso **«⚠ La traducción falló — <motivo>»** (12 s, tocable para cerrar) dentro del QBank + la app muestra toast «No se pudo traducir…». |
| Si pulsas «Español» y el QBank no responde | La **propia app Dr.Coach! (v3.3.5+) muestra una tarjeta de diagnóstico** con los pasos exactos — funciona aunque el userscript no se haya inyectado. Si el script inyectado es viejo (0.3.x), la app muestra una tarjeta de **«Companion desactualizado»** con enlace directo de instalación. |

### Causas típicas (en orden de probabilidad)

1. **Estás en la app instalada (pantalla de inicio), no en Safari.** iPadOS no ejecuta extensiones en las web-apps instaladas. → Abre `https://ganon1231231.github.io/todo-app/` en Safari.
2. **Permiso del gestor limitado.** Ajustes → Safari → Extensiones → *Userscripts/Tampermonkey/Stay* → **«Todos los sitios web» → Permitir** (no «Preguntar»). En iPadOS 17+: Ajustes → Apps → Safari → Extensiones. Comprueba también el permiso por sitio desde el menú ᴀA → «Permisos del sitio web».
3. **El script está desactivado en el popup del gestor.** Los gestores permiten activar/desactivar cada script por dominio — toca la entrada del script en el popup y verifica que esté en verde.
4. **No se recargó tras activar la extensión.** Cierra Safari por completo (desliza fuera del multitarea) y reabre. Una recarga basta; iOS a veces necesita una segunda.
5. **El gestor no inyecta en iframes cruzados.** El QBank vive en un iframe de `usmle.medicospira.com` dentro de Dr.Coach. La app «Userscripts» **sí** inyecta en subframes (lo marca con la etiqueta `sub` en el popup). Si tu gestor/versión no lo hace:
   - **Plan B**: abre el QBank en pestaña propia — la píldora «DC · Español» funciona igual (el script es autónomo), y con iPadOS **Split View** tienes QBank traducido a un lado y Dr.Coach al otro.
   - **Plan C**: Orion + Tampermonkey (extensión real de escritorio).
6. **El script no se sincronizó en la app Userscripts.** Abre la app → ↻ → el interruptor del script debe estar verde. Si usas iCloud Drive, espera a que la sincronización termine (puede tardar).
7. **Caché del script viejo (v0.3/v0.4.x).** Abre el enlace del script en Safari y acepta la actualización, o repite la instalación. La versión correcta es **0.5.0** (visible en el popup del gestor y en el aviso «🧩 Companion»). Si instalaste pegando el código a mano, el script **no se actualiza solo**: bórralo y vuelve a instalarlo desde la URL. La app (v3.3.5+) te avisa sola: si el script inyectado anuncia una versión distinta a la esperada, muestra la tarjeta «⚠ Companion vX detectado» con el enlace de instalación.
8. **Orion: «Some URLs are restricted…».** Es el fallo conocido de Tampermonkey 5.5.x — solución en la sección de la Opción C de arriba (Page Filter Mode → Blacklist, o Content Script API → UserScripts API Dynamic).
9. **Orion: «Tampermonkey has no access to this page» + script 0.3.x.** Permiso de sitio sin conceder y auto-actualización rota — solución paso a paso en la sección «Orion: «Tampermonkey has no access…»» de la Opción C.

### Señales rápidas de diagnóstico

- ¿Popup del gestor en Dr.Coach **sí** muestra el script? → El gestor corre bien; el problema está en la inyección del iframe o en el permiso de `medicospira.com`.
- ¿Píldora «DC · Español» **dentro** del QBank? → Todo OK: pulsa la píldora o el botón «Español» del Workspace.
- ¿Píldora fuera pero botón «Español» no traduce? → Los mensajes no cruzan el iframe: usa la píldora directamente (mismo resultado).
- ¿Nada de nada? → Plan B (QBank suelto) u Orion; ambos están en la tabla de arriba.
