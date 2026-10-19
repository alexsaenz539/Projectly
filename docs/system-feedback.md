# Avisos del sistema y versiones de tickets

## Toasts

`ToastService` expone `success(message)`, `error(message)`, `warning(message)` e `info(message)`. El componente global `app-toast` está montado una sola vez en la raíz, incluso en las pantallas de acceso.

Los errores permanecen visibles hasta cerrarlos. Los demás avisos duran seis segundos, con pausa al pasar el ratón o enfocar sus controles. Se muestran hasta cuatro avisos simultáneos y se deduplican los mensajes activos.

Para reflejar mensajes existentes de un formulario sin quitar su contexto, importa `ToastFeedbackDirective` y usa `[appToastFeedback]="error()"`. El tipo predeterminado es `error`; puede cambiarse con `toastKind="success"`, `warning` o `info`. No debe usarse en errores de validación de cada pulsación ni en indicadores de progreso.

`WorkspaceService.notify(message, kind)` conserva su API anterior y alimenta el host global a través del layout. Los errores inesperados capturados por Angular muestran un aviso genérico, sin exponer sus detalles técnicos al usuario.

## Versión de entrega

Los tickets tienen un campo opcional `target_version`, independiente de la versión de Projectly. Se edita en el formulario del ticket y aparece en la tabla, Kanban, modal de consulta y página completa. Los tickets anteriores muestran «Sin versión» hasta que se les asigne una.

Antes de usarlo con Supabase, aplica manualmente `supabase/migrations/20261019180000_ticket_target_version.sql`. No cambia las políticas RLS existentes ni asigna versiones automáticamente. Admite etiquetas de hasta 40 caracteres con letras ASCII, números, puntos, guiones y guiones bajos; por ejemplo, `1.0.0-beta.1`.
