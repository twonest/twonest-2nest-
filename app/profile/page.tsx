"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type ParentRole = "parent1" | "parent2";

type ProfileData = {
 firstName: string;
 lastName: string;
 email: string;
 phone: string;
 street: string;
 city: string;
 province: string;
 postalCode: string;
 country: string;
 role: ParentRole;
 avatarUrl: string;
};

type CoParentSummary = {
 firstName: string;
 email: string;
 street: string;
 city: string;
 province: string;
 postalCode: string;
 country: string;
};

type ProfileRow = {
 id?: string;
 user_id?: string;
 email?: string;
 first_name?: string;
 prenom?: string;
 last_name?: string;
 nom?: string;
 phone?: string;
 telephone?: string;
 street?: string;
 address_line1?: string;
 city?: string;
 ville?: string;
 province?: string;
 postal_code?: string;
 code_postal?: string;
 country?: string;
 pays?: string;
 role?: string;
 avatar_url?: string;
 photo_url?: string;
};

type ToastState = {
 message: string;
 variant: "success" | "error";
};

const EMPTY_PROFILE: ProfileData = {
 firstName: "",
 lastName: "",
 email: "",
 phone: "",
 street: "",
 city: "",
 province: "",
 postalCode: "",
 country: "Canada",
 role: "parent1",
 avatarUrl: "",
};

function normalizeRole(value: string | undefined): ParentRole {
 const normalized = (value ?? "").toLowerCase();
 if (normalized.includes("2")) {
  return "parent2";
 }
 return "parent1";
}

function rowToProfile(row: ProfileRow, fallbackEmail: string): ProfileData {
 return {
  firstName: row.prenom ?? row.first_name ?? "",
  lastName: row.nom ?? row.last_name ?? "",
  email: row.email ?? fallbackEmail,
  phone: row.phone ?? row.telephone ?? "",
  street: row.street ?? row.address_line1 ?? "",
  city: row.city ?? row.ville ?? "",
  province: row.province ?? "",
  postalCode: row.postal_code ?? row.code_postal ?? "",
  country: row.country ?? row.pays ?? "Canada",
  role: normalizeRole(row.role),
  avatarUrl: row.avatar_url ?? row.photo_url ?? "",
 };
}

export default function ProfilePage() {
 const router = useRouter();
 const [user, setUser] = useState<User | null>(null);
 const [checkingSession, setCheckingSession] = useState(true);
 const [configError, setConfigError] = useState("");

 const [profile, setProfile] = useState<ProfileData>(EMPTY_PROFILE);
 const [coParent, setCoParent] = useState<CoParentSummary | null>(null);

 const [isLoadingProfile, setIsLoadingProfile] = useState(true);
 const [isSaving, setIsSaving] = useState(false);
 const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
 const [formError, setFormError] = useState("");
 const [toast, setToast] = useState<ToastState | null>(null);

 useEffect(() => {
  if (!toast) {
   return;
  }

  const timeout = setTimeout(() => setToast(null), 2500);
  return () => clearTimeout(timeout);
 }, [toast]);

 const refreshCoParent = async (currentRole: ParentRole, client = getSupabaseBrowserClient(), currentUser?: User) => {
  const oppositeRole = currentRole === "parent1" ? "parent2" : "parent1";

  let data: ProfileRow[] | null = null;
  let error: { message: string } | null = null;

  const withUserId = await client
   .from("profiles")
   .select("*")
   .eq("role", oppositeRole)
   .neq("user_id", currentUser?.id ?? "")
   .limit(1);

  data = withUserId.data as ProfileRow[] | null;
  error = withUserId.error;

  if (error) {
   const fallback = await client
    .from("profiles")
    .select("*")
    .eq("role", oppositeRole)
    .neq("id", currentUser?.id ?? "")
    .limit(1);

   data = fallback.data as ProfileRow[] | null;
   error = fallback.error;
  }

  if (error || !data || data.length === 0) {
   setCoParent(null);
   return;
  }

  const row = data[0];
  setCoParent({
   firstName: row.prenom ?? row.first_name ?? "",
   email: row.email ?? "",
   street: row.street ?? row.address_line1 ?? "",
   city: row.city ?? row.ville ?? "",
   province: row.province ?? "",
   postalCode: row.postal_code ?? row.code_postal ?? "",
   country: row.country ?? row.pays ?? "",
  });
 };

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
   setIsLoadingProfile(false);
   return;
  }

  const loadProfile = async () => {
   const { data: userData } = await supabase.auth.getUser();

   if (!userData.user) {
    router.replace("/");
    return;
   }

   const authUser = userData.user;
   setUser(authUser);
   setCheckingSession(false);

   const nowIso = new Date().toISOString();

   const byUserId = await supabase.from("profiles").select("*").eq("user_id", authUser.id).maybeSingle();
   if (!byUserId.error && byUserId.data?.id && byUserId.data.id !== authUser.id) {
    await supabase
     .from("profiles")
     .update({ id: authUser.id, updated_at: nowIso })
     .eq("id", byUserId.data.id);
   }

   let row: ProfileRow | null = null;
   const byId = await supabase.from("profiles").select("*").eq("id", authUser.id).maybeSingle();
   if (!byId.error && byId.data) {
    row = byId.data as ProfileRow;
   }

   if (!row) {
    const createPayload = {
     id: authUser.id,
     user_id: authUser.id,
     email: authUser.email ?? "",
     prenom: "",
     nom: "",
     first_name: "",
     last_name: "",
     country: "Canada",
     pays: "Canada",
     role: "parent1",
     created_at: nowIso,
     updated_at: nowIso,
    };

    await supabase.from("profiles").insert(createPayload);

    const created = await supabase.from("profiles").select("*").eq("id", authUser.id).maybeSingle();
    if (!created.error && created.data) {
     row = created.data as ProfileRow;
    }
   }

   const mapped = row ? rowToProfile(row, authUser.email ?? "") : { ...EMPTY_PROFILE, email: authUser.email ?? "" };
   setProfile(mapped);
   await refreshCoParent(mapped.role, supabase, authUser);

   setIsLoadingProfile(false);
  };

  loadProfile();

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

 const onFieldChange = (field: keyof ProfileData, value: string) => {
  setProfile((prev) => ({ ...prev, [field]: value }));
 };

 const onUploadPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file || !user) {
   return;
  }

  setIsUploadingPhoto(true);
  setFormError("");

  try {
   const supabase = getSupabaseBrowserClient();
   const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
   const path = `${user.id}/${Date.now()}.${extension}`;

   const { error } = await supabase.storage.from("avatars").upload(path, file, {
    upsert: true,
   });

   if (error) {
    setFormError(`${error.message}. Vérifie que le bucket 'avatars' existe et est accessible.`);
    return;
   }

   const {
    data: { publicUrl },
   } = supabase.storage.from("avatars").getPublicUrl(path);

   setProfile((prev) => ({ ...prev, avatarUrl: publicUrl }));
   setToast({ message: "Photo de profil mise à jour.", variant: "success" });
  } catch (error) {
   setFormError(error instanceof Error ? error.message : "Erreur pendant l'upload de la photo.");
  } finally {
   setIsUploadingPhoto(false);
   event.target.value = "";
  }
 };

 const onSaveProfile = async (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();

  if (!user || profile.firstName.trim().length === 0 || profile.lastName.trim().length === 0) {
   setFormError("Le prénom et le nom sont obligatoires.");
   return;
  }

  setIsSaving(true);
  setFormError("");

  try {
   const supabase = getSupabaseBrowserClient();
   const nowIso = new Date().toISOString();
   const firstName = profile.firstName.trim();
   const lastName = profile.lastName.trim();

   const payload = {
    id: user.id,
    user_id: user.id,
    email: profile.email,
    prenom: firstName,
    nom: lastName,
    first_name: firstName,
    last_name: lastName,
    phone: profile.phone.trim(),
    telephone: profile.phone.trim(),
    street: profile.street.trim(),
    address_line1: profile.street.trim(),
    city: profile.city.trim(),
    ville: profile.city.trim(),
    province: profile.province.trim(),
    postal_code: profile.postalCode.trim(),
    code_postal: profile.postalCode.trim(),
    country: profile.country.trim(),
    pays: profile.country.trim(),
    role: profile.role,
    avatar_url: profile.avatarUrl,
    photo_url: profile.avatarUrl,
    updated_at: nowIso,
   };

   const existing = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();

   if (existing.error) {
    setFormError(existing.error.message);
    return;
   }

   if (existing.data?.id) {
    const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);
    if (error) {
     setFormError(error.message);
     return;
    }
   } else {
    const { error } = await supabase.from("profiles").insert({
     ...payload,
     created_at: nowIso,
    });
    if (error) {
     setFormError(error.message);
     return;
    }
   }

   await supabase.auth.updateUser({
    data: {
     first_name: firstName,
     last_name: lastName,
     prenom: firstName,
     nom: lastName,
     name: `${firstName} ${lastName}`.trim(),
    },
   });

   await refreshCoParent(profile.role, supabase, user);
   setToast({ message: " Profil sauvegardé !", variant: "success" });
  } catch (error) {
   setFormError(error instanceof Error ? error.message : "Erreur pendant l'enregistrement du profil.");
  } finally {
   setIsSaving(false);
  }
 };

 const inviteLink = useMemo(() => {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://2nest.app";
  const subject = encodeURIComponent("Invitation sur 2nest");
  const body = encodeURIComponent(`Bonjour,\n\nJe t'invite à me rejoindre sur 2nest : ${origin}\n\nÀ bientôt !`);
  return `mailto:?subject=${subject}&body=${body}`;
 }, []);

 if (checkingSession || isLoadingProfile) {
  return (
   <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#F5F0EB] to-[#EDE8E3] px-6">
    <p className="text-sm font-medium text-[#6B5D55]">Chargement du profil...</p>
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
  <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#F5F0EB] via-[#EDE8E3] to-[#EDE8E3] px-4 py-8 sm:px-6 sm:py-10">
   <div className="pointer-events-none absolute -top-32 -left-24 h-80 w-80 rounded-full bg-[#7C6B5D]/20 blur-3xl" />
   <div className="pointer-events-none absolute right-0 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-[#A89080]/20 blur-3xl" />

   <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-6 rounded-3xl border border-white/70 bg-white/90 p-6 shadow-[0_2px_8px_rgba(44,36,32,0.08)] backdrop-blur-sm sm:p-8">
    <header className="flex flex-wrap items-center justify-between gap-3">
     <div>
      <p className="text-xs font-semibold tracking-[0.2em] text-[#A89080]">MON PROFIL</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#2C2420]"> Mon profil</h1>
     </div>

     <Link
      href="/dashboard"
      className="inline-flex items-center justify-center rounded-xl border border-[#D9D0C8] px-4 py-2 text-sm font-semibold text-[#6B5D55] transition hover:bg-[#EDE8E3]"
     >
      ← Retour
     </Link>
    </header>

    <section className="rounded-2xl border border-[#D9D0C8] bg-white p-4 shadow-[0_1px_4px_rgba(44,36,32,0.06)] sm:p-5">
     <p className="text-xs font-semibold tracking-[0.2em] text-[#A89080]">PROFIL DU PARENT</p>
     <h2 className="mb-4 mt-1 text-xl font-semibold text-[#2C2420]">Informations personnelles</h2>

     {formError && (
      <p className="mb-4 rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] px-4 py-3 text-sm text-[#A85C52]">{formError}</p>
     )}

     <form className="grid gap-3 sm:grid-cols-2" onSubmit={onSaveProfile}>
      <div className="sm:col-span-2 flex items-center gap-4 rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] p-3">
       <div className="h-16 w-16 overflow-hidden rounded-full border border-[#D9D0C8] bg-white">
        {profile.avatarUrl ? (
         // eslint-disable-next-line @next/next/no-img-element
         <img src={profile.avatarUrl} alt="Photo de profil" className="h-full w-full object-cover" />
        ) : (
         <div className="flex h-full w-full items-center justify-center text-2xl"></div>
        )}
       </div>
       <div className="flex-1">
        <label htmlFor="avatar" className="mb-1 block text-sm font-medium text-[#6B5D55]">
         Photo de profil
        </label>
        <input
         id="avatar"
         type="file"
         accept="image/*"
         onChange={onUploadPhoto}
         className="w-full text-sm text-[#6B5D55] file:mr-3 file:rounded-lg file:border-0 file:bg-[#EDE8E3] file:px-3 file:py-2 file:text-[#7C6B5D]"
        />
        <p className="mt-1 text-xs text-[#6B5D55]">{isUploadingPhoto ? "Upload en cours..." : "Formats image classiques acceptés"}</p>
       </div>
      </div>

      <div>
       <label htmlFor="firstName" className="mb-1 block text-sm font-medium text-[#6B5D55]">
        Prénom
       </label>
       <input
        id="firstName"
        type="text"
        value={profile.firstName}
        onChange={(event) => onFieldChange("firstName", event.target.value)}
        className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
       />
      </div>

      <div>
       <label htmlFor="lastName" className="mb-1 block text-sm font-medium text-[#6B5D55]">
        Nom
       </label>
       <input
        id="lastName"
        type="text"
        value={profile.lastName}
        onChange={(event) => onFieldChange("lastName", event.target.value)}
        className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
       />
      </div>

      <div>
       <label htmlFor="email" className="mb-1 block text-sm font-medium text-[#6B5D55]">
        Email
       </label>
       <input
        id="email"
        type="email"
        value={profile.email}
        disabled
        className="w-full rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] px-3 py-2.5 text-[#6A8199]"
       />
      </div>

      <div>
       <label htmlFor="phone" className="mb-1 block text-sm font-medium text-[#6B5D55]">
        Numéro de téléphone
       </label>
       <input
        id="phone"
        type="tel"
        value={profile.phone}
        onChange={(event) => onFieldChange("phone", event.target.value)}
        className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
       />
      </div>

      <div className="sm:col-span-2">
       <label htmlFor="street" className="mb-1 block text-sm font-medium text-[#6B5D55]">
        Numéro et rue
       </label>
       <input
        id="street"
        type="text"
        value={profile.street}
        onChange={(event) => onFieldChange("street", event.target.value)}
        className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
       />
      </div>

      <div>
       <label htmlFor="city" className="mb-1 block text-sm font-medium text-[#6B5D55]">
        Ville
       </label>
       <input
        id="city"
        type="text"
        value={profile.city}
        onChange={(event) => onFieldChange("city", event.target.value)}
        className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
       />
      </div>

      <div>
       <label htmlFor="province" className="mb-1 block text-sm font-medium text-[#6B5D55]">
        Province
       </label>
       <input
        id="province"
        type="text"
        value={profile.province}
        onChange={(event) => onFieldChange("province", event.target.value)}
        className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
       />
      </div>

      <div>
       <label htmlFor="postalCode" className="mb-1 block text-sm font-medium text-[#6B5D55]">
        Code postal
       </label>
       <input
        id="postalCode"
        type="text"
        value={profile.postalCode}
        onChange={(event) => onFieldChange("postalCode", event.target.value)}
        className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
       />
      </div>

      <div>
       <label htmlFor="country" className="mb-1 block text-sm font-medium text-[#6B5D55]">
        Pays
       </label>
       <input
        id="country"
        type="text"
        value={profile.country}
        onChange={(event) => onFieldChange("country", event.target.value)}
        className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
       />
      </div>

      <div className="sm:col-span-2">
       <label htmlFor="role" className="mb-1 block text-sm font-medium text-[#6B5D55]">
        Rôle
       </label>
       <select
        id="role"
        value={profile.role}
        onChange={(event) => onFieldChange("role", event.target.value as ParentRole)}
        className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
       >
        <option value="parent1">Parent 1</option>
        <option value="parent2">Parent 2</option>
       </select>
      </div>

      <button
       type="submit"
       disabled={isSaving || isUploadingPhoto}
       className="sm:col-span-2 mt-1 w-full rounded-xl bg-[#7C6B5D] px-4 py-3 text-sm font-semibold text-white shadow-[0_1px_4px_rgba(44,36,32,0.12)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
      >
       {isSaving ? "Enregistrement..." : "Enregistrer le profil"}
      </button>
     </form>
    </section>

    <section className="rounded-2xl border border-[#D9D0C8] bg-white p-4 shadow-[0_1px_4px_rgba(44,36,32,0.06)] sm:p-5">
     <p className="text-xs font-semibold tracking-[0.2em] text-[#A89080]">MON CO-PARENT</p>
     <h2 className="mb-4 mt-1 text-xl font-semibold text-[#2C2420]">Informations co-parent</h2>

     {coParent ? (
      <div className="rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] p-4 text-sm text-[#6B5D55]">
       <p><span className="font-semibold">Prénom :</span> {coParent.firstName || "—"}</p>
       <p className="mt-1"><span className="font-semibold">Email :</span> {coParent.email || "—"}</p>
       <p className="mt-1"><span className="font-semibold">Adresse :</span> {[coParent.street, coParent.city, coParent.province, coParent.postalCode, coParent.country].filter(Boolean).join(", ") || "—"}</p>
      </div>
     ) : (
      <div className="rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] p-4">
       <p className="text-sm text-[#6B5D55]">Aucun co-parent connecté pour le moment.</p>
       <a
        href={inviteLink}
        className="mt-3 inline-flex items-center justify-center rounded-xl bg-[#7C6B5D] px-4 py-2 text-sm font-semibold text-white shadow-[0_1px_4px_rgba(44,36,32,0.12)] transition hover:brightness-105"
       >
        Inviter mon co-parent
       </a>
      </div>
     )}
    </section>
   </main>

   {toast && (
    <div
     className={`fixed right-4 bottom-4 z-[60] max-w-sm rounded-xl border px-4 py-3 text-sm font-medium shadow-[0_14px_30px_rgba(45,105,64,0.2)] ${
      toast.variant === "success"
       ? "border-[#D9D0C8] bg-[#EDE8E3] text-[#6B8F71]"
       : "border-[#D9D0C8] bg-[#F5F0EB] text-[#A85C52]"
     }`}
    >
     {toast.message}
    </div>
   )}
  </div>
 );
}