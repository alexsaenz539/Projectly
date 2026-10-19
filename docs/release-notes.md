# Novedades al instalar una versión

Antes de generar cada instalador:

1. Actualiza la versión de `package.json` con `npm version patch --no-git-tag-version` (o el incremento que corresponda).
2. Añade una entrada con esa misma versión a `electron/release-notes.json`. Escribe los cambios visibles para el usuario como una lista de textos. Conserva las entradas anteriores.
3. Ejecuta `npm test` y `npm run build`, y genera el instalador con `npm run desktop:dist`.

La aplicación instalada muestra las notas de su versión al abrirse, incluso sin conexión y antes de iniciar sesión. Al cerrar el modal (botón, Escape o clic fuera), guarda la versión leída en `release-notes-seen.json` dentro del directorio de datos de Electron. No modifica los datos del espacio ni de la cuenta.

El aviso aparece también en una primera instalación o al actualizar manualmente. No aparece en desarrollo ni en el navegador. Si faltan notas para una versión, muestra un texto genérico. No se consultan ni ejecutan HTML o scripts de las notas de GitHub.
