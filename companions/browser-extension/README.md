# Dr.Coach! Companion v0.4

Extensión opcional para Chrome de escritorio que añade traducción inline inglés→español y Copy Assist manual dentro de Medicospira.

> **¿Usas iPad, iPhone, Safari o Firefox?** La traducción inline solo es posible con una extensión en Chrome/Edge de escritorio (un sitio web no puede tocar el DOM de un iframe de otro dominio). En el resto de dispositivos Dr.Coach! v3.2.0+ trae el **Traductor integrado**: botón «Traductor» del Workspace → copia cualquier texto del QBank y pégalo ahí; o abre Medicospira en su propia pestaña y usa la traducción nativa de Safari (aA → «Traducir página»).

## Cambio principal

El control flotante permanente `DC · EN · ES` fue eliminado. El idioma se controla exclusivamente desde el botón **Original / Español** del Workspace de Dr.Coach!. La extensión trabaja en segundo plano y no ocupa superficie del QBank.

Si Chrome necesita una activación de usuario para descargar/iniciar el modelo de traducción, aparecerá **solo una vez** un pequeño aviso `Activar español`; desaparece al completar la activación.

Copy Assist sigue funcionando: selecciona texto y usa `⌘C`/`Ctrl+C`, o el botón temporal **Copiar selección**.

## Instalación
1. Abre `chrome://extensions`.
2. Activa **Modo de desarrollador**.
3. Elimina/desactiva la versión anterior del Companion.
4. Pulsa **Cargar descomprimida** y selecciona esta carpeta.
5. Recarga Dr.Coach! y Medicospira.

No modifica tus datos ni automatiza la extracción masiva del QBank.
