# Mi Agrupacion Plus

Plugin centralizado de Obsidian para registro de actividades comunitarias bahá'ís. Conexión instantánea con código de invitación.

## Características

- **Conexión instantánea**: Los admin crean una agrupación y comparten un código. Los auxiliares se unen pegando el código.
- **Sync automático**: Sincronización bidireccional con Supabase. Configurable cada 1-10 minutos o manual.
- **Multi-agrupación**: Cada agrupación tiene sus datos aislados. No hay mezcla de datos.
- **Sin configuración Supabase**: El proyecto Supabase ya está configurado. Solo necesitás registrarte.

## Uso

### Admin (crea la agrupación)

1. Instalá el plugin en Obsidian
2. Abrí Ajustes → Mi Agrupación Plus
3. Escribí el nombre de tu agrupación
4. Hacé click en "Crear agrupación"
5. Generá un código de invitación
6. Compartí el código con tus auxiliares

### Auxiliar (se une a una agrupación)

1. Instalá el plugin en Obsidian
2. Abrí Ajustes → Mi Agrupación Plus
3. Pegá el código que te dio tu admin
4. Hacé click en "Unirse"
5. Registrate o iniciá sesión
6. ¡Listo! Tus datos se sincronizan automáticamente

## Desarrollo

```bash
npm install
npm run dev    # modo desarrollo (watch)
npm run build  # build producción
```

## Stack

- **Runtime**: Obsidian Plugin API
- **Backend**: Supabase (PostgreSQL + RLS + RPCs)
- **Build**: esbuild
- **Types**: TypeScript 5.3+

## Licencia

MIT
