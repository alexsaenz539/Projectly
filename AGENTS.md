# Reglas de trabajo — Projectly

Estas instrucciones se aplican a todo el repositorio. Leerlas antes de modificar código y respetar también cualquier `AGENTS.md` más específico.

## Comunicación y alcance

- Responder en español, con mensajes claros y concisos.
- Implementar lo solicitado sin rediseñar áreas ajenas ni añadir dependencias innecesarias.
- Revisar `git status` antes de trabajar. No sobrescribir cambios del usuario, credenciales ni configuración local.
- No publicar versiones, crear commits, ejecutar migraciones remotas ni eliminar datos sin autorización explícita.
- No delegar a subagentes salvo petición explícita del usuario.

## Arquitectura

- Stack actual: Angular 22, TypeScript, Angular CDK, Tailwind CSS 4, Signals, Supabase y Electron.
- Revisar `package.json` y los archivos relacionados antes de proponer cambios de arquitectura.
- Mantener funcionalidades en `src/app/features/`, servicios y lógica transversal en `src/app/core/`, y elementos reutilizables en `src/app/shared/`.
- Usar componentes standalone, `inject()`, Signals y control de flujo `@if` / `@for` según los patrones existentes.
- Generar componentes nuevos con Angular CLI. Separar la plantilla en `.component.html` y los estilos específicos en `.component.css`; evitar plantillas HTML inline.
- Mantener la lógica de persistencia en los servicios existentes, especialmente `WorkspaceService`, no en los controles visuales.

## Diseño y controles compartidos

- Conservar la identidad de **Projectly**: tipografía Inter local, logotipos oficiales y colores definidos en `src/styles/projectly-tokens.css` y `src/styles.css`.
- Usar variables de tema (`--surface`, `--surface-muted`, `--text-primary`, `--text-muted`, `--border-subtle`, `--focus`, etc.). No fijar fondos blancos ni colores oscuros que rompan el cambio de tema.
- Todos los cambios visuales deben funcionar en tema claro, oscuro y pantallas pequeñas.
- Reutilizar los controles de `src/app/shared/components/form-controls.module.ts` en nuevos formularios y filtros. Importar `FormControlsModule` junto a `FormsModule` cuando corresponda.
- **Selects:** al importar `FormControlsModule`, todos los `<select>` reciben `ThemedSelectDirective`; conservar sus opciones, `ngModel`, etiquetas y eventos. No crear otro menú desplegable independiente para el mismo propósito.
- **Fechas:** usar `<app-date-picker inputId="fecha" label="Fecha" name="fecha" [(ngModel)]="fecha" />`. Soporta `required`, `min` y `max`, con valores `YYYY-MM-DD` sin conversiones a UTC.
- **Switches:** usar `<input appSwitch type="checkbox" ... />` dentro de un `<label>` para opciones binarias como mostrar archivados o preferencias. No sustituir por switch las casillas de selección múltiple.
- Las barras de desplazamiento son compartidas, finas y adaptadas al tema en `src/styles.css`. No introducir barras blancas, flechas nativas o estilos distintos por pantalla.
- Mejorar el control compartido cuando falte una variante; evitar duplicar CSS y comportamiento en cada funcionalidad.
- Al usar un nombre nuevo en `app-icon`, registrar su icono Lucide en `src/app/app.config.ts`. La compilación no detecta iconos dinámicos sin registrar; comprobarlos también en ejecución.

## Accesibilidad y comportamiento

- Mantener etiquetas asociadas, foco visible, navegación con teclado, estados deshabilitados y atributos ARIA apropiados.
- Los desplegables deben cerrar con Escape y al hacer clic fuera, devolver el foco y no quedar recortados por diálogos o contenedores con scroll.
- Respetar `prefers-reduced-motion` y no ocultar el desplazamiento ni depender solo del color para comunicar estados.
- Mantener la integración con Angular Forms y los estados de validación. No cambiar formatos de datos por motivos visuales.

## Datos y seguridad

- Mantener el aislamiento de cuentas y espacios, las restricciones de relaciones y las políticas RLS de Supabase.
- Las capturas de tickets usan `TicketScreenshotsComponent` y `TicketScreenshotsService`, el bucket privado `ticket-screenshots` y URLs firmadas. No volver público el bucket ni borrar filas de `storage.objects` mediante SQL para eliminar archivos: usar la API de Storage. Preservar el guardado local en IndexedDB del modo demostración.
- No incluir claves secretas ni `service_role` en el frontend. No modificar `src/environments/environment.ts` salvo que la tarea lo requiera expresamente.
- Preservar tanto el modo demostración local como el modo conectado a Supabase.
- En Electron, mantener el aislamiento del renderer y el puente IPC limitado; no habilitar Node.js en la interfaz.

## Verificación

- Ejecutar `npm run build` después de modificar código Angular y corregir los errores.
- Ejecutar `npm test` cuando se cambie comportamiento o lógica y añadir pruebas relevantes cuando sea posible.
- Comprobar los controles visualmente y con teclado cuando haya un navegador disponible. No afirmar que se realizó una verificación que no se ejecutó.
- No subir los presupuestos de tamaño para silenciar advertencias: informar o corregir la causa dentro del alcance de la tarea.
- No editar archivos generados en `dist/`, `release/` o `node_modules/`.
- Finalizar con un resumen breve del resultado, las verificaciones realizadas y cualquier limitación pendiente.
