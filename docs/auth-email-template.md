# Correo de confirmación de Projectly

La plantilla está en `supabase/templates/confirmation.html`. Utiliza la paleta de Projectly, tipografía Inter cuando esté disponible (con fuentes de sistema de respaldo), texto en español, vista móvil y adaptación a modo oscuro en clientes compatibles. No descarga imágenes ni fuentes externas: la marca se presenta como texto, sin depender de un servidor público de recursos.

## Activar en Supabase

1. Abre el proyecto correcto en el panel de Supabase.
2. Ve a **Authentication → Email Templates → Confirm signup** (en algunas versiones, **Authentication → Emails → Templates**).
3. Guarda una copia del asunto y del cuerpo actuales antes de reemplazarlos.
4. Usa el asunto **Confirma tu correo y empieza con Projectly**.
5. Copia el contenido completo de `supabase/templates/confirmation.html` en el cuerpo HTML y guarda los cambios.
6. Envía una prueba y después registra una cuenta de prueba para verificar el recorrido real de confirmación.

Esta plantilla no se activa al compilar Angular ni mediante una migración SQL. No se ha cambiado la configuración remota. No modifica SMTP, remitente, caducidad del enlace ni las redirecciones de autenticación.

## Enlace y seguridad

Conserva `{{ .ConfirmationURL }}` en el botón y en el enlace alternativo. Supabase genera el enlace de confirmación; no lo sustituyas por una URL fija, ni por `SiteURL`, ni por un token de prueba. No se insertan nombres ni metadatos del usuario en el HTML.

Revisa **Authentication → URL Configuration**: la URL de destino debe ser válida para el entorno publicado. En Electron, comprueba el flujo actual de vuelta a la aplicación después de confirmar; esta plantilla solo cambia la presentación del correo, no implementa enlaces profundos.

## Comprobaciones

- Gmail, Outlook y Apple Mail: legibilidad, botón y enlace alternativo.
- Pantalla estrecha y texto ampliado: sin desplazamiento horizontal con enlaces largos.
- Tema claro y oscuro (algunos clientes fuerzan sus propios colores).
- Imágenes bloqueadas: todo el contenido y la acción siguen disponibles.
- Teclado: enlace principal y enlace alternativo accesibles.
- Confirmación real con una cuenta de prueba, incluido el destino final configurado en Supabase.

La maqueta local en un navegador no sustituye las pruebas de entrega en clientes de correo reales. Los clientes que ignoran estilos avanzados reciben el diseño claro con estilos inline y estructura de tablas.
