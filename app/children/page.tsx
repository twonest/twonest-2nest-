"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { ArrowLeft, Eye, PlusCircle, Trash2, UserCircle, X } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type ParentRole = "parent1" | "parent2";
type ChildTab = "infos" | "sante" | "urgence" | "documents";

type EmergencyContact = {
 id: string;
 name: string;
 relation: string;
 phone: string;
};

type ChildProfile = {
 id: string;
 firstName: string;
 lastName: string;
 birthDate: string;
 schoolName: string;
 schoolLevel: string;
 notes: string;
 photoUrl: string | null;
 doctorName: string;
 doctorPhone: string;
 dentistName: string;
 dentistPhone: string;
 bloodType: string;
 allergies: string;
 medications: string;
 healthInsuranceNumber: string;
 emergencyContacts: EmergencyContact[];
};

type ChildRow = {
 id?: string | number;
 user_id?: string;
 family_id?: string;
 first_name?: string;
 prenom?: string;
 last_name?: string;
 nom?: string;
 birth_date?: string;
 date_naissance?: string;
 school_name?: string;
 ecole?: string;
 school_level?: string;
 niveau_scolaire?: string;
 notes?: string;
 photo_url?: string;
 doctor_name?: string;
 medecin_nom?: string;
 doctor_phone?: string;
 medecin_telephone?: string;
 dentist_name?: string;
 dentiste_nom?: string;
 dentist_phone?: string;
 dentiste_telephone?: string;
 blood_type?: string;
 groupe_sanguin?: string;
 allergies?: string;
 medications?: string;
 medicaments?: string;
 health_insurance_number?: string;
 numero_assurance_maladie?: string;
 emergency_contacts?: unknown;
};

type ChildDocument = {
 id: string;
 title: string;
 url: string;
 createdAt: string;
};

type ToastState = {
 message: string;
 variant: "success" | "error";
};

const SHARED_CHILD_KEY = "twonest.selectedChildId";
const SHARED_CHILD_NAME_KEY = "twonest.selectedChildName";
const SCHOOL_LEVEL_OPTIONS = [
 { value: "GARD", label: "GARD — Garderie" },
 { value: "PRES", label: "PRES — Préscolaire" },
 { value: "MAT4", label: "MAT4 — Maternelle 4 ans" },
 { value: "MAT5", label: "MAT5 — Maternelle 5 ans" },
 { value: "P1", label: "P1 — 1re année primaire" },
 { value: "P2", label: "P2 — 2e année primaire" },
 { value: "P3", label: "P3 — 3e année primaire" },
 { value: "P4", label: "P4 — 4e année primaire" },
 { value: "P5", label: "P5 — 5e année primaire" },
 { value: "P6", label: "P6 — 6e année primaire" },
 { value: "S1", label: "S1 — Secondaire 1" },
 { value: "S2", label: "S2 — Secondaire 2" },
 { value: "S3", label: "S3 — Secondaire 3" },
 { value: "S4", label: "S4 — Secondaire 4" },
 { value: "S5", label: "S5 — Secondaire 5" },
 { value: "AUTRE", label: "AUTRE — Autre" },
] as const;

function normalizeParentRole(value: string | null | undefined): ParentRole {
 const normalized = (value ?? "").toLowerCase();
 return normalized.includes("2") ? "parent2" : "parent1";
}

function toAgeLabel(birthDate: string): string {
 if (!birthDate) {
  return "";
 }

 const date = new Date(`${birthDate}T00:00:00`);
 if (Number.isNaN(date.getTime())) {
  return "";
 }

 const now = new Date();
 let age = now.getFullYear() - date.getFullYear();
 const m = now.getMonth() - date.getMonth();
 if (m < 0 || (m === 0 && now.getDate() < date.getDate())) {
  age -= 1;
 }
 return `${age} ans`;
}

function extractMissingColumn(message: string): string | null {
 const match = message.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+does not exist/i);
 if (match?.[1]) {
  return match[1];
 }

 const cacheMatch = message.match(/Could not find the ['"]?([a-zA-Z0-9_]+)['"]? column/i);
 return cacheMatch?.[1] ?? null;
}

function randomId(): string {
 return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseEmergencyContacts(value: unknown): EmergencyContact[] {
 if (!value) {
  return [];
 }

 if (Array.isArray(value)) {
  return value
   .map((item) => {
    if (typeof item !== "object" || item === null) {
     return null;
    }
    const row = item as Record<string, unknown>;
    const name = typeof row.name === "string" ? row.name.trim() : "";
    const relation = typeof row.relation === "string" ? row.relation.trim() : "";
    const phone = typeof row.phone === "string" ? row.phone.trim() : "";
    if (!name || !phone) {
     return null;
    }
    return {
     id: typeof row.id === "string" && row.id ? row.id : randomId(),
     name,
     relation,
     phone,
    };
   })
   .filter((item): item is EmergencyContact => item !== null);
 }

 if (typeof value === "string") {
  try {
   return parseEmergencyContacts(JSON.parse(value));
  } catch {
   return [];
  }
 }

 return [];
}

function emptyChild(): ChildProfile {
 return {
  id: "",
  firstName: "",
  lastName: "",
  birthDate: "",
  schoolName: "",
  schoolLevel: "",
  notes: "",
  photoUrl: null,
  doctorName: "",
  doctorPhone: "",
  dentistName: "",
  dentistPhone: "",
  bloodType: "",
  allergies: "",
  medications: "",
  healthInsuranceNumber: "",
  emergencyContacts: [],
 };
}

async function resolveCurrentFamilyId(userId: string): Promise<string> {
 const supabase = getSupabaseBrowserClient();
 const byUserId = await supabase.from("profiles").select("family_id").eq("user_id", userId).maybeSingle();
 const byId = byUserId.error || !byUserId.data
  ? await supabase.from("profiles").select("family_id").eq("id", userId).maybeSingle()
  : null;

 const row = (byUserId.data ?? byId?.data ?? null) as { family_id?: unknown } | null;
 return typeof row?.family_id === "string" && row.family_id.trim().length > 0 ? row.family_id : userId;
}

export default function ChildrenPage() {
 const router = useRouter();

 const [user, setUser] = useState<User | null>(null);
 const [checkingSession, setCheckingSession] = useState(true);
 const [configError, setConfigError] = useState("");
 const [currentFamilyId, setCurrentFamilyId] = useState<string | null>(null);
 const [currentRole, setCurrentRole] = useState<ParentRole>("parent1");
 const [defaultFamilyName, setDefaultFamilyName] = useState("");

 const [children, setChildren] = useState<ChildProfile[]>([]);
 const [selectedChildId, setSelectedChildId] = useState("");
 const [activeTab, setActiveTab] = useState<ChildTab>("infos");
 const [childDocuments, setChildDocuments] = useState<ChildDocument[]>([]);

 const [isLoading, setIsLoading] = useState(true);
 const [isSaving, setIsSaving] = useState(false);
 const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
 const [isAddOpen, setIsAddOpen] = useState(false);

 const [newFirstName, setNewFirstName] = useState("");
 const [newLastName, setNewLastName] = useState("");
 const [newBirthDate, setNewBirthDate] = useState("");

 const [newContactName, setNewContactName] = useState("");
 const [newContactRelation, setNewContactRelation] = useState("");
 const [newContactPhone, setNewContactPhone] = useState("");

 const [formError, setFormError] = useState("");
 const [toast, setToast] = useState<ToastState | null>(null);

 const selectedChild = useMemo(
  () => children.find((item) => item.id === selectedChildId) ?? null,
  [children, selectedChildId],
 );

 useEffect(() => {
  if (!toast) {
   return;
  }

  const timeout = setTimeout(() => setToast(null), 2800);
  return () => clearTimeout(timeout);
 }, [toast]);

 const queryChildrenByColumn = async (column: string, value: string) => {
  const supabase = getSupabaseBrowserClient();
  const result = await supabase.from("children").select("*").eq(column, value).order("created_at", { ascending: true });
  if (!result.error) {
   return { rows: (result.data as ChildRow[] | null) ?? [], error: null };
  }

  const missing = extractMissingColumn(result.error.message);
  if (missing === column) {
   return { rows: [] as ChildRow[], error: null };
  }

  return { rows: [] as ChildRow[], error: result.error.message };
 };

 const refreshChildren = async (userId: string, familyId: string) => {
  const familyRows = await queryChildrenByColumn("family_id", familyId);
  const userRows = await queryChildrenByColumn("user_id", userId);

  const rows = [...familyRows.rows, ...userRows.rows];
  const unique = new Map<string, ChildProfile>();

  for (const row of rows) {
   const id = row.id ? String(row.id) : "";
   if (!id) {
    continue;
   }

   unique.set(id, {
    id,
    firstName: row.first_name ?? row.prenom ?? "",
    lastName: row.last_name ?? row.nom ?? "",
    birthDate: row.birth_date ?? row.date_naissance ?? "",
    schoolName: row.school_name ?? row.ecole ?? "",
    schoolLevel: row.school_level ?? row.niveau_scolaire ?? "",
    notes: row.notes ?? "",
    photoUrl: row.photo_url ?? null,
    doctorName: row.doctor_name ?? row.medecin_nom ?? "",
    doctorPhone: row.doctor_phone ?? row.medecin_telephone ?? "",
    dentistName: row.dentist_name ?? row.dentiste_nom ?? "",
    dentistPhone: row.dentist_phone ?? row.dentiste_telephone ?? "",
    bloodType: row.blood_type ?? row.groupe_sanguin ?? "",
    allergies: row.allergies ?? "",
    medications: row.medications ?? row.medicaments ?? "",
    healthInsuranceNumber: row.health_insurance_number ?? row.numero_assurance_maladie ?? "",
    emergencyContacts: parseEmergencyContacts(row.emergency_contacts),
   });
  }

  const mapped = Array.from(unique.values());
  setChildren(mapped);

  if (mapped.length > 0 && !mapped.some((item) => item.id === selectedChildId)) {
   setSelectedChildId(mapped[0].id);
  }

  return mapped;
 };

 const refreshChildDocuments = async (child: ChildProfile, userId: string, familyId: string) => {
  const supabase = getSupabaseBrowserClient();

  const fetchByChildId = await supabase.from("documents").select("*").eq("child_id", child.id).order("created_at", { ascending: false });
  const fetchByEnfantId = fetchByChildId.error
   ? await supabase.from("documents").select("*").eq("enfant_id", child.id).order("created_at", { ascending: false })
   : { data: [] as unknown as null, error: null };

  const fullName = `${child.firstName} ${child.lastName}`.trim();
  const fetchByName = await supabase.from("documents").select("*").ilike("enfant", `%${fullName || child.firstName}%`).order("created_at", { ascending: false });

  const userFallback = await supabase.from("documents").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  const familyFallback = await supabase.from("documents").select("*").eq("family_id", familyId).order("created_at", { ascending: false });

  const rows = [
   ...((fetchByChildId.data as Record<string, unknown>[] | null) ?? []),
   ...((fetchByEnfantId.data as Record<string, unknown>[] | null) ?? []),
   ...((fetchByName.data as Record<string, unknown>[] | null) ?? []),
   ...((userFallback.data as Record<string, unknown>[] | null) ?? []),
   ...((familyFallback.data as Record<string, unknown>[] | null) ?? []),
  ];

  const docsMap = new Map<string, ChildDocument>();
  for (const row of rows) {
   const id = typeof row.id === "string" || typeof row.id === "number" ? String(row.id) : "";
   const title = typeof row.title === "string" ? row.title : typeof row.titre === "string" ? row.titre : "";
   const url = typeof row.fichier_url === "string"
    ? row.fichier_url
    : typeof row.file_url === "string"
     ? row.file_url
     : typeof row.url === "string"
      ? row.url
      : "";
   const createdAt = typeof row.created_at === "string" ? row.created_at : "";

   const childId = typeof row.child_id === "string"
    ? row.child_id
    : typeof row.enfant_id === "string"
     ? row.enfant_id
     : "";

   const childName = typeof row.child_name === "string"
    ? row.child_name
    : typeof row.enfant === "string"
     ? row.enfant
     : "";

   const matchesId = childId && childId === child.id;
   const matchesName = childName && (
    childName.toLowerCase() === child.firstName.toLowerCase() ||
    childName.toLowerCase() === fullName.toLowerCase()
   );

   if (!matchesId && !matchesName) {
    continue;
   }

   if (!id || !title || !url) {
    continue;
   }

   docsMap.set(id, { id, title, url, createdAt });
  }

  setChildDocuments(Array.from(docsMap.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
 };

 useEffect(() => {
  let supabase;
  try {
   supabase = getSupabaseBrowserClient();
  } catch (error) {
   setConfigError(error instanceof Error ? error.message : "Configuration Supabase manquante.");
   setCheckingSession(false);
   setIsLoading(false);
   return;
  }

  const load = async () => {
   const { data } = await supabase.auth.getUser();
   if (!data.user) {
    router.replace("/");
    return;
   }

   const currentUser = data.user;
   setUser(currentUser);
   setCheckingSession(false);

   const roleByUser = await supabase.from("profiles").select("role").eq("user_id", currentUser.id).maybeSingle();
   const roleById = roleByUser.error || !roleByUser.data
    ? await supabase.from("profiles").select("role").eq("id", currentUser.id).maybeSingle()
    : null;
   setCurrentRole(normalizeParentRole((roleByUser.data?.role ?? roleById?.data?.role ?? null) as string | null));

   const profileByUser = await supabase.from("profiles").select("last_name, nom").eq("user_id", currentUser.id).maybeSingle();
   const profileById = profileByUser.error || !profileByUser.data
    ? await supabase.from("profiles").select("last_name, nom").eq("id", currentUser.id).maybeSingle()
    : null;
   const lastName = (profileByUser.data?.last_name ?? profileByUser.data?.nom ?? profileById?.data?.last_name ?? profileById?.data?.nom ?? "") as string;
   setDefaultFamilyName(lastName.trim());

   const familyId = await resolveCurrentFamilyId(currentUser.id);
   setCurrentFamilyId(familyId);

   try {
    const loadedChildren = await refreshChildren(currentUser.id, familyId);
    if (loadedChildren[0]) {
     await refreshChildDocuments(loadedChildren[0], currentUser.id, familyId);
    }
   } catch (error) {
    setFormError(error instanceof Error ? error.message : "Impossible de charger les enfants.");
   } finally {
    setIsLoading(false);
   }
  };

  void load();

  const {
   data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
   if (!session?.user) {
    router.replace("/");
   }
  });

  return () => subscription.unsubscribe();
 }, [router]);

 useEffect(() => {
  if (!selectedChild || !user || !currentFamilyId) {
   setChildDocuments([]);
   return;
  }

  void refreshChildDocuments(selectedChild, user.id, currentFamilyId);
 }, [selectedChildId, user?.id, currentFamilyId]);

 const updateSelectedChild = (updater: (current: ChildProfile) => ChildProfile) => {
  if (!selectedChild) {
   return;
  }

  setChildren((current) => current.map((item) => (item.id === selectedChild.id ? updater(item) : item)));
 };

 const onAddChild = async (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  if (!user || !currentFamilyId) {
   return;
  }

  if (!newFirstName.trim()) {
   setFormError("Le prénom est requis.");
   return;
  }

  setIsSaving(true);
  setFormError("");

  try {
   const supabase = getSupabaseBrowserClient();
   const lastNameToSave = newLastName.trim() || defaultFamilyName || null;
   let payload: Record<string, unknown> = {
    user_id: user.id,
    family_id: currentFamilyId,
    first_name: newFirstName.trim(),
    prenom: newFirstName.trim(),
    last_name: lastNameToSave,
    nom: lastNameToSave,
    birth_date: newBirthDate || null,
    date_naissance: newBirthDate || null,
   };

   let insertedId = "";
   let lastError: string | null = null;
   for (let attempt = 0; attempt < 14; attempt += 1) {
    const result = await supabase.from("children").insert(payload).select("id").maybeSingle();
    if (!result.error) {
     insertedId = result.data?.id ? String(result.data.id) : "";
     lastError = null;
     break;
    }

    const missing = extractMissingColumn(result.error.message);
    if (missing && Object.prototype.hasOwnProperty.call(payload, missing)) {
     const next = { ...payload };
     delete next[missing];
     payload = next;
     lastError = result.error.message;
     continue;
    }

    lastError = result.error.message;
    break;
   }

   if (lastError) {
    throw new Error(lastError);
   }

   const loaded = await refreshChildren(user.id, currentFamilyId);
   const newChild = loaded.find((item) => item.id === insertedId) ?? loaded[loaded.length - 1] ?? null;
   if (newChild) {
    setSelectedChildId(newChild.id);
   }

   setIsAddOpen(false);
   setNewFirstName("");
   setNewLastName("");
   setNewBirthDate("");
   setToast({ message: " Enfant ajouté.", variant: "success" });
  } catch (error) {
   setFormError(error instanceof Error ? error.message : "Erreur pendant l'ajout de l'enfant.");
  } finally {
   setIsSaving(false);
  }
 };

 const onSaveChild = async () => {
  if (!selectedChild || !user || !currentFamilyId) {
   return;
  }

  setIsSaving(true);
  setFormError("");

  try {
   const supabase = getSupabaseBrowserClient();
   const lastNameToSave = selectedChild.lastName.trim() || defaultFamilyName || null;
   let payload: Record<string, unknown> = {
    first_name: selectedChild.firstName.trim(),
    prenom: selectedChild.firstName.trim(),
    last_name: lastNameToSave,
    nom: lastNameToSave,
    birth_date: selectedChild.birthDate || null,
    date_naissance: selectedChild.birthDate || null,
    school_name: selectedChild.schoolName.trim() || null,
    ecole: selectedChild.schoolName.trim() || null,
    school_level: selectedChild.schoolLevel.trim() || null,
    niveau_scolaire: selectedChild.schoolLevel.trim() || null,
    notes: selectedChild.notes.trim() || null,
    photo_url: selectedChild.photoUrl,
    doctor_name: selectedChild.doctorName.trim() || null,
    medecin_nom: selectedChild.doctorName.trim() || null,
    doctor_phone: selectedChild.doctorPhone.trim() || null,
    medecin_telephone: selectedChild.doctorPhone.trim() || null,
    dentist_name: selectedChild.dentistName.trim() || null,
    dentiste_nom: selectedChild.dentistName.trim() || null,
    dentist_phone: selectedChild.dentistPhone.trim() || null,
    dentiste_telephone: selectedChild.dentistPhone.trim() || null,
    blood_type: selectedChild.bloodType.trim() || null,
    groupe_sanguin: selectedChild.bloodType.trim() || null,
    allergies: selectedChild.allergies.trim() || null,
    medications: selectedChild.medications.trim() || null,
    medicaments: selectedChild.medications.trim() || null,
    health_insurance_number: selectedChild.healthInsuranceNumber.trim() || null,
    numero_assurance_maladie: selectedChild.healthInsuranceNumber.trim() || null,
    emergency_contacts: selectedChild.emergencyContacts,
    user_id: user.id,
    family_id: currentFamilyId,
   };

   let lastError: string | null = null;
   for (let attempt = 0; attempt < 16; attempt += 1) {
    const result = await supabase.from("children").update(payload).eq("id", selectedChild.id);
    if (!result.error) {
     lastError = null;
     break;
    }

    const missing = extractMissingColumn(result.error.message);
    if (missing && Object.prototype.hasOwnProperty.call(payload, missing)) {
     const next = { ...payload };
     delete next[missing];
     payload = next;
     lastError = result.error.message;
     continue;
    }

    lastError = result.error.message;
    break;
   }

   if (lastError) {
    throw new Error(lastError);
   }

   await refreshChildren(user.id, currentFamilyId);
   setToast({ message: " Profil enfant sauvegardé.", variant: "success" });
  } catch (error) {
   setFormError(error instanceof Error ? error.message : "Erreur pendant la sauvegarde.");
  } finally {
   setIsSaving(false);
  }
 };

 const onUploadPhoto = async (file: File) => {
  if (!selectedChild || !user) {
   return;
  }

  setIsUploadingPhoto(true);
  setFormError("");

  try {
   const supabase = getSupabaseBrowserClient();
   const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
   const path = `children/${selectedChild.id || user.id}/${Date.now()}-${safeName}`;

   const upload = await supabase.storage.from("documents").upload(path, file, { upsert: true });
   if (upload.error) {
    throw new Error(upload.error.message);
   }

   const { data } = supabase.storage.from("documents").getPublicUrl(path);
   const publicUrl = data.publicUrl;

   updateSelectedChild((current) => ({ ...current, photoUrl: publicUrl }));
   setToast({ message: " Photo mise à jour.", variant: "success" });
  } catch (error) {
   setFormError(error instanceof Error ? error.message : "Erreur pendant l'upload de la photo.");
  } finally {
   setIsUploadingPhoto(false);
  }
 };

 const onAddEmergencyContact = () => {
  if (!newContactName.trim() || !newContactPhone.trim()) {
   setFormError("Nom et téléphone du contact d'urgence sont requis.");
   return;
  }

  updateSelectedChild((current) => ({
   ...current,
   emergencyContacts: [
    ...current.emergencyContacts,
    {
     id: randomId(),
     name: newContactName.trim(),
     relation: newContactRelation.trim(),
     phone: newContactPhone.trim(),
    },
   ],
  }));

  setNewContactName("");
  setNewContactRelation("");
  setNewContactPhone("");
  setFormError("");
 };

 const onDeleteEmergencyContact = (contactId: string) => {
  updateSelectedChild((current) => ({
   ...current,
   emergencyContacts: current.emergencyContacts.filter((item) => item.id !== contactId),
  }));
 };

 const applyGlobalFilterForChild = (child: ChildProfile) => {
  window.localStorage.setItem(SHARED_CHILD_KEY, child.id);
  window.localStorage.setItem(SHARED_CHILD_NAME_KEY, `${child.firstName} ${child.lastName}`.trim() || child.firstName);
  setToast({ message: " Filtre global mis à jour.", variant: "success" });
 };

 if (checkingSession || isLoading) {
  return (
   <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#FFF9F2] to-[#F7F7FF] px-6">
    <p className="text-sm font-medium text-[#6E6E8F]">Chargement des enfants...</p>
   </div>
  );
 }

 if (configError) {
  return (
   <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#FFF9F2] to-[#F7F7FF] px-6">
    <p className="max-w-xl text-center text-sm font-medium text-[#A85C52]">{configError}</p>
   </div>
  );
 }

 return (
  <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#FFF8ED] via-[#FFFDF8] to-[#F4F8FF] px-4 py-8 sm:px-6 sm:py-10">
   <div className="pointer-events-none absolute -top-32 -left-24 h-80 w-80 rounded-full bg-[#FFDCA8]/30 blur-3xl" />
   <div className="pointer-events-none absolute right-0 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-[#B7D6FA]/25 blur-3xl" />

   <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-6 rounded-3xl border border-white/70 bg-white/90 p-6 shadow-[0_24px_80px_rgba(80,104,142,0.14)] backdrop-blur-sm sm:p-8">
    <header className="flex flex-wrap items-center justify-between gap-3">
     <div>
      <p className="text-xs font-semibold tracking-[0.2em] text-[#A7815A]">FAMILLE</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#4B3B2A]"> Enfants</h1>
     </div>

     <div className="flex items-center gap-2">
      <Link
       href="/dashboard"
       className="inline-flex items-center justify-center rounded-xl border border-[#E7D8C8] px-4 py-2 text-sm font-semibold text-[#7A5E45] transition hover:bg-[#FFF5E9]"
      >
        <ArrowLeft size={16} className="mr-2" />
        Retour
      </Link>
      <button
       type="button"
       onClick={() => {
        if (!newLastName && defaultFamilyName) {
         setNewLastName(defaultFamilyName);
        }
        setIsAddOpen(true);
       }}
       className="inline-flex items-center justify-center rounded-xl bg-[#F59E66] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(245,158,102,0.35)] transition hover:brightness-105"
      >
        <PlusCircle size={16} className="mr-2 text-white" />
        Ajouter un enfant
      </button>
     </div>
    </header>

    {formError && (
     <p className="rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] px-4 py-3 text-sm text-[#A85C52]">{formError}</p>
    )}

    <section className="rounded-2xl border border-[#F1E3D3] bg-[#FFFCF7] p-4 shadow-[0_8px_20px_rgba(204,165,117,0.1)]">
     <div className="flex flex-wrap gap-3">
      {children.map((child) => {
       const active = child.id === selectedChildId;
       const displayName = `${child.firstName} ${child.lastName}`.trim() || "Enfant";
       return (
        <button
         key={child.id}
         type="button"
         onClick={() => {
          setSelectedChildId(child.id);
          setActiveTab("infos");
         }}
         className={`flex min-w-[160px] items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
          active
           ? "border-[#F59E66] bg-[#FFF1E3]"
           : "border-[#F1E3D3] bg-white hover:bg-[#FFF8F0]"
         }`}
        >
         <div className="h-12 w-12 overflow-hidden rounded-full border border-[#F3DCC5] bg-[#FFEBD6]">
          {child.photoUrl ? (
           // eslint-disable-next-line @next/next/no-img-element
           <img src={child.photoUrl} alt={displayName} className="h-full w-full object-cover" />
          ) : (
           <div className="flex h-full w-full items-center justify-center text-[#7A5E45]"><UserCircle size={20} /></div>
          )}
         </div>
         <div>
          <p className="text-sm font-semibold text-[#5D4127]">{`${child.firstName} ${child.lastName}`.trim() || "Sans prénom"}</p>
          <p className="text-xs text-[#8B6E52]">{toAgeLabel(child.birthDate) || "Âge inconnu"}</p>
         </div>
        </button>
       );
      })}
     </div>
    </section>

    {!selectedChild ? (
     <p className="rounded-xl border border-dashed border-[#E6D8CA] bg-[#FFFDF9] px-4 py-8 text-center text-sm text-[#8B6E52]">
      Aucun enfant enregistré pour le moment.
     </p>
    ) : (
     <section className="rounded-2xl border border-[#E7DCCF] bg-white p-4 shadow-[0_8px_20px_rgba(133,108,80,0.08)] sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
       <h2 className="text-xl font-semibold text-[#4B3B2A]">
        Profil de {`${selectedChild.firstName} ${selectedChild.lastName}`.trim()}
       </h2>
       <div className="flex gap-2">
        <button
         type="button"
         onClick={() => applyGlobalFilterForChild(selectedChild)}
         className="rounded-xl border border-[#E7D8C8] bg-[#FFF8EF] px-3 py-2 text-sm font-semibold text-[#7A5E45]"
        >
         🎯 Utiliser comme filtre global
        </button>
        <button
         type="button"
         onClick={() => {
          window.localStorage.setItem(SHARED_CHILD_KEY, "all");
          window.localStorage.setItem(SHARED_CHILD_NAME_KEY, "");
          setToast({ message: " Filtre global retiré.", variant: "success" });
         }}
         className="rounded-xl border border-[#E7D8C8] bg-white px-3 py-2 text-sm font-semibold text-[#7A5E45]"
        >
         Voir tous les enfants
        </button>
       </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
       {[
      { key: "infos", label: "Infos générales" },
      { key: "sante", label: "Santé" },
      { key: "urgence", label: "Contacts d'urgence" },
      { key: "documents", label: "Documents de l'enfant" },
       ].map((tab) => (
        <button
         key={tab.key}
         type="button"
         onClick={() => setActiveTab(tab.key as ChildTab)}
         className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
          activeTab === tab.key
           ? "border-[#F59E66] bg-[#FFF1E3] text-[#7B5434]"
           : "border-[#E7D8C8] bg-white text-[#7A5E45] hover:bg-[#FFF8EF]"
         }`}
        >
         {tab.label}
        </button>
       ))}
      </div>

      {activeTab === "infos" && (
       <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 flex items-center gap-4 rounded-xl border border-[#F1E3D3] bg-[#FFFCF7] p-3">
         <div className="h-20 w-20 overflow-hidden rounded-full border border-[#F3DCC5] bg-[#FFEBD6]">
          {selectedChild.photoUrl ? (
           // eslint-disable-next-line @next/next/no-img-element
           <img src={selectedChild.photoUrl} alt="Photo enfant" className="h-full w-full object-cover" />
          ) : (
           <div className="flex h-full w-full items-center justify-center text-[#7A5E45]"><UserCircle size={24} /></div>
          )}
         </div>

         <label className="rounded-xl border border-[#E7D8C8] bg-white px-3 py-2 text-sm font-semibold text-[#7A5E45] cursor-pointer">
          Upload photo
          <input
           type="file"
           accept=".jpg,.jpeg,.png,image/jpeg,image/png"
           className="hidden"
           disabled={isUploadingPhoto}
           onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            void onUploadPhoto(file);
           }}
          />
         </label>
        </div>

        <div>
         <label className="mb-1 block text-sm font-medium text-[#6E5237]">Prénom</label>
         <input
          value={selectedChild.firstName}
          onChange={(event) => updateSelectedChild((current) => ({ ...current, firstName: event.target.value }))}
          className="w-full rounded-xl border border-[#E6D8CA] px-3 py-2.5 text-[#4B3B2A] outline-none focus:border-[#F59E66] focus:ring-4 focus:ring-[#F59E66]/20"
         />
        </div>

        <div>
         <label className="mb-1 block text-sm font-medium text-[#6E5237]">Nom</label>
         <input
          value={selectedChild.lastName}
          onChange={(event) => updateSelectedChild((current) => ({ ...current, lastName: event.target.value }))}
          className="w-full rounded-xl border border-[#E6D8CA] px-3 py-2.5 text-[#4B3B2A] outline-none focus:border-[#F59E66] focus:ring-4 focus:ring-[#F59E66]/20"
         />
        </div>

        <div>
         <label className="mb-1 block text-sm font-medium text-[#6E5237]">Date de naissance</label>
         <input
          type="date"
          value={selectedChild.birthDate}
          onChange={(event) => updateSelectedChild((current) => ({ ...current, birthDate: event.target.value }))}
          className="w-full rounded-xl border border-[#E6D8CA] px-3 py-2.5 text-[#4B3B2A] outline-none focus:border-[#F59E66] focus:ring-4 focus:ring-[#F59E66]/20"
         />
         <p className="mt-1 text-xs text-[#8B6E52]">Âge: {toAgeLabel(selectedChild.birthDate) || "-"}</p>
        </div>

        <div>
         <label className="mb-1 block text-sm font-medium text-[#6E5237]">École</label>
         <input
          value={selectedChild.schoolName}
          onChange={(event) => updateSelectedChild((current) => ({ ...current, schoolName: event.target.value }))}
          className="w-full rounded-xl border border-[#E6D8CA] px-3 py-2.5 text-[#4B3B2A] outline-none focus:border-[#F59E66] focus:ring-4 focus:ring-[#F59E66]/20"
         />
        </div>

        <div className="sm:col-span-2">
         <label className="mb-1 block text-sm font-medium text-[#6E5237]">Niveau scolaire</label>
         <select
          value={selectedChild.schoolLevel}
          onChange={(event) => updateSelectedChild((current) => ({ ...current, schoolLevel: event.target.value }))}
          className="w-full rounded-xl border border-[#E6D8CA] px-3 py-2.5 text-[#4B3B2A] outline-none focus:border-[#F59E66] focus:ring-4 focus:ring-[#F59E66]/20"
         >
          <option value="">Sélectionner un niveau</option>
          {SCHOOL_LEVEL_OPTIONS.map((option) => (
           <option key={option.value} value={option.value}>{option.label}</option>
          ))}
         </select>
        </div>

        <div className="sm:col-span-2">
         <label className="mb-1 block text-sm font-medium text-[#6E5237]">Notes générales</label>
         <textarea
          rows={4}
          value={selectedChild.notes}
          onChange={(event) => updateSelectedChild((current) => ({ ...current, notes: event.target.value }))}
          className="w-full rounded-xl border border-[#E6D8CA] px-3 py-2.5 text-[#4B3B2A] outline-none focus:border-[#F59E66] focus:ring-4 focus:ring-[#F59E66]/20"
         />
        </div>
       </div>
      )}

      {activeTab === "sante" && (
       <div className="grid gap-4 sm:grid-cols-2">
        <div>
         <label className="mb-1 block text-sm font-medium text-[#6E5237]">Médecin (nom)</label>
         <input
          value={selectedChild.doctorName}
          onChange={(event) => updateSelectedChild((current) => ({ ...current, doctorName: event.target.value }))}
          className="w-full rounded-xl border border-[#E6D8CA] px-3 py-2.5 text-[#4B3B2A] outline-none focus:border-[#F59E66] focus:ring-4 focus:ring-[#F59E66]/20"
         />
        </div>
        <div>
         <label className="mb-1 block text-sm font-medium text-[#6E5237]">Médecin (téléphone)</label>
         <input
          value={selectedChild.doctorPhone}
          onChange={(event) => updateSelectedChild((current) => ({ ...current, doctorPhone: event.target.value }))}
          className="w-full rounded-xl border border-[#E6D8CA] px-3 py-2.5 text-[#4B3B2A] outline-none focus:border-[#F59E66] focus:ring-4 focus:ring-[#F59E66]/20"
         />
        </div>
        <div>
         <label className="mb-1 block text-sm font-medium text-[#6E5237]">Dentiste (nom)</label>
         <input
          value={selectedChild.dentistName}
          onChange={(event) => updateSelectedChild((current) => ({ ...current, dentistName: event.target.value }))}
          className="w-full rounded-xl border border-[#E6D8CA] px-3 py-2.5 text-[#4B3B2A] outline-none focus:border-[#F59E66] focus:ring-4 focus:ring-[#F59E66]/20"
         />
        </div>
        <div>
         <label className="mb-1 block text-sm font-medium text-[#6E5237]">Dentiste (téléphone)</label>
         <input
          value={selectedChild.dentistPhone}
          onChange={(event) => updateSelectedChild((current) => ({ ...current, dentistPhone: event.target.value }))}
          className="w-full rounded-xl border border-[#E6D8CA] px-3 py-2.5 text-[#4B3B2A] outline-none focus:border-[#F59E66] focus:ring-4 focus:ring-[#F59E66]/20"
         />
        </div>
        <div>
         <label className="mb-1 block text-sm font-medium text-[#6E5237]">Groupe sanguin</label>
         <input
          value={selectedChild.bloodType}
          onChange={(event) => updateSelectedChild((current) => ({ ...current, bloodType: event.target.value }))}
          className="w-full rounded-xl border border-[#E6D8CA] px-3 py-2.5 text-[#4B3B2A] outline-none focus:border-[#F59E66] focus:ring-4 focus:ring-[#F59E66]/20"
         />
        </div>
        <div>
         <label className="mb-1 block text-sm font-medium text-[#6E5237]">Numéro assurance maladie</label>
         <input
          value={selectedChild.healthInsuranceNumber}
          onChange={(event) => updateSelectedChild((current) => ({ ...current, healthInsuranceNumber: event.target.value }))}
          className="w-full rounded-xl border border-[#E6D8CA] px-3 py-2.5 text-[#4B3B2A] outline-none focus:border-[#F59E66] focus:ring-4 focus:ring-[#F59E66]/20"
         />
        </div>
        <div className="sm:col-span-2">
         <label className="mb-1 block text-sm font-medium text-[#6E5237]">Allergies</label>
         <textarea
          rows={3}
          value={selectedChild.allergies}
          onChange={(event) => updateSelectedChild((current) => ({ ...current, allergies: event.target.value }))}
          className="w-full rounded-xl border border-[#E6D8CA] px-3 py-2.5 text-[#4B3B2A] outline-none focus:border-[#F59E66] focus:ring-4 focus:ring-[#F59E66]/20"
         />
        </div>
        <div className="sm:col-span-2">
         <label className="mb-1 block text-sm font-medium text-[#6E5237]">Médicaments actuels</label>
         <textarea
          rows={3}
          value={selectedChild.medications}
          onChange={(event) => updateSelectedChild((current) => ({ ...current, medications: event.target.value }))}
          className="w-full rounded-xl border border-[#E6D8CA] px-3 py-2.5 text-[#4B3B2A] outline-none focus:border-[#F59E66] focus:ring-4 focus:ring-[#F59E66]/20"
         />
        </div>
       </div>
      )}

      {activeTab === "urgence" && (
       <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
         <input
          placeholder="Nom"
          value={newContactName}
          onChange={(event) => setNewContactName(event.target.value)}
          className="rounded-xl border border-[#E6D8CA] px-3 py-2.5 text-[#4B3B2A] outline-none focus:border-[#F59E66] focus:ring-4 focus:ring-[#F59E66]/20"
         />
         <input
          placeholder="Lien (grand-mère, oncle...)"
          value={newContactRelation}
          onChange={(event) => setNewContactRelation(event.target.value)}
          className="rounded-xl border border-[#E6D8CA] px-3 py-2.5 text-[#4B3B2A] outline-none focus:border-[#F59E66] focus:ring-4 focus:ring-[#F59E66]/20"
         />
         <input
          placeholder="Téléphone"
          value={newContactPhone}
          onChange={(event) => setNewContactPhone(event.target.value)}
          className="rounded-xl border border-[#E6D8CA] px-3 py-2.5 text-[#4B3B2A] outline-none focus:border-[#F59E66] focus:ring-4 focus:ring-[#F59E66]/20"
         />
        </div>

        <button
         type="button"
         onClick={onAddEmergencyContact}
         className="rounded-xl border border-[#E7D8C8] bg-[#FFF8EF] px-3 py-2 text-sm font-semibold text-[#7A5E45]"
        >
          <PlusCircle size={14} className="mr-2 inline-flex" />
          Ajouter un contact
        </button>

        <div className="space-y-2">
         {selectedChild.emergencyContacts.length === 0 ? (
          <p className="text-sm text-[#8B6E52]">Aucun contact d'urgence.</p>
         ) : (
          selectedChild.emergencyContacts.map((contact) => (
           <div key={contact.id} className="flex items-center justify-between rounded-xl border border-[#F1E3D3] bg-[#FFFCF7] px-3 py-2">
            <div>
             <p className="text-sm font-semibold text-[#5D4127]">{contact.name}</p>
             <p className="text-xs text-[#8B6E52]">{contact.relation || "Contact"} · {contact.phone}</p>
            </div>
            <button
             type="button"
             onClick={() => onDeleteEmergencyContact(contact.id)}
             className="rounded-lg border border-[#EAC8C8] bg-[#F5F0EB] px-2 py-1 text-xs font-semibold text-[#A85C52]"
            >
             <Trash2 size={12} className="mr-1 inline-flex" />
             Supprimer
            </button>
           </div>
          ))
         )}
        </div>
       </div>
      )}

      {activeTab === "documents" && (
       <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
         <p className="text-sm font-medium text-[#6E5237]">Documents liés à cet enfant</p>
         <Link
          href="/documents"
          className="rounded-xl border border-[#E7D8C8] bg-[#FFF8EF] px-3 py-2 text-sm font-semibold text-[#7A5E45]"
         >
             <PlusCircle size={14} className="mr-2 inline-flex" />
             Ajouter un document
         </Link>
        </div>

        {childDocuments.length === 0 ? (
         <p className="rounded-xl border border-dashed border-[#E6D8CA] bg-[#FFFDF9] px-4 py-6 text-center text-sm text-[#8B6E52]">
          Aucun document pour cet enfant.
         </p>
        ) : (
         childDocuments.map((doc) => (
          <article key={doc.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#F1E3D3] bg-[#FFFCF7] px-3 py-2">
           <div>
            <p className="text-sm font-semibold text-[#5D4127]">{doc.title}</p>
            <p className="text-xs text-[#8B6E52]">{new Date(doc.createdAt).toLocaleString("fr-CA")}</p>
           </div>
           <a
            href={doc.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-[#E7D8C8] bg-white px-3 py-2 text-sm font-semibold text-[#7A5E45]"
           >
              <Eye size={14} className="mr-2 inline-flex" />
              Voir
           </a>
          </article>
         ))
        )}
       </div>
      )}

      <div className="mt-5">
       <button
        type="button"
        onClick={() => void onSaveChild()}
        disabled={isSaving}
        className="w-full rounded-xl bg-[#F59E66] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(245,158,102,0.35)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
       >
        {isSaving ? "Sauvegarde..." : "Enregistrer le profil de l'enfant"}
       </button>
      </div>
     </section>
    )}
   </main>

   {isAddOpen && (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0F223680] p-4 sm:items-center">
     <div className="w-full max-w-md rounded-2xl border border-white/70 bg-white p-6 shadow-[0_20px_60px_rgba(15,36,54,0.22)]">
      <div className="mb-4 flex items-center justify-between">
      <h2 className="text-xl font-semibold text-[#4B3B2A]">Ajouter un enfant</h2>
       <button
        type="button"
        onClick={() => setIsAddOpen(false)}
        className="rounded-lg border border-[#E7D8C8] px-2 py-1 text-sm text-[#7A5E45]"
       >
          <X size={14} />
       </button>
      </div>

      <form className="space-y-4" onSubmit={onAddChild}>
       <div>
        <label className="mb-1 block text-sm font-medium text-[#6E5237]">Prénom</label>
        <input
         value={newFirstName}
         onChange={(event) => setNewFirstName(event.target.value)}
         className="w-full rounded-xl border border-[#E6D8CA] px-3 py-2.5 text-[#4B3B2A] outline-none focus:border-[#F59E66] focus:ring-4 focus:ring-[#F59E66]/20"
         required
        />
       </div>
       <div>
        <label className="mb-1 block text-sm font-medium text-[#6E5237]">Nom</label>
        <input
         value={newLastName}
         onChange={(event) => setNewLastName(event.target.value)}
         className="w-full rounded-xl border border-[#E6D8CA] px-3 py-2.5 text-[#4B3B2A] outline-none focus:border-[#F59E66] focus:ring-4 focus:ring-[#F59E66]/20"
        />
       </div>
       <div>
        <label className="mb-1 block text-sm font-medium text-[#6E5237]">Date de naissance</label>
        <input
         type="date"
         value={newBirthDate}
         onChange={(event) => setNewBirthDate(event.target.value)}
         className="w-full rounded-xl border border-[#E6D8CA] px-3 py-2.5 text-[#4B3B2A] outline-none focus:border-[#F59E66] focus:ring-4 focus:ring-[#F59E66]/20"
        />
       </div>

       <button
        type="submit"
        disabled={isSaving}
        className="w-full rounded-xl bg-[#F59E66] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(245,158,102,0.35)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
       >
        {isSaving ? "Ajout..." : "Ajouter l'enfant"}
       </button>
      </form>
     </div>
    </div>
   )}

   {toast && (
    <div
     className={`fixed bottom-5 right-5 z-50 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(10,30,50,0.25)] ${
      toast.variant === "success" ? "bg-[#2E8B57]" : "bg-[#C94B4B]"
     }`}
    >
     {toast.message}
    </div>
   )}
  </div>
 );
}
