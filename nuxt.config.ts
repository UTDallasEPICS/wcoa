export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/ui', 'nuxt-cron'],
  css: ['./assets/css/main.css'],
  // Dev file-watcher: never descend into `.claude/`. Claude Code stores its
  // agent git worktrees under `.claude/worktrees/` — full nested checkouts that
  // overwhelm the FSEvents/fs.watch watcher and crash `nuxt dev` with
  // `EMFILE: too many open files, watch`. `.claude/` is tooling, never app code,
  // so ignoring it is a no-op for the build and the production runtime.
  ignore: ['**/.claude/**'],
  vite: {
    server: {
      watch: {
        ignored: ['**/.claude/**'],
      },
    },
  },
  // Maps/geocoding/routing use key-less open-source services (MapLibre +
  // OpenFreeMap tiles, Photon geocoding, OSRM routing), so no map API keys /
  // runtimeConfig are needed. The former Google Directions + Embed keys are gone.
  nitro: {
    externals: {
      external: ['better-sqlite3'],
    },
    // Same rationale as `vite.server.watch.ignored` above: keep Nitro's dev
    // watcher out of `.claude/` so nested agent worktrees can't exhaust it.
    watchOptions: {
      ignored: ['**/.claude/**'],
    },
  },
})
