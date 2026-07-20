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
  runtimeConfig: {
    // Server-only (issue #30): the Directions API key used by the estimate
    // endpoint. It NEVER reaches the client bundle. Overridden by the
    // NUXT_GOOGLE_MAPS_API_KEY env var. This MUST be a DIFFERENT Google Cloud
    // key from the public embed key below — a private, IP/API-restricted
    // Directions key.
    googleMapsApiKey: '', // Overridden by NUXT_GOOGLE_MAPS_API_KEY
    public: {
      // Client-visible (issue #30): the Maps *embed* iframe key. This ships to
      // the browser by design, so it MUST be HTTP-referrer-restricted in Google
      // Cloud and scoped to the Maps Embed API only. Overridden by
      // NUXT_PUBLIC_GOOGLE_MAPS_API_KEY.
      googleMapsApiKey: '', // Overridden by NUXT_PUBLIC_GOOGLE_MAPS_API_KEY
    },
  },
  nitro: {
    externals: {
      external: ['better-sqlite3']
    },
    // Same rationale as `vite.server.watch.ignored` above: keep Nitro's dev
    // watcher out of `.claude/` so nested agent worktrees can't exhaust it.
    watchOptions: {
      ignored: ['**/.claude/**']
    }
  }
})
