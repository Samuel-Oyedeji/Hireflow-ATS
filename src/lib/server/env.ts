/**
 * Server-only environment access. These vars must NOT carry the `VITE_` prefix,
 * so they are never bundled into the client. Reads are lazy (getters) so merely
 * importing this module — e.g. from the client graph of a server function — never
 * throws; a missing var only fails when a server handler actually needs it.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Set it in your .env (server-side, no VITE_ prefix).`,
    );
  }
  return value;
}

export const serverEnv = {
  get supabaseUrl() {
    return required("SUPABASE_URL");
  },
  get supabaseServiceRoleKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  get openRouterApiKey() {
    return required("OPENROUTER_API_KEY");
  },
  get openRouterModel() {
    return required("OPENROUTER_MODEL");
  },
  get openRouterAppUrl(): string | undefined {
    return process.env.OPENROUTER_APP_URL || undefined;
  },
  get openRouterAppTitle() {
    return process.env.OPENROUTER_APP_TITLE || "HireFlow";
  },
};
