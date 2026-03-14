"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function SignupPage() {
 const router = useRouter();
 const [email, setEmail] = useState("");
 const [password, setPassword] = useState("");
 const [isLoading, setIsLoading] = useState(false);
 const [errorMessage, setErrorMessage] = useState("");
 const [successMessage, setSuccessMessage] = useState("");
 const [configError, setConfigError] = useState("");

 const canSubmit = useMemo(() => email.trim().length > 0 && password.length > 0, [email, password]);

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

 const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();

  if (!canSubmit) {
   setErrorMessage("Entre ton email et ton mot de passe.");
   setSuccessMessage("");
   return;
  }

  setIsLoading(true);
  setErrorMessage("");
  setSuccessMessage("");

  try {
   const supabase = getSupabaseBrowserClient();
   const { error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
   });

   if (error) {
    setErrorMessage(error.message);
    return;
   }

   setSuccessMessage("Compte cree. Verifie ton email pour confirmer ton inscription.");
  } catch (error) {
   setErrorMessage(
    error instanceof Error
     ? error.message
     : "Une erreur est survenue pendant l'inscription.",
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
     <p className="text-sm font-medium tracking-[0.2em] text-[#A89080]">INSCRIPTION</p>
     <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[#2C2420]">2nest </h1>
     <p className="mt-3 text-sm text-[#6B5D55]">Créez votre espace de co-parentalité.</p>
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
       autoComplete="new-password"
       placeholder="••••••••"
       value={password}
       onChange={(event) => setPassword(event.target.value)}
       className="w-full rounded-xl border border-[#D9D0C8] bg-white px-4 py-3 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
      />
     </div>

     {(errorMessage || successMessage) && (
      <p
       className={`rounded-xl border px-3 py-2 text-sm ${
        errorMessage
         ? "border-[#D9D0C8] bg-[#F5F0EB] text-[#A85C52]"
         : "border-[#D9D0C8] bg-[#EDE8E3] text-[#6B8F71]"
       }`}
      >
       {errorMessage || successMessage}
      </p>
     )}

     <button
      type="submit"
      disabled={isLoading || Boolean(configError)}
      className="mt-2 w-full rounded-xl bg-[#7C6B5D] px-4 py-3 text-sm font-semibold text-white shadow-[0_1px_4px_rgba(44,36,32,0.12)] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#7C6B5D]/30 disabled:cursor-not-allowed disabled:opacity-70"
     >
      {isLoading ? "Creation..." : "S'inscrire"}
     </button>
    </form>

    <p className="mt-6 text-center text-sm text-[#6B5D55]">
     Déjà inscrit ?{" "}
     <Link href="/login" className="font-semibold text-[#7C6B5D] underline-offset-4 transition hover:underline">
      Se connecter
     </Link>
    </p>
   </main>
  </div>
 );
}