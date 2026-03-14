"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { FAMILY_TYPE_OPTIONS, type FamilyType } from "@/lib/family";
import { useFamily } from "@/components/FamilyProvider";

function NewSpaceForm() {
 const router = useRouter();
 const searchParams = useSearchParams();
 const { user, refreshFamilies, loading } = useFamily();
 const [familyType, setFamilyType] = useState<FamilyType>("family");
 const [familyName, setFamilyName] = useState("");
 const [isSaving, setIsSaving] = useState(false);
 const [errorMessage, setErrorMessage] = useState("");

 const isFirst = searchParams.get("first") === "1";
 const canSubmit = useMemo(() => familyName.trim().length > 0, [familyName]);

 const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();

  if (!user || !canSubmit) {
   setErrorMessage("Le nom de l’espace est obligatoire.");
   return;
  }

  setIsSaving(true);
  setErrorMessage("");

  try {
   const supabase = getSupabaseBrowserClient();
   const { data: familyRow, error: familyError } = await supabase
    .from("families")
    .insert({
     name: familyName.trim(),
     type: familyType,
     created_by: user.id,
    })
    .select("id")
    .maybeSingle();

   if (familyError || !familyRow?.id) {
    throw new Error(familyError?.message ?? "Impossible de créer cet espace.");
   }

   const { error: memberError } = await supabase.from("family_members").insert({
    family_id: familyRow.id,
    user_id: user.id,
    role: "parent",
    status: "active",
   });

   if (memberError) {
    throw new Error(memberError.message);
   }

   await refreshFamilies();
   window.localStorage.setItem("twonest.activeFamilyId", familyRow.id);
   router.replace("/dashboard");
  } catch (error) {
   setErrorMessage(error instanceof Error ? error.message : "Erreur pendant la création de l’espace.");
  } finally {
   setIsSaving(false);
  }
 };

 if (loading) {
  return (
   <div className="flex min-h-screen items-center justify-center bg-[#F5F0EB] px-6">
    <p className="text-sm font-medium text-[#6B5D55]">Chargement...</p>
   </div>
  );
 }

 return (
  <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-[#F5F0EB] via-[#F0E8E0] to-[#EDE8E3] px-6 py-10">
   <div className="pointer-events-none absolute -top-24 left-0 h-72 w-72 rounded-full bg-[#D8C6B5]/30 blur-3xl" />
   <div className="pointer-events-none absolute -right-10 bottom-0 h-64 w-64 rounded-full bg-[#C9D7E8]/30 blur-3xl" />

   <main className="relative w-full max-w-2xl rounded-3xl border border-white/60 bg-white/90 p-8 shadow-[0_24px_80px_rgba(44,36,32,0.12)] backdrop-blur-sm sm:p-10">
    <header className="mb-8">
     <p className="text-sm font-medium tracking-[0.2em] text-[#A89080]">VOTRE ESPACE</p>
     <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[#2C2420]">
      {isFirst ? "Créer votre premier espace" : "Créer un nouvel espace"}
     </h1>
     <p className="mt-3 text-sm text-[#6B5D55]">
      Un même compte peut gérer plusieurs espaces familiaux totalement séparés. Choisissez le type et le nom de cet espace.
     </p>
    </header>

    <form className="space-y-6" onSubmit={onSubmit}>
     <div>
      <label className="mb-2 block text-sm font-semibold text-[#6B5D55]">Type d’espace</label>
      <div className="grid gap-3 sm:grid-cols-3">
       {FAMILY_TYPE_OPTIONS.map((option) => {
        const active = option.value === familyType;
        return (
         <button
          key={option.value}
          type="button"
          onClick={() => setFamilyType(option.value)}
          className={`rounded-2xl border px-4 py-4 text-left transition ${
           active ? "border-[#7C6B5D] bg-[#F5F0EB]" : "border-[#D9D0C8] bg-white hover:bg-[#F8F3EE]"
          }`}
         >
          <p className="font-semibold text-[#2C2420]">{option.label}</p>
          <p className="mt-1 text-sm text-[#6B5D55]">{option.description}</p>
         </button>
        );
       })}
      </div>
     </div>

     <div>
      <label htmlFor="family-name" className="mb-2 block text-sm font-semibold text-[#6B5D55]">
       Nom de l’espace
      </label>
      <input
       id="family-name"
       value={familyName}
       onChange={(event) => setFamilyName(event.target.value)}
       placeholder="Ex: Marie & Albert"
       className="w-full rounded-2xl border border-[#D9D0C8] bg-white px-4 py-3 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
      />
     </div>

     {errorMessage && (
      <p className="rounded-xl border border-[#E5D7CB] bg-[#FFF5F0] px-4 py-3 text-sm text-[#A85C52]">{errorMessage}</p>
     )}

     <button
      type="submit"
      disabled={isSaving}
      className="w-full rounded-2xl bg-[#7C6B5D] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(124,107,93,0.28)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
     >
      {isSaving ? "Création..." : isFirst ? "Créer mon premier espace" : "Créer cet espace"}
     </button>
    </form>
   </main>
  </div>
 );
}

export default function NewSpacePage() {
 return (
  <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#F5F0EB] px-6"><p className="text-sm font-medium text-[#6B5D55]">Chargement...</p></div>}>
   <NewSpaceForm />
  </Suspense>
 );
}