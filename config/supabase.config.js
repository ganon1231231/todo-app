/* Dr.Coach! v3.2.6 — Supabase config (SÍ se sube al repo: clave pública por diseño)
 *
 * Este archivo se publica con la web (GitHub Pages incluido) para que todos
 * los dispositivos tengan login y Cloud Sync SIN configurar nada.
 *
 * ¿Por qué es seguro? La «anon key» es la clave PÚBLICA del navegador:
 * Supabase la diseña para viajar dentro de cualquier app frontend y
 * cualquier visitante ya puede verla en las DevTools al usar la web.
 * Lo que protege tus datos no es esta clave, sino:
 *   · RLS (Row Level Security): cada usuario solo lee/escribe sus filas.
 *   · Las cuentas de email+contraseña creadas a mano en el Dashboard.
 *   · El registro público deshabilitado.
 *
 * REGLA ABSOLUTA: aquí NUNCA va la service_role key ni ningún otro secreto
 * de servidor. Solo Project URL + anon public key (+ userHints opcional).
 */

window.DRCOACH_SUPABASE_CONFIG = {
  url: 'https://plyegpuxzzmexcutimcc.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBseWVncHV4enptZXhjdXRpbWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4MjE4OTgsImV4cCI6MjEwNDM5Nzg5OH0.qOKgy_cg8TLwzoWfu7c1ISbQYdJC9Ub3AEdgtr7Vuzw'
};
