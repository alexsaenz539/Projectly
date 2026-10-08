# Projectly

Administrador de proyectos con Angular 22, TypeScript, Tailwind CSS 4, Angular CDK, Signals, Supabase, Lucide y ApexCharts. Conserva la estructura de la interfaz de Open Design y aplica la identidad oficial de Projectly: carbón #111827, verde esmeralda #10B981, naranja #F59E0B, superficies #FAFAF9 y tipografía Inter.

## Ejecutar

Requiere Node.js 22.22.3 o posterior compatible con Angular 22.

```powershell
cd "D:\Users\Alex_Saenz\Documents\Proyectos\Administrador de proyectos"
npm install
npm start
```

Abre http://localhost:4500. La pantalla inicial es **Iniciar sesión**. El enlace **Crear usuario** abre el registro en una pantalla independiente. Ambas siguen las pantallas nuevas de Open Design con la identidad de Projectly y plantillas HTML separadas. Sin configurar Supabase, un correo válido y una contraseña de al menos 8 caracteres permiten entrar a la demostración; no se guardan credenciales ni se crean cuentas reales. Tras entrar se abre **Mis tareas** y los cambios del espacio se guardan en este navegador. Cerrar sesión vuelve al acceso. Las rutas internas requieren una sesión; abrir la raíz siempre muestra el acceso.

```powershell
npm run build
npm test
```

La compilación lista para publicar está en `dist/project-os/browser`. Configura el alojamiento para redirigir rutas desconocidas a `index.html`.

## Funciones

- Acceso y registro: validaciones por campo, confirmación de contraseña, mostrar/ocultar contraseña y confirmación de correo con Supabase.
- Espacios: crear espacios privados con nombre, identificador único y descripción; abrirlos desde el directorio o desde el encabezado. Los proyectos, tickets, sprints, miembros y notificaciones se guardan por separado.
- Dashboard: indicadores, ApexCharts, progreso por proyecto y tickets recientes.
- Proyectos: crear, editar y archivar; claves únicas dentro del espacio.
- Tickets: crear, editar, eliminar con confirmación, buscar y filtrar.
- Mis tareas: Todas, Hoy, Próximas y Atrasadas; completar tickets.
- Kanban: arrastre con Angular CDK y selector de estado accesible.
- Sprints: objetivos, fechas, asignación de tickets, inicio y cierre.
- Calendario: vencimientos, navegación mensual y acceso al ticket.
- Equipo: directorio de responsables y carga de trabajo.
- Reportes: gráficos, avance por proyecto y descarga CSV.
- Notificaciones: actividad, marcar leídas y recordatorios de bloqueados/atrasados.
- Configuración: tema oscuro, navegación/tablas compactas, perfil para Mis tareas y respaldo JSON.
- Atajos: Ctrl K / Cmd K para buscar, C para crear un ticket y Escape para cerrar diálogos.

## Conectar Supabase

1. Crea o selecciona un proyecto Supabase.
2. En una base nueva, ejecuta **una vez** `supabase/schema.sql` desde el SQL Editor y después `supabase/migrations/20261008222620_workspace_isolation.sql`. En una base que ya use el esquema anterior, ejecuta únicamente esa migración una vez: conserva los datos existentes dentro de **Mi espacio personal**. Nunca vuelvas a ejecutar el esquema inicial sobre tablas existentes.
3. Copia la URL y la clave **publishable** a `src/environments/environment.ts`. Es configuración pública. Nunca uses claves secretas ni `service_role`.
4. Activa Email/Password en Authentication y configura las URLs de tu aplicación. Si requiere confirmación de correo, confirma antes de iniciar sesión.
5. Reinicia la aplicación. Ahora solicita inicio de sesión y carga el último espacio privado de esa cuenta. Las cuentas nuevas deben crear su primer espacio; las rutas de trabajo las llevan al directorio si todavía no tienen uno. Crea miembros y proyectos antes de crear tickets. Los datos de demostración no se suben automáticamente.
6. Verifica en Database → Publications que `workspaces`, `members`, `projects`, `sprints`, `tickets` y `notifications` estén en `supabase_realtime`. El esquema las agrega si la publicación existe.

Cada cuenta puede crear varios **espacios privados**. RLS separa las cuentas por `auth.uid()` y las claves foráneas comprueban que cada registro pertenezca a un espacio de esa cuenta. Los responsables, proyectos, tickets y sprints deben pertenecer al mismo espacio; además, el sprint debe corresponder al proyecto del ticket. Las claves de proyectos y tickets pueden repetirse en espacios distintos. El directorio de equipo **no envía invitaciones ni concede acceso a otras cuentas**; los roles son etiquetas organizativas. La colaboración entre cuentas requiere añadir membresías y políticas de acceso compartido.

Realtime vuelve a cargar los datos ante cambios de PostgreSQL. Las operaciones muestran errores y no confirman cambios rechazados por el servidor. Apariencia y perfil seleccionado se guardan localmente; los datos de negocio se guardan en Supabase.

`npm test` ejecuta el esquema real en PostgreSQL embebido (PGlite) con Auth simulado y verifica RLS, aislamiento de cuentas, fechas, claves, relaciones y notificaciones. También prueba validación de formularios, acceso protegido, cierre de sesión y respuestas de la API Auth con dependencias controladas. Las pruebas de espacios cubren conservación de datos anteriores, almacenamiento local separado, recuperación ante fallos de almacenamiento, consultas y escrituras por espacio, respuestas tardías y claves foráneas entre espacios. No sustituye una prueba contra tu proyecto Supabase ni verifica Auth o Realtime remotos.

## Estructura

```text
src/app/
├── core/
│   ├── auth/
│   ├── guards/
│   ├── services/
│   └── layouts/
├── shared/
│   ├── components/
│   ├── directives/
│   └── pipes/
├── features/
│   ├── dashboard/
│   ├── workspaces/    # Directorio y creación de espacios
│   ├── projects/
│   ├── tickets/       # Tickets y Mis tareas
│   ├── kanban/
│   ├── sprints/
│   ├── calendar/
│   ├── team/
│   ├── reports/
│   ├── notifications/
│   └── settings/
└── app.routes.ts
```

Las rutas cargan cada funcionalidad bajo demanda. `WorkspaceService` centraliza Signals, persistencia y Realtime. Los componentes compartidos contienen formularios, tablas, gráficos, búsqueda, iconos y encabezados.

Todos los componentes separan su plantilla HTML de la lógica TypeScript: cada archivo `.ts` utiliza `templateUrl` para apuntar a su archivo `.html`. El componente raíz usa `app.ts` y `app.html`; los demás siguen el patrón `nombre.component.ts` y `nombre.component.html`. Angular CLI está configurado para generar futuras plantillas en archivos separados.

Documentación consultada: [Angular](https://angular.dev/installation), [Tailwind con Angular](https://tailwindcss.com/docs/installation/framework-guides/angular), [Angular CDK](https://angular.dev/guide/drag-drop), [Lucide Angular](https://lucide.dev/guide/angular/getting-started), [Supabase Auth](https://supabase.com/docs/guides/auth/passwords), [Supabase Realtime](https://supabase.com/docs/guides/realtime/postgres-changes), [ApexCharts](https://apexcharts.com/docs/installation/).

## Electron y actualizaciones de Windows

La aplicación de escritorio usa Electron, `electron-updater` y un instalador NSIS para Windows x64. El repositorio de actualizaciones es **alexsaenz539/Projectly**, configurado como público en `electron/updates.config.json`. Las personas que instalen la aplicación no necesitan un token de GitHub.

```powershell
npm run desktop:start   # Compila Angular y abre Electron
npm run desktop:dev     # Abre Electron contra npm start (127.0.0.1:4500)
npm run desktop:smoke   # Verifica el arranque y el puente IPC en una ventana oculta
npm run desktop:pack    # Genera la aplicación sin instalador
npm run desktop:dist    # Genera el instalador local, sin publicar
```

`desktop:dev` requiere que `npm start -- --host 127.0.0.1` esté activo en otra terminal. Las actualizaciones reales se habilitan **en la aplicación empaquetada/instalada**; en desarrollo se informa que están deshabilitadas.

El actualizador busca nuevas versiones al iniciar y cada hora. También hay una opción **Buscar actualizaciones** en Configuración. Cuando encuentra una versión estable superior, descarga sus archivos y muestra el progreso. Al terminar aparece **Instalar actualización** tanto en el aviso global como en Configuración. La instalación se ejecuta únicamente al pulsar el botón y después reinicia la aplicación. Cerrar la aplicación no instala automáticamente una actualización descargada. Los cambios pendientes de un formulario deben guardarse antes de pulsar Instalar.

### Publicar versiones

La versión actual, con las nuevas pantallas de acceso, registro y espacios, es **0.1.4**. `npm run desktop:dist` genera en `release/`:

- `Projectly-Setup-0.1.4-x64.exe`
- `Projectly-Setup-0.1.4-x64.exe.blockmap`
- `latest.yml`

Publica el lanzamiento estable **v0.1.4** en [GitHub Releases](https://github.com/alexsaenz539/Projectly/releases) y adjunta **los tres archivos**, conservando sus nombres. Si ya distribuiste la versión 0.1.0, el actualizador reconocerá esta versión superior. Publica el lanzamiento al terminar la carga; los borradores no se ofrecen a los clientes.

Para una actualización posterior, incrementa `version` en `package.json`, actualiza el lockfile con `npm install --package-lock-only`, vuelve a ejecutar `npm run desktop:dist` y publica los nuevos tres archivos en un lanzamiento con el tag correspondiente, por ejemplo **v0.1.5**. Cambiar la versión en el código o subir solo el instalador no basta para que el actualizador detecte y descargue correctamente la nueva versión.

También se incluye `.github/workflows/desktop-release.yml`. Cuando este proyecto esté en el repositorio y se suba un tag `v*` que coincida con `package.json`, GitHub Actions ejecutará las pruebas, construirá el instalador y cargará los archivos en un **borrador de lanzamiento**. Revisa ese borrador y publícalo desde GitHub. El token temporal de Actions se usa solamente para publicar; no se incluye en el instalador. `npm run desktop:publish` permite generar y cargar el mismo borrador desde un entorno con `GH_TOKEN` configurado. No se ha ejecutado una publicación remota en esta tarea.

El instalador generado localmente no tiene firma digital porque no se configuró un certificado. Para distribución firmada, configura un certificado de firma de código con las opciones de electron-builder antes de generar/publicar las versiones.

### Verificación de Electron

- Compilación Angular y arranque real de Electron con navegación y puente IPC.
- Renderer aislado y sin acceso a Node.js; mensajes IPC restringidos a la ventana principal.
- Pruebas del flujo de búsqueda, descarga, errores, reintentos e instalación manual, con un actualizador simulado.
- Vista del botón y transición a Instalando verificadas con una descarga simulada.
- Instalador NSIS, archivo blockmap y metadatos generados; integridad SHA512 comprobada contra `latest.yml`.

La descarga e instalación de una actualización **real desde GitHub** requiere un lanzamiento estable con los archivos anteriores y una versión posterior a la que esté instalada. Esa prueba completa queda pendiente de la publicación.

Las dependencias de producción pasan `npm audit --omit=dev`. El audit completo reporta avisos moderados en dependencias transitivas de las herramientas de empaquetado (`electron-builder` → `sprintf-js`), sin una actualización directa compatible que los elimine; no están en el código de producción del actualizador.

Referencias: [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security), [Electron IPC](https://www.electronjs.org/docs/latest/tutorial/ipc), [electron-updater para la versión 26 de electron-builder](https://www.electron.build/v26/docs/features/auto-update/).

## Identidad visual oficial

La fuente de identidad es `D:\Users\Alex_Saenz\Documents\Proyectos\Projectly`: se utilizaron su manual, sus tokens y los archivos originales, sin redibujar los logotipos. Las copias de uso de la aplicación están en `public/brand/` y la fuente variable Inter en `public/fonts/`, para que la tipografía funcione sin conexión.

`BrandLogoComponent` usa el logotipo principal en tema claro, el inverso en oscuro y el isotipo cuando la navegación está contraída. El navegador usa los favicons oficiales; Electron y el instalador Windows usan el icono oficial de aplicación de alta resolución. El nombre visible del producto es **Projectly**, incluidos títulos, ventana, respaldos e instalador.

Los tokens originales se importan desde `src/styles/projectly-tokens.css`. `src/styles/projectly-interface.css` aplica la escala tipográfica, radios de 10 px en controles y 16 px en tarjetas, colores funcionales y progreso verde. La variante oscura conserva contrastes legibles con los logos inversos.

Se conserva el identificador interno `project-os`, el esquema interno de Electron y las claves de almacenamiento anteriores por compatibilidad con preferencias y datos locales. Electron reutiliza el perfil anterior cuando existe. No es necesario restablecer la demostración al cambiar de marca.

## Espacios en la demostración local

La demostración anterior conserva la clave `project-os-angular-demo-v1` y aparece como **Espacio de demostración**. El directorio nuevo usa `projectly-workspaces-v1` y cada espacio nuevo guarda su propio contenido en una clave `projectly-workspace-<id>-v1`. Seleccionar otro espacio limpia los datos de la vista antes de cargarlo. La selección se conserva al recargar; la raíz de la aplicación sigue abriendo **Iniciar sesión**.

La creación valida nombres de 3 a 64 caracteres, identificadores de 3 a 32 con letras minúsculas, números y guiones, y descripciones de hasta 240 caracteres. El identificador se genera desde el nombre hasta que lo editas manualmente. No se pueden repetir identificadores dentro de la cuenta; `demo` está reservado. **Restablecer demostración** solo aparece dentro del espacio de ejemplo y no reemplaza los espacios nuevos. Los respaldos JSON corresponden al espacio seleccionado.
