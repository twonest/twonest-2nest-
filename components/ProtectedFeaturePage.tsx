"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type ProtectedFeaturePageProps = {
 title: string;
};

export default function ProtectedFeaturePage({ title }: ProtectedFeaturePageProps) {
 const router = useRouter();
 const [checkingSession, setCheckingSession] = useState(true);
 const [configError, setConfigError] = useState("");

 useEffect(() => {
  let supabase;

  try {
   supabase = getSupabaseBrowserClient();
  } catch (error) {
   setConfigError(
    error instanceof Error
     ? error.message
     : "Configuration Supabase manquante. Redemarre le serveur Next.js.",
   );
   setCheckingSession(false);
   return;
  }

  const loadUser = async () => {
   const { data } = await supabase.auth.getUser();

   if (!data.user) {
    router.replace("/");
    return;
   }

   setCheckingSession(false);
  };

  loadUser();

  const {
   data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
   if (!session?.user) {
    router.replace("/");
   }
  });

  return () => {
   subscription.unsubscribe();
  };
 }, [router]);

 if (checkingSession) {
  return (
   <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#F5F0EB] to-[#EDE8E3] px-6">
    <p className="text-sm font-medium text-[#6B5D55]">Chargement de votre espace 2nest...</p>
   </div>
  );
 }

 if (configError) {
  return (
   <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#F5F0EB] to-[#EDE8E3] px-6">
    <p className="max-w-xl text-center text-sm font-medium text-[#A85C52]">{configError}</p>
   </div>
  );
 }

 return (
  <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#F5F0EB] via-[#EDE8E3] to-[#EDE8E3] px-6 py-10">
   <div className="pointer-events-none absolute -top-32 -left-24 h-80 w-80 rounded-full bg-[#7C6B5D]/20 blur-3xl" />
   <div className="pointer-events-none absolute right-0 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-[#A89080]/20 blur-3xl" />

   <main className="relative mx-auto flex min-h-[70vh] w-full max-w-4xl flex-col rounded-3xl border border-white/70 bg-white/90 p-8 shadow-[0_2px_8px_rgba(44,36,32,0.08)] backdrop-blur-sm sm:p-10">
    <header className="flex items-center justify-between gap-4">
     <h1 className="text-3xl font-semibold tracking-tight text-[#2C2420]">{title}</h1>
     <Link
      href="/dashboard"
      className="inline-flex items-center justify-center rounded-xl border border-[#D9D0C8] px-4 py-2 text-sm font-semibold text-[#6B5D55] transition hover:bg-[#EDE8E3]"
     >
      ← Retour
     </Link>
    </header>

    <section className="flex flex-1 items-center justify-center">
     <p className="rounded-2xl border border-[#D9D0C8] bg-white px-8 py-6 text-center text-lg font-medium text-[#2C2420] shadow-[0_10px_28px_rgba(74,144,217,0.12)]">
      Fonctionnalite bientot disponible
     </p>
    </section>
   </main>
  </div>
 );
}
