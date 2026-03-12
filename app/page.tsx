"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function Home() {
  const router = useRouter();
  const [configError, setConfigError] = useState("");

  useEffect(() => {
    try {
      const supabase = getSupabaseBrowserClient();

      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          router.replace("/dashboard");
        }
      });
    } catch (error) {
      setConfigError(
        error instanceof Error
          ? error.message
          : "Configuration Supabase manquante. Redemarre le serveur Next.js.",
      );
    }
  }, [router]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-[#F4F8FC] via-[#EEF4FB] to-[#E8F0FA] px-6 py-10">
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[#4A90D9]/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-8 h-64 w-64 rounded-full bg-[#7FB7EB]/25 blur-3xl" />

      <main className="relative w-full max-w-md rounded-3xl border border-white/60 bg-white/90 p-8 text-center shadow-[0_20px_70px_rgba(41,74,110,0.15)] backdrop-blur-sm sm:p-10">
        <p className="text-sm font-medium tracking-[0.2em] text-[#5E7FA2]">BIENVENUE</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[#17324D]">2nest 🪺</h1>
        <p className="mt-3 text-sm text-[#5D738A]">La co-parentalité sans le chaos</p>

        {configError && (
          <p className="mt-5 rounded-xl border border-[#E3B4B8] bg-[#FFF4F5] px-3 py-2 text-sm text-[#8D3E45]">
            {configError}
          </p>
        )}

        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl bg-[#4A90D9] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(74,144,217,0.35)] transition hover:brightness-105"
          >
            Se connecter
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-xl border border-[#CDE0F2] bg-white px-5 py-3 text-sm font-semibold text-[#2F6FAF] transition hover:bg-[#F3F8FD]"
          >
            S'inscrire
          </Link>
        </div>
      </main>
    </div>
  );
}