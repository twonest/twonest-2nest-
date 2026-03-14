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
  <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-[#F5F0EB] via-[#EDE8E3] to-[#EDE8E3] px-6 py-10">
   <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[#7C6B5D]/20 blur-3xl" />
   <div className="pointer-events-none absolute -right-20 bottom-8 h-64 w-64 rounded-full bg-[#A89080]/25 blur-3xl" />

   <main className="relative w-full max-w-md rounded-3xl border border-white/60 bg-white/90 p-8 text-center shadow-[0_2px_8px_rgba(44,36,32,0.08)] backdrop-blur-sm sm:p-10">
    <p className="text-sm font-medium tracking-[0.2em] text-[#A89080]">BIENVENUE</p>
    <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[#2C2420]">2nest </h1>
    <p className="mt-3 text-sm text-[#6B5D55]">La co-parentalité sans le chaos</p>

    {configError && (
     <p className="mt-5 rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] px-3 py-2 text-sm text-[#A85C52]">
      {configError}
     </p>
    )}

    <div className="mt-8 flex items-center justify-center gap-3">
     <Link
      href="/login"
      className="inline-flex items-center justify-center rounded-xl bg-[#7C6B5D] px-5 py-3 text-sm font-semibold text-white shadow-[0_1px_4px_rgba(44,36,32,0.12)] transition hover:brightness-105"
     >
      Se connecter
     </Link>
     <Link
      href="/signup"
      className="inline-flex items-center justify-center rounded-xl border border-[#D9D0C8] bg-white px-5 py-3 text-sm font-semibold text-[#7C6B5D] transition hover:bg-[#F5F0EB]"
     >
      S'inscrire
     </Link>
    </div>
   </main>
  </div>
 );
}