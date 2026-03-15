"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function LoginPage() {
 const router = useRouter();
 const [email, setEmail] = useState("");
 const [password, setPassword] = useState("");
 const [isLoading, setIsLoading] = useState(false);
 const [errorMessage, setErrorMessage] = useState("");
 const [configError, setConfigError] = useState("");

 const canSubmit = useMemo(() => email.trim().length > 0 && password.length > 0, [email, password]);

 useEffect(() => {
  try {
   const supabase = getSupabaseBrowserClient();

   supabase.auth.getSession().then(({ data }) => {
    if (!data.session?.user) {
     return;
    }

    router.replace("/dashboard");
   });
  } catch (error) {
   setConfigError(
    error instanceof Error
     ? error.message
     : "Configuration Supabase manquante. Redemarre le serveur Next.js.",
   );
  }
 }, [router]);

 const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  console.log("[Login] Clic sur Se connecter", { email: email.trim() });

  if (!canSubmit) {
   setErrorMessage("Entre ton email et ton mot de passe.");
   console.error("[Login] Validation erreur: email ou mot de passe manquant");
   return;
  }

  setIsLoading(true);
  setErrorMessage("");

  try {
   const supabase = getSupabaseBrowserClient();
    const authResponse = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
   });

    console.log("[Login] Reponse Supabase Auth", {
     hasSession: Boolean(authResponse.data.session),
     hasUser: Boolean(authResponse.data.user),
     error: authResponse.error?.message ?? null,
    });

    const { error } = authResponse;

   if (error) {
     console.error("[Login] Erreur Supabase Auth", error);
    setErrorMessage(error.message);
    return;
   }

  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    console.error("[Login] Erreur: utilisateur absent apres connexion");
   setErrorMessage("Session introuvable après connexion.");
   return;
  }

    console.log("[Login] Redirection post-auth", { destination: "/dashboard" });
  router.replace("/dashboard");
  } catch (error) {
    console.error("[Login] Exception inattendue", error);
   setErrorMessage(
    error instanceof Error
     ? error.message
     : "Une erreur est survenue pendant la connexion.",
   );
  } finally {
   setIsLoading(false);
  }
 };

 return (
  <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-[#F5F0EB] via-[#EDE8E3] to-[#EDE8E3] px-6 py-10">
   <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[#7C6B5D]/20 blur-3xl" />
   <div className="pointer-events-none absolute -right-20 bottom-8 h-64 w-64 rounded-full bg-[#A89080]/25 blur-3xl" />

   <main className="relative w-full max-w-md rounded-3xl border border-white/60 bg-white/90 p-8 shadow-[0_2px_8px_rgba(44,36,32,0.08)] backdrop-blur-sm sm:p-10">
    <header className="mb-8 text-center">
     <p className="text-sm font-medium tracking-[0.2em] text-[#A89080]">CONNEXION</p>
     <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[#2C2420]">2nest </h1>
     <p className="mt-3 text-sm text-[#6B5D55]">Heureux de vous revoir.</p>
    </header>

    {configError && (
     <p className="mb-4 rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] px-3 py-2 text-sm text-[#A85C52]">
      {configError}
     </p>
    )}

    <form className="space-y-5" onSubmit={onSubmit}>
     <div className="space-y-2">
      <label htmlFor="email" className="block text-sm font-medium text-[#6B5D55]">
       Email
      </label>
      <input
       id="email"
       name="email"
       type="email"
       autoComplete="email"
       placeholder="nom@exemple.com"
       value={email}
       onChange={(event) => setEmail(event.target.value)}
       className="w-full rounded-xl border border-[#D9D0C8] bg-white px-4 py-3 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
      />
     </div>

     <div className="space-y-2">
      <label htmlFor="password" className="block text-sm font-medium text-[#6B5D55]">
       Mot de passe
      </label>
      <input
       id="password"
       name="password"
       type="password"
       autoComplete="current-password"
       placeholder="••••••••"
       value={password}
       onChange={(event) => setPassword(event.target.value)}
       className="w-full rounded-xl border border-[#D9D0C8] bg-white px-4 py-3 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
      />
     </div>

     {errorMessage && (
      <p className="rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] px-3 py-2 text-sm text-[#A85C52]">{errorMessage}</p>
     )}

     <button
      type="submit"
      onClick={() => console.log("[Login] Bouton Se connecter clique")}
      disabled={isLoading || Boolean(configError)}
      className="mt-2 w-full rounded-xl bg-[#7C6B5D] px-4 py-3 text-sm font-semibold text-white shadow-[0_1px_4px_rgba(44,36,32,0.12)] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#7C6B5D]/30 disabled:cursor-not-allowed disabled:opacity-70"
     >
      {isLoading ? "Connexion..." : "Se connecter"}
     </button>
    </form>

    <p className="mt-6 text-center text-sm text-[#6B5D55]">
     Pas encore de compte ?{" "}
     <Link href="/signup" className="font-semibold text-[#7C6B5D] underline-offset-4 transition hover:underline">
      S'inscrire
     </Link>
    </p>
   </main>
  </div>
 );
}