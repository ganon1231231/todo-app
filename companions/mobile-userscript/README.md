# Dr.Coach! Mobile Companion v0.2

Para Lenovo/Android con Edge + Tampermonkey.

## Qué hace
- Permite seleccionar y copiar texto dentro de Medicospira.
- `→ Stem` envía la selección al campo Caso clínico de Dr.Coach!.
- Traduce Medicospira **en el mismo iframe** y **reemplaza** el inglés por español (no modo bilingüe).
- El botón `Español / Original` del Workspace controla este userscript.
- Mantiene traducción en páginas dinámicas del QBank.

## Instalación
1. Desactiva/elimina el userscript de Immersive Translate para evitar traducciones duplicadas.
2. Tampermonkey → crear/importar script → instala `DrCoach-Mobile-Companion.user.js`.
3. Recarga Dr.Coach! y Workspace.
4. Pulsa `Español` en la cabecera del Workspace.

## Privacidad / red
La traducción automática móvil usa Google Translate como motor primario y Bing como fallback mediante endpoints web sin clave. El texto a traducir se envía a esos servicios. No lo uses para texto con datos clínicos identificables de pacientes reales.
