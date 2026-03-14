import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

function normalizeEnvValue(value: string | undefined): string {
  if (!value) {
    return "";
  }

  const trimmed = value.trim();
  return trimmed.replace(/^['\"]|['\"]$/g, "");
}

function resolveSupabaseEnv() {
  const url =
    normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL) ||
    normalizeEnvValue(process.env.SUPABASE_URL);
  const anonKey =
    normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    normalizeEnvValue(process.env.SUPABASE_ANON_KEY);

  return { url, anonKey };
}

export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) {
    return browserClient;
  }

  const { url: supabaseUrl, anonKey: supabaseAnonKey } = resolveSupabaseEnv();

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[Supabase] Configuration manquante", {
      hasNextPublicUrl: Boolean(normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL)),
      hasNextPublicAnonKey: Boolean(normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)),
      hasSupabaseUrl: Boolean(normalizeEnvValue(process.env.SUPABASE_URL)),
      hasSupabaseAnonKey: Boolean(normalizeEnvValue(process.env.SUPABASE_ANON_KEY)),
    });
    throw new Error(
      "Configuration Supabase manquante. Verifie NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (ou SUPABASE_URL / SUPABASE_ANON_KEY) puis redemarre le serveur Next.js.",
    );
  }

  browserClient = createClient(supabaseUrl, supabaseAnonKey);
  return browserClient;
}
