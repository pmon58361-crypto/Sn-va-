import { handlers } from "@/auth";

// Proxy callback mount point for split deployments.
// When a dev instance sets AUTH_REDIRECT_PROXY_URL=https://<this-app>,
// OAuth providers are redirected here instead of /api/auth/callback/*,
// and this route forwards the result back to the originating host.
export const { GET, POST } = handlers;
