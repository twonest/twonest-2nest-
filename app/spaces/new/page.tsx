"use client";

import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { FAMILY_TYPE_OPTIONS, type FamilyType } from "@/lib/family";
import { useFamily } from "@/components/FamilyProvider";

type ExistingChild = {
 id: string;
 firstName: string;
 lastName: string;
 birthDate: string;
 familyId: string | null;
};

type NewChildDraft = {
 id: string;
 firstName: string;
 lastName: string;
 birthDate: string;
};

type ChildRow = {
 id?: string | number;
 first_name?: string;
 prenom?: string;
 last_name?: string;
 nom?: string;
 birth_date?: string;
 date_naissance?: string;
 family_id?: string;
};

function extractMissingColumn(message: string): string | null {
 const match = message.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+does not exist/i);
 if (match?.[1]) {
  return match[1];
 }

 const cacheMatch = message.match(/Could not find the ['\"]?([a-zA-Z0-9_]+)['\"]? column/i);
 return cacheMatch?.[1] ?? null;
}

function randomId(): string {
 return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function NewSpaceForm() {
 const router = useRouter();
 const searchParams = useSearchParams();
 const { user, refreshFamilies, loading } = useFamily();
 const [familyType, setFamilyType] = useState<FamilyType>("family");
 const [familyName, setFamilyName] = useState("");
 const [isSaving, setIsSaving] = useState(false);
 const [errorMessage, setErrorMessage] = useState("");
 const [existingChildren, setExistingChildren] = useState<ExistingChild[]>([]);
 const [selectedExistingChildren, setSelectedExistingChildren] = useState<string[]>([]);
 const [newChildren, setNewChildren] = useState<NewChildDraft[]>([]);
 const [childrenLoadedForUserId, setChildrenLoadedForUserId] = useState<string | null>(null);

 const isFirst = searchParams.get("first") === "1";
 const canSubmit = useMemo(() => familyName.trim().length > 0, [familyName]);

 const loadExistingChildren = useCallback(async (userId: string) => {
  try {
   const supabase = getSupabaseBrowserClient();
   const { data, error } = await supabase
    .from("children")
    .select("id, first_name, prenom, last_name, nom, birth_date, date_naissance, family_id")
     .eq("user_id", userId)
    .order("created_at", { ascending: true });

   if (error) {
    throw new Error(error.message);
   }

   const mapped = ((data ?? []) as ChildRow[])
    .map((row): ExistingChild | null => {
     const id = row.id ? String(row.id) : "";
     if (!id) {
      return null;
     }

     return {
      id,
      firstName: row.first_name ?? row.prenom ?? "",
      lastName: row.last_name ?? row.nom ?? "",
      birthDate: row.birth_date ?? row.date_naissance ?? "",
      familyId: typeof row.family_id === "string" ? row.family_id : null,
     };
    })
    .filter((item): item is ExistingChild => item !== null);

   setExistingChildren(mapped);
  } catch (error) {
   setErrorMessage(error instanceof Error ? error.message : "Impossible de charger les enfants existants.");
  }
 }, []);

 useEffect(() => {
  if (!user || childrenLoadedForUserId === user.id) {
   return;
  }

  setChildrenLoadedForUserId(user.id);
    void loadExistingChildren(user.id);
 }, [childrenLoadedForUserId, loadExistingChildren, user]);

 const toggleExistingChild = (childId: string) => {
  setSelectedExistingChildren((current) =>
   current.includes(childId) ? current.filter((id) => id !== childId) : [...current, childId],
  );
 };

 const addNewChildDraft = () => {
  setNewChildren((current) => [...current, { id: randomId(), firstName: "", lastName: "", birthDate: "" }]);
 };

 const updateNewChildDraft = (draftId: string, key: "firstName" | "lastName" | "birthDate", value: string) => {
  setNewChildren((current) => current.map((draft) => (draft.id === draftId ? { ...draft, [key]: value } : draft)));
 };

 const removeNewChildDraft = (draftId: string) => {
  setNewChildren((current) => current.filter((draft) => draft.id !== draftId));
 };

 const assignExistingChildToFamily = async (childId: string, familyId: string, userId: string) => {
  const supabase = getSupabaseBrowserClient();
  let payload: Record<string, unknown> = {
   family_id: familyId,
   user_id: userId,
  };

  for (let attempt = 0; attempt < 8; attempt += 1) {
   const result = await supabase.from("children").update(payload).eq("id", childId);
   if (!result.error) {
    return;
   }

   const missing = extractMissingColumn(result.error.message);
   if (missing && Object.prototype.hasOwnProperty.call(payload, missing)) {
    const next = { ...payload };
    delete next[missing];
    payload = next;
    continue;
   }

   throw new Error(result.error.message);
  }
 };

 const createChildInFamily = async (child: NewChildDraft, familyId: string, userId: string) => {
  const supabase = getSupabaseBrowserClient();
  const lastName = child.lastName.trim() || null;

  let payload: Record<string, unknown> = {
   user_id: userId,
   family_id: familyId,
   first_name: child.firstName.trim(),
   prenom: child.firstName.trim(),
   last_name: lastName,
   nom: lastName,
   birth_date: child.birthDate || null,
   date_naissance: child.birthDate || null,
  };

  for (let attempt = 0; attempt < 12; attempt += 1) {
   const result = await supabase.from("children").insert(payload).select("id").maybeSingle();
   if (!result.error) {
    return;
   }

   const missing = extractMissingColumn(result.error.message);
   if (missing && Object.prototype.hasOwnProperty.call(payload, missing)) {
    const next = { ...payload };
    delete next[missing];
    payload = next;
    continue;
   }

   throw new Error(result.error.message);
  }
 };

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

    for (const childId of selectedExistingChildren) {
     await assignExistingChildToFamily(childId, familyRow.id, user.id);
    }

    for (const child of newChildren) {
     if (!child.firstName.trim()) {
      continue;
     }
     await createChildInFamily(child, familyRow.id, user.id);
    }

   await refreshFamilies();
   window.localStorage.setItem("twonest.activeFamilyId", familyRow.id);
    window.localStorage.setItem("twonest.selectedChildId", "all");
    window.localStorage.setItem("twonest.selectedChildName", "");
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

    <section className="rounded-2xl border border-[#D9D0C8] bg-[#F8F3EE] p-4">
     <p className="text-sm font-semibold text-[#6B5D55]">Quels enfants sont dans cet espace ?</p>
     <p className="mt-1 text-sm text-[#6B5D55]">Sélectionne des enfants existants ou ajoute-en un nouveau pour cet espace.</p>

     <div className="mt-4 space-y-2">
      {existingChildren.length === 0 ? (
       <p className="text-sm text-[#6B5D55]">Aucun enfant existant à rattacher.</p>
      ) : (
       existingChildren.map((child) => {
        const checked = selectedExistingChildren.includes(child.id);
        const displayName = `${child.firstName} ${child.lastName}`.trim() || "Enfant";
        return (
        <label key={child.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#D9D0C8] bg-white px-3 py-2">
         <div className="flex items-center gap-2">
          <input
           type="checkbox"
           checked={checked}
           onChange={() => toggleExistingChild(child.id)}
           className="h-4 w-4 rounded border-[#D9D0C8] text-[#7C6B5D]"
          />
          <span className="text-sm font-medium text-[#2C2420]">{displayName}</span>
         </div>
         {child.familyId ? <span className="text-xs text-[#6B5D55]">Déjà dans un espace</span> : <span className="text-xs text-[#6B5D55]">Sans espace</span>}
        </label>
        );
       })
      )}
     </div>

     <button
      type="button"
      onClick={addNewChildDraft}
      className="mt-4 rounded-xl border border-[#D9D0C8] bg-white px-4 py-2 text-sm font-semibold text-[#7C6B5D] transition hover:bg-[#F5F0EB]"
     >
      + Ajouter un nouvel enfant
     </button>

     {newChildren.length > 0 && (
      <div className="mt-4 space-y-3">
       {newChildren.map((draft) => (
        <div key={draft.id} className="rounded-xl border border-[#D9D0C8] bg-white p-3">
        <div className="grid gap-3 sm:grid-cols-3">
         <input
          value={draft.firstName}
          onChange={(event) => updateNewChildDraft(draft.id, "firstName", event.target.value)}
          placeholder="Prénom *"
          className="rounded-xl border border-[#D9D0C8] px-3 py-2 text-sm text-[#2C2420] outline-none focus:border-[#7C6B5D]"
         />
         <input
          value={draft.lastName}
          onChange={(event) => updateNewChildDraft(draft.id, "lastName", event.target.value)}
          placeholder="Nom"
          className="rounded-xl border border-[#D9D0C8] px-3 py-2 text-sm text-[#2C2420] outline-none focus:border-[#7C6B5D]"
         />
         <input
          type="date"
          value={draft.birthDate}
          onChange={(event) => updateNewChildDraft(draft.id, "birthDate", event.target.value)}
          className="rounded-xl border border-[#D9D0C8] px-3 py-2 text-sm text-[#2C2420] outline-none focus:border-[#7C6B5D]"
         />
        </div>
        <button
         type="button"
         onClick={() => removeNewChildDraft(draft.id)}
         className="mt-3 text-xs font-semibold text-[#A85C52]"
        >
         Retirer
        </button>
        </div>
       ))}
      </div>
     )}
    </section>

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