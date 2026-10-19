# Fotos de los responsables

En modo conectado, los responsables del directorio se vinculan con cuentas de Projectly mediante su correo de acceso confirmado. Las nuevas asignaciones requieren una cuenta vinculada. Crear un miembro del directorio no registra una cuenta de acceso ni concede acceso al espacio.

## Instalación

Aplicar manualmente `supabase/migrations/20261019190000_member_account_profiles.sql` después de las migraciones de espacios y fotos de perfil. No se aplica automáticamente desde la aplicación.

La migración añade `members.account_id`, vincula los correos coincidentes y conserva los contactos y tickets históricos. Cuando una cuenta confirma su correo, también se vinculan los contactos pendientes. Las asignaciones históricas sin cuenta pueden conservarse al editar otros campos; una asignación nueva exige una cuenta confirmada. El modo de demostración mantiene sus responsables locales ficticios.

Para que aparezca tu foto, el correo del responsable en Equipo debe coincidir con el correo de tu cuenta de acceso. No se usa el nombre ni la preferencia «Mis tareas» para atribuir una foto a una persona.

El botón «Asignarme a mí» del editor selecciona tu cuenta confirmada. Reutiliza el responsable vinculado a tu cuenta o a tu correo de acceso; si no existe, lo crea en el espacio actual. La selección se guarda en el ticket al guardar el formulario. En demostración utiliza el responsable elegido para el trabajo personal, o crea un usuario local de demostración si el espacio está vacío.

## Privacidad

`member_profile_images` solo devuelve identificadores de responsables del espacio del solicitante y los campos necesarios para su imagen. No expone `auth.users`, biografías ni metadatos completos. El vínculo de cuenta se calcula en el servidor y no puede elegirse desde el cliente.

El bucket `profile-avatars` sigue siendo privado. Una política de lectura adicional permite descargar únicamente la foto actual de cuentas vinculadas al directorio propio. No permite ver fotos antiguas, otros archivos, subir ni eliminar fotos ajenas. Los responsables no adquieren acceso a los tickets o al espacio por aparecer en el directorio.

Las fotos se descargan con la sesión autenticada, se reutilizan por cuenta y se liberan al cambiar de espacio o cuenta. Los avatares predefinidos se resuelven localmente. Si no hay foto o no se puede descargar, se muestran iniciales; el nombre permanece disponible al pasar el cursor y con teclado. Las fotos de otros responsables se actualizan al recargar los datos del espacio; la foto propia reacciona al guardar Mi perfil.
