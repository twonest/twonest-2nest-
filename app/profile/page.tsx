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
    firstName: row.first_name ?? row.prenom ?? "",
    lastName: row.last_name ?? row.nom ?? "",
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
      firstName: row.first_name ?? row.prenom ?? "",
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

      const byUserId = await supabase.from("profiles").select("*").eq("user_id", authUser.id).limit(1);

      let row: ProfileRow | null = null;
      if (!byUserId.error && byUserId.data && byUserId.data.length > 0) {
        row = byUserId.data[0] as ProfileRow;
      } else {
        const byId = await supabase.from("profiles").select("*").eq("id", authUser.id).limit(1);
        if (!byId.error && byId.data && byId.data.length > 0) {
          row = byId.data[0] as ProfileRow;
        }
      }

      if (row) {
        const mapped = rowToProfile(row, authUser.email ?? "");
        setProfile(mapped);
        await refreshCoParent(mapped.role, supabase, authUser);
      } else {
        const initial = {
          ...EMPTY_PROFILE,
          email: authUser.email ?? "",
        };
        setProfile(initial);
        await refreshCoParent(initial.role, supabase, authUser);
      }

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
      const common = {
        email: profile.email,
        role: profile.role,
        updated_at: new Date().toISOString(),
      };

      const payloadVariants = [
        {
          ...common,
          user_id: user.id,
          first_name: profile.firstName.trim(),
          last_name: profile.lastName.trim(),
          phone: profile.phone.trim(),
          street: profile.street.trim(),
          city: profile.city.trim(),
          province: profile.province.trim(),
          postal_code: profile.postalCode.trim(),
          country: profile.country.trim(),
          avatar_url: profile.avatarUrl,
        },
        {
          ...common,
          id: user.id,
          prenom: profile.firstName.trim(),
          nom: profile.lastName.trim(),
          telephone: profile.phone.trim(),
          address_line1: profile.street.trim(),
          ville: profile.city.trim(),
          province: profile.province.trim(),
          code_postal: profile.postalCode.trim(),
          pays: profile.country.trim(),
          photo_url: profile.avatarUrl,
        },
      ];

      const conflictTargets: Array<"user_id" | "id"> = ["user_id", "id"];
      let saved = false;
      let lastError: string | null = null;

      for (let index = 0; index < payloadVariants.length; index += 1) {
        const payload = payloadVariants[index];
        const conflict = conflictTargets[index];
        const { error } = await supabase.from("profiles").upsert(payload, { onConflict: conflict });

        if (!error) {
          saved = true;
          break;
        }

        lastError = error.message;
      }

      if (!saved) {
        setFormError(lastError ?? "Impossible d'enregistrer le profil.");
        return;
      }

      await supabase.auth.updateUser({
        data: {
          first_name: profile.firstName.trim(),
          last_name: profile.lastName.trim(),
          prenom: profile.firstName.trim(),
          nom: profile.lastName.trim(),
          name: `${profile.firstName.trim()} ${profile.lastName.trim()}`.trim(),
        },
      });

      await refreshCoParent(profile.role, supabase, user);
      setToast({ message: "Profil enregistré.", variant: "success" });
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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#F6FAFF] to-[#EEF5FC] px-6">
        <p className="text-sm font-medium text-[#5B7691]">Chargement du profil...</p>
      </div>
    );
  }

  if (configError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#F6FAFF] to-[#EEF5FC] px-6">
        <p className="max-w-xl text-center text-sm font-medium text-[#8D3E45]">{configError}</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#F6FAFF] via-[#F0F7FE] to-[#EAF3FC] px-4 py-8 sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute -top-32 -left-24 h-80 w-80 rounded-full bg-[#4A90D9]/20 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-[#80B7EA]/20 blur-3xl" />

      <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-6 rounded-3xl border border-white/70 bg-white/90 p-6 shadow-[0_24px_80px_rgba(38,78,120,0.12)] backdrop-blur-sm sm:p-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-[#5F81A3]">MON PROFIL</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#17324D]">👤 Mon profil</h1>
          </div>

          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-xl border border-[#D0DFEE] px-4 py-2 text-sm font-semibold text-[#365A7B] transition hover:bg-[#F1F7FD]"
          >
            ← Retour
          </Link>
        </header>

        <section className="rounded-2xl border border-[#D7E6F4] bg-white p-4 shadow-[0_10px_28px_rgba(74,144,217,0.08)] sm:p-5">
          <p className="text-xs font-semibold tracking-[0.2em] text-[#5F81A3]">PROFIL DU PARENT</p>
          <h2 className="mb-4 mt-1 text-xl font-semibold text-[#17324D]">Informations personnelles</h2>

          {formError && (
            <p className="mb-4 rounded-xl border border-[#E3B4B8] bg-[#FFF4F5] px-4 py-3 text-sm text-[#8D3E45]">{formError}</p>
          )}

          <form className="grid gap-3 sm:grid-cols-2" onSubmit={onSaveProfile}>
            <div className="sm:col-span-2 flex items-center gap-4 rounded-xl border border-[#D8E4F0] bg-[#F8FBFF] p-3">
              <div className="h-16 w-16 overflow-hidden rounded-full border border-[#D0DFEE] bg-white">
                {profile.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatarUrl} alt="Photo de profil" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl">👤</div>
                )}
              </div>
              <div className="flex-1">
                <label htmlFor="avatar" className="mb-1 block text-sm font-medium text-[#2D4B68]">
                  Photo de profil
                </label>
                <input
                  id="avatar"
                  type="file"
                  accept="image/*"
                  onChange={onUploadPhoto}
                  className="w-full text-sm text-[#2D4B68] file:mr-3 file:rounded-lg file:border-0 file:bg-[#E8F2FC] file:px-3 file:py-2 file:text-[#2E6395]"
                />
                <p className="mt-1 text-xs text-[#5E7A95]">{isUploadingPhoto ? "Upload en cours..." : "Formats image classiques acceptés"}</p>
              </div>
            </div>

            <div>
              <label htmlFor="firstName" className="mb-1 block text-sm font-medium text-[#2D4B68]">
                Prénom
              </label>
              <input
                id="firstName"
                type="text"
                value={profile.firstName}
                onChange={(event) => onFieldChange("firstName", event.target.value)}
                className="w-full rounded-xl border border-[#D8E4F0] px-3 py-2.5 text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
              />
            </div>

            <div>
              <label htmlFor="lastName" className="mb-1 block text-sm font-medium text-[#2D4B68]">
                Nom
              </label>
              <input
                id="lastName"
                type="text"
                value={profile.lastName}
                onChange={(event) => onFieldChange("lastName", event.target.value)}
                className="w-full rounded-xl border border-[#D8E4F0] px-3 py-2.5 text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-[#2D4B68]">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={profile.email}
                disabled
                className="w-full rounded-xl border border-[#D8E4F0] bg-[#F4F8FC] px-3 py-2.5 text-[#6A8199]"
              />
            </div>

            <div>
              <label htmlFor="phone" className="mb-1 block text-sm font-medium text-[#2D4B68]">
                Numéro de téléphone
              </label>
              <input
                id="phone"
                type="tel"
                value={profile.phone}
                onChange={(event) => onFieldChange("phone", event.target.value)}
                className="w-full rounded-xl border border-[#D8E4F0] px-3 py-2.5 text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="street" className="mb-1 block text-sm font-medium text-[#2D4B68]">
                Numéro et rue
              </label>
              <input
                id="street"
                type="text"
                value={profile.street}
                onChange={(event) => onFieldChange("street", event.target.value)}
                className="w-full rounded-xl border border-[#D8E4F0] px-3 py-2.5 text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
              />
            </div>

            <div>
              <label htmlFor="city" className="mb-1 block text-sm font-medium text-[#2D4B68]">
                Ville
              </label>
              <input
                id="city"
                type="text"
                value={profile.city}
                onChange={(event) => onFieldChange("city", event.target.value)}
                className="w-full rounded-xl border border-[#D8E4F0] px-3 py-2.5 text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
              />
            </div>

            <div>
              <label htmlFor="province" className="mb-1 block text-sm font-medium text-[#2D4B68]">
                Province
              </label>
              <input
                id="province"
                type="text"
                value={profile.province}
                onChange={(event) => onFieldChange("province", event.target.value)}
                className="w-full rounded-xl border border-[#D8E4F0] px-3 py-2.5 text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
              />
            </div>

            <div>
              <label htmlFor="postalCode" className="mb-1 block text-sm font-medium text-[#2D4B68]">
                Code postal
              </label>
              <input
                id="postalCode"
                type="text"
                value={profile.postalCode}
                onChange={(event) => onFieldChange("postalCode", event.target.value)}
                className="w-full rounded-xl border border-[#D8E4F0] px-3 py-2.5 text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
              />
            </div>

            <div>
              <label htmlFor="country" className="mb-1 block text-sm font-medium text-[#2D4B68]">
                Pays
              </label>
              <input
                id="country"
                type="text"
                value={profile.country}
                onChange={(event) => onFieldChange("country", event.target.value)}
                className="w-full rounded-xl border border-[#D8E4F0] px-3 py-2.5 text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="role" className="mb-1 block text-sm font-medium text-[#2D4B68]">
                Rôle
              </label>
              <select
                id="role"
                value={profile.role}
                onChange={(event) => onFieldChange("role", event.target.value as ParentRole)}
                className="w-full rounded-xl border border-[#D8E4F0] px-3 py-2.5 text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
              >
                <option value="parent1">Parent 1</option>
                <option value="parent2">Parent 2</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isSaving || isUploadingPhoto}
              className="sm:col-span-2 mt-1 w-full rounded-xl bg-[#4A90D9] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(74,144,217,0.35)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSaving ? "Enregistrement..." : "Enregistrer le profil"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-[#D7E6F4] bg-white p-4 shadow-[0_10px_28px_rgba(74,144,217,0.08)] sm:p-5">
          <p className="text-xs font-semibold tracking-[0.2em] text-[#5F81A3]">MON CO-PARENT</p>
          <h2 className="mb-4 mt-1 text-xl font-semibold text-[#17324D]">Informations co-parent</h2>

          {coParent ? (
            <div className="rounded-xl border border-[#D7E6F4] bg-[#FAFCFF] p-4 text-sm text-[#2D4B68]">
              <p><span className="font-semibold">Prénom :</span> {coParent.firstName || "—"}</p>
              <p className="mt-1"><span className="font-semibold">Email :</span> {coParent.email || "—"}</p>
              <p className="mt-1"><span className="font-semibold">Adresse :</span> {[coParent.street, coParent.city, coParent.province, coParent.postalCode, coParent.country].filter(Boolean).join(", ") || "—"}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-[#D7E6F4] bg-[#F8FBFF] p-4">
              <p className="text-sm text-[#4A6783]">Aucun co-parent connecté pour le moment.</p>
              <a
                href={inviteLink}
                className="mt-3 inline-flex items-center justify-center rounded-xl bg-[#4A90D9] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(74,144,217,0.35)] transition hover:brightness-105"
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
              ? "border-[#BDDCC5] bg-[#F2FAF4] text-[#2D6940]"
              : "border-[#E3B4B8] bg-[#FFF4F5] text-[#8D3E45]"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}