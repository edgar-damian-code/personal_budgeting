import { createApp, analytics, server } from '@databricks/appkit';

createApp({
  plugins: [
    analytics(),
    server(),
  ],
  // AppKit's analytics cache defaults to enabled with a 1-hour TTL, in-memory (no
  // Lakebase configured here). For a single-user app where data is edited directly
  // and expected to show up immediately, that staleness window causes more confusion
  // than the caching saves in query cost — disable it.
  cache: {
    enabled: false,
  },
}).catch(console.error);
