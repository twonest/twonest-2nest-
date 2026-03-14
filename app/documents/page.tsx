"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { ArrowLeft, Download, Eye, FileText, PlusCircle, Trash2, X } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type ParentRole = "parent1" | "parent2";
type DocumentCategory = "medical" | "scolaire" | "legal" | "assurances" | "autres";

type CategoryTab = {
 key: "all" | DocumentCategory;
 label: string;
};

type DocumentItem = {
 id: string;
 title: string;
 category: DocumentCategory;
 childId: string | null;
 childName: string | null;
 description: string | null;
 fileUrl: string;
 filePath: string;
 mimeType: string | null;
 createdAt: string;
 uploaderUserId: string | null;
 uploaderRole: ParentRole;
};

type SupabaseDocumentRow = {
 id?: string | number;
 title?: string;
 titre?: string;
 category?: string;
 categorie?: string;
 child_name?: string;
 child_id?: string;
 enfant_id?: string;
 child?: string;
 enfant?: string;
 description?: string;
 short_description?: string;
 fichier_url?: string;
 file_url?: string;
 url?: string;
 public_url?: string;
 file_path?: string;
 storage_path?: string;
 mime_type?: string;
 file_type?: string;
 user_id?: string;
 uploader_user_id?: string;
 uploaded_by?: string;
 parent?: string;
 uploader_role?: string;
 family_id?: string;
 shared_with_legal?: boolean;
 created_at?: string;
 uploaded_at?: string;
 date_ajout?: string;
};

type ToastState = {
 message: string;
 variant: "success" | "error";
};

const CATEGORY_TABS: CategoryTab[] = [
 { key: "all", label: "Tous" },
 { key: "medical", label: "Médical / Dentaire" },
 { key: "scolaire", label: "Scolaire" },
 { key: "legal", label: "Légal / Jugement" },
 { key: "assurances", label: "Assurances" },
 { key: "autres", label: "Autres" },
];

const CATEGORY_OPTIONS: Array<{ value: DocumentCategory; label: string }> = [
 { value: "medical", label: "Médical / Dentaire" },
 { value: "scolaire", label: "Scolaire" },
 { value: "legal", label: "Légal / Jugement" },
 { value: "assurances", label: "Assurances" },
 { value: "autres", label: "Autres" },
];
const SHARED_CHILD_KEY = "twonest.selectedChildId";
const SHARED_CHILD_NAME_KEY = "twonest.selectedChildName";

function normalizeParentRole(value: string | null | undefined): ParentRole {
 const normalized = (value ?? "").toLowerCase();
 return normalized.includes("2") ? "parent2" : "parent1";
}

function normalizeCategory(value: string | null | undefined): DocumentCategory {
 const normalized = (value ?? "").toLowerCase();
 if (normalized.includes("med") || normalized.includes("dent")) {
  return "medical";
 }
 if (normalized.includes("scol")) {
  return "scolaire";
 }
 if (normalized.includes("legal") || normalized.includes("légal") || normalized.includes("jugement")) {
  return "legal";
 }
 if (normalized.includes("assur")) {
  return "assurances";
 }
 return "autres";
}

function categoryLabel(category: DocumentCategory): string {
 const option = CATEGORY_OPTIONS.find((item) => item.value === category);
 return option ? option.label : "Autres";
}

function formatDateTimeLabel(value: string): string {
 const parsed = new Date(value);
 if (Number.isNaN(parsed.getTime())) {
  return value;
 }
 return parsed.toLocaleString("fr-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
 });
}

function extractMissingColumn(message: string): string | null {
 const match = message.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+does not exist/i);
 if (match?.[1]) {
  return match[1];
 }

 const cacheMatch = message.match(/Could not find the ['"]?([a-zA-Z0-9_]+)['"]? column/i);
 return cacheMatch?.[1] ?? null;
}

function extractStoragePathFromPublicUrl(fileUrl: string): string {
 const marker = "/storage/v1/object/public/documents/";
 const index = fileUrl.indexOf(marker);
 if (index === -1) {
  return "";
 }
 return decodeURIComponent(fileUrl.slice(index + marker.length));
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

export default function DocumentsPage() {
 const router = useRouter();

 const [user, setUser] = useState<User | null>(null);
 const [checkingSession, setCheckingSession] = useState(true);
 const [configError, setConfigError] = useState("");
 const [currentFamilyId, setCurrentFamilyId] = useState<string | null>(null);
 const [currentRole, setCurrentRole] = useState<ParentRole>("parent1");

 const [documents, setDocuments] = useState<DocumentItem[]>([]);
 const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
 const [isUploading, setIsUploading] = useState(false);
 const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

 const [activeTab, setActiveTab] = useState<CategoryTab["key"]>("all");
 const [searchQuery, setSearchQuery] = useState("");
 const [formOpen, setFormOpen] = useState(false);
 const [formError, setFormError] = useState("");
 const [toast, setToast] = useState<ToastState | null>(null);

 const [docTitle, setDocTitle] = useState("");
 const [docCategory, setDocCategory] = useState<DocumentCategory>("medical");
 const [docChildName, setDocChildName] = useState("");
 const [docDescription, setDocDescription] = useState("");
 const [docFile, setDocFile] = useState<File | null>(null);
 const [shareWithLegal, setShareWithLegal] = useState(false);
 const [selectedChildFilterId, setSelectedChildFilterId] = useState("all");
 const [selectedChildFilterName, setSelectedChildFilterName] = useState("");

 useEffect(() => {
  if (!toast) {
   return;
  }

  const timeout = setTimeout(() => setToast(null), 2800);
  return () => clearTimeout(timeout);
 }, [toast]);

 useEffect(() => {
  const selectedId = window.localStorage.getItem(SHARED_CHILD_KEY) ?? "all";
  const selectedName = window.localStorage.getItem(SHARED_CHILD_NAME_KEY) ?? "";
  setSelectedChildFilterId(selectedId);
  setSelectedChildFilterName(selectedName.trim());
 }, []);

 const refreshDocuments = async (userId: string, familyId: string, source: "startup" | "after-insert" | "manual" = "manual") => {
  const supabase = getSupabaseBrowserClient();
  console.log("[documents] Filtres de chargement:", { user_id: userId, family_id: familyId, source });

  const queryByColumn = async (column: string, value: string) => {
   const result = await supabase
    .from("documents")
    .select("*")
    .eq(column, value)
    .order("created_at", { ascending: false });

   if (!result.error) {
    return { rows: (result.data as SupabaseDocumentRow[] | null) ?? [], error: null };
   }

   const missingColumn = extractMissingColumn(result.error.message);
   if (missingColumn === column) {
    return { rows: [] as SupabaseDocumentRow[], error: null };
   }

   return { rows: [] as SupabaseDocumentRow[], error: result.error.message };
  };

  const familyColumns = ["family_id"];
  const userColumns = ["uploader_user_id", "uploaded_by", "user_id"];

  const familyRows: SupabaseDocumentRow[] = [];
  let familyError: string | null = null;
  for (const column of familyColumns) {
   const result = await queryByColumn(column, familyId);
   if (result.error) {
    familyError = result.error;
    continue;
   }
   familyRows.push(...result.rows);
   if (result.rows.length > 0) {
    break;
   }
  }

  const userRows: SupabaseDocumentRow[] = [];
  let userError: string | null = null;
  for (const column of userColumns) {
   const result = await queryByColumn(column, userId);
   if (result.error) {
    userError = result.error;
    continue;
   }
   userRows.push(...result.rows);
   if (result.rows.length > 0) {
    break;
   }
  }

  if (familyRows.length === 0 && userRows.length === 0 && familyError && userError) {
   throw new Error(userError || familyError);
  }

  const rowMap = new Map<string, SupabaseDocumentRow>();
  const allRows = [
   ...familyRows,
   ...userRows,
  ];

  for (const row of allRows) {
   const id = row.id ? String(row.id) : "";
   if (!id) {
    continue;
   }
   rowMap.set(id, row);
  }

  const mapped = Array.from(rowMap.values())
   .map((row): DocumentItem | null => {
    const id = row.id ? String(row.id) : "";
    const title = row.title ?? row.titre ?? "";
    const fileUrl = row.fichier_url ?? row.file_url ?? row.url ?? row.public_url ?? "";
    const filePath = row.file_path ?? row.storage_path ?? extractStoragePathFromPublicUrl(fileUrl);
    const createdAt = row.created_at ?? row.uploaded_at ?? row.date_ajout ?? "";

    if (!id || !title || !fileUrl || !createdAt) {
     return null;
    }

    const uploaderUserId = row.uploader_user_id ?? row.uploaded_by ?? row.user_id ?? null;
    const uploaderRoleRaw = row.uploader_role ?? row.parent ?? null;
    const inferredRole = uploaderUserId === userId ? currentRole : currentRole === "parent1" ? "parent2" : "parent1";

    return {
     id,
     title,
     category: normalizeCategory(row.category ?? row.categorie),
     childId: row.child_id ?? row.enfant_id ?? null,
     childName: row.child_name ?? row.child ?? row.enfant ?? null,
     description: row.description ?? row.short_description ?? null,
     fileUrl,
     filePath,
     mimeType: row.mime_type ?? row.file_type ?? null,
     createdAt,
     uploaderUserId,
     uploaderRole: uploaderRoleRaw ? normalizeParentRole(uploaderRoleRaw) : inferredRole,
    };
   })
   .filter((item): item is DocumentItem => item !== null)
   .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (source === "startup") {
   console.log("[documents] Documents chargés au démarrage:", mapped);
  }

  setDocuments(mapped);
  return mapped;
 };

 useEffect(() => {
  let supabase;
  try {
   supabase = getSupabaseBrowserClient();
  } catch (error) {
   setConfigError(error instanceof Error ? error.message : "Configuration Supabase manquante.");
   setCheckingSession(false);
   setIsLoadingDocuments(false);
   return;
  }

  const loadData = async () => {
   const { data: userData } = await supabase.auth.getUser();
   if (!userData.user) {
    router.replace("/");
    return;
   }

   const currentUser = userData.user;
   setUser(currentUser);
   setCheckingSession(false);

   const profileByUser = await supabase.from("profiles").select("role").eq("user_id", currentUser.id).maybeSingle();
   const profileById = profileByUser.error || !profileByUser.data
    ? await supabase.from("profiles").select("role").eq("id", currentUser.id).maybeSingle()
    : null;

   const roleRaw = (profileByUser.data?.role ?? profileById?.data?.role ?? null) as string | null;
   const normalizedRole = normalizeParentRole(roleRaw);
   setCurrentRole(normalizedRole);

   const familyId = await resolveCurrentFamilyId(currentUser.id);
   setCurrentFamilyId(familyId);

   try {
    await refreshDocuments(currentUser.id, familyId, "startup");
   } catch (error) {
    setFormError(error instanceof Error ? error.message : "Impossible de charger les documents.");
   } finally {
    setIsLoadingDocuments(false);
   }
  };

  void loadData();

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
 }, [router, currentRole]);

 const filteredDocuments = useMemo(() => {
  const query = searchQuery.trim().toLowerCase();
  return documents.filter((item) => {
   if (selectedChildFilterId !== "all") {
    const matchesId = item.childId === selectedChildFilterId;
    const matchesName = selectedChildFilterName.length > 0 &&
     (item.childName ?? "").toLowerCase().includes(selectedChildFilterName.toLowerCase());
    if (!matchesId && !matchesName) {
     return false;
    }
   }

   if (activeTab !== "all" && item.category !== activeTab) {
    return false;
   }

   if (!query) {
    return true;
   }

   const category = categoryLabel(item.category).toLowerCase();
   return item.title.toLowerCase().includes(query) || category.includes(query);
  });
 }, [activeTab, documents, searchQuery, selectedChildFilterId, selectedChildFilterName]);

 const resetForm = () => {
  setDocTitle("");
  setDocCategory("medical");
  setDocChildName("");
  setDocDescription("");
  setDocFile(null);
  setShareWithLegal(false);
  setFormError("");
 };

 const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0] ?? null;
  setDocFile(file);
 };

 const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  if (!user) {
   setFormError("Session invalide.");
   return;
  }
  if (!currentFamilyId) {
   setFormError("Famille introuvable.");
   return;
  }
  if (!docTitle.trim()) {
   setFormError("Le titre du document est requis.");
   return;
  }
  if (!docFile) {
   setFormError("Veuillez sélectionner un fichier.");
   return;
  }

  setIsUploading(true);
  setFormError("");

  try {
   const supabase = getSupabaseBrowserClient();
   const safeName = docFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
   const filePath = `${Date.now()}-${safeName}`;

   const uploadResult = await supabase.storage
    .from("documents")
    .upload(filePath, docFile, { cacheControl: "3600", upsert: false });

   if (uploadResult.error) {
    throw new Error(`${uploadResult.error.message}. Vérifie que le bucket 'documents' existe.`);
   }

   const { data: urlData } = supabase.storage.from("documents").getPublicUrl(filePath);
   const publicUrl = urlData.publicUrl;
   console.log("[documents] URL générée après upload:", publicUrl);

   let payload: Record<string, unknown> = {
    title: docTitle.trim(),
    titre: docTitle.trim(),
    categorie: docCategory,
    child_id: selectedChildFilterId !== "all" ? selectedChildFilterId : null,
    child_name: docChildName.trim() || null,
    enfant: docChildName.trim() || null,
    description: docDescription.trim() || null,
    file_path: filePath,
    fichier_url: publicUrl,
    file_url: publicUrl,
    mime_type: docFile.type || null,
    user_id: user.id,
    uploader_user_id: user.id,
    uploader_role: currentRole,
    parent: currentRole,
    family_id: currentFamilyId,
    shared_with_legal: shareWithLegal,
   };

   if (!docChildName.trim() && selectedChildFilterId !== "all" && selectedChildFilterName) {
    payload.child_name = selectedChildFilterName;
    payload.enfant = selectedChildFilterName;
   }

   let insertError: string | null = null;
   for (let attempt = 0; attempt < 12; attempt += 1) {
    const result = await supabase.from("documents").insert(payload).select("*").maybeSingle();
    console.log("[documents] Réponse Supabase après insert:", result);
    if (!result.error) {
     insertError = null;
     break;
    }

    const missingColumn = extractMissingColumn(result.error.message);
    if (missingColumn && Object.prototype.hasOwnProperty.call(payload, missingColumn)) {
     const nextPayload = { ...payload };
     delete nextPayload[missingColumn];
     payload = nextPayload;
     insertError = result.error.message;
     continue;
    }

    insertError = result.error.message;
    break;
   }

   if (insertError) {
    throw new Error(insertError);
   }

   await refreshDocuments(user.id, currentFamilyId, "after-insert");
   setToast({ message: " Document ajouté.", variant: "success" });
   setFormOpen(false);
   resetForm();
  } catch (error) {
   setFormError(error instanceof Error ? error.message : "Erreur pendant l'ajout du document.");
  } finally {
   setIsUploading(false);
  }
 };

 const onDeleteDocument = async (item: DocumentItem) => {
  if (!user || !currentFamilyId) {
   return;
  }
  if (item.uploaderUserId !== user.id) {
   return;
  }

  setIsDeletingId(item.id);
  try {
   const supabase = getSupabaseBrowserClient();
   await supabase.storage.from("documents").remove([item.filePath]);

   const { error } = await supabase.from("documents").delete().eq("id", item.id);
   if (error) {
    throw new Error(error.message);
   }

   await refreshDocuments(user.id, currentFamilyId, "manual");
   setToast({ message: " Document supprimé.", variant: "success" });
  } catch (error) {
   setToast({
    message: error instanceof Error ? error.message : "Suppression impossible.",
    variant: "error",
   });
  } finally {
   setIsDeletingId(null);
  }
 };

 if (checkingSession || isLoadingDocuments) {
  return (
   <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#F5F0EB] to-[#EDE8E3]">
    <p className="text-sm font-medium text-[#6B5D55]">Chargement des documents...</p>
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
      <p className="text-xs font-semibold tracking-[0.2em] text-[#A89080]">FICHIERS</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#2C2420]"> Documents</h1>
     </div>

     <div className="flex items-center gap-2">
      <Link
       href="/dashboard"
       className="inline-flex items-center justify-center rounded-xl border border-[#D9D0C8] px-4 py-2 text-sm font-semibold text-[#6B5D55] transition hover:bg-[#EDE8E3]"
      >
        <ArrowLeft size={16} className="mr-2" />
        Retour
      </Link>
      <button
       type="button"
       onClick={() => {
        setFormError("");
        setFormOpen(true);
       }}
       className="inline-flex items-center justify-center rounded-xl bg-[#7C6B5D] px-4 py-2 text-sm font-semibold text-white shadow-[0_1px_4px_rgba(44,36,32,0.12)] transition hover:brightness-105"
      >
        <PlusCircle size={16} className="mr-2" />
        Ajouter un document
      </button>
     </div>
    </header>

    <section className="rounded-2xl border border-[#D9D0C8] bg-white p-4 shadow-[0_1px_4px_rgba(44,36,32,0.06)] sm:p-5">
     <div className="flex flex-wrap items-center gap-2">
      {CATEGORY_TABS.map((tab) => {
       const active = tab.key === activeTab;
       return (
        <button
         key={tab.key}
         type="button"
         onClick={() => setActiveTab(tab.key)}
         className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
          active
           ? "border-[#7C6B5D] bg-[#EAF4FF] text-[#2F5D85]"
           : "border-[#D9D0C8] bg-white text-[#6B5D55] hover:bg-[#EDE8E3]"
         }`}
        >
         {tab.label}
        </button>
       );
      })}
     </div>

     <div className="mt-3">
      <input
       type="search"
       value={searchQuery}
       onChange={(event) => setSearchQuery(event.target.value)}
       placeholder="Rechercher par titre ou catégorie"
       className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
      />
     </div>

     {formError && !formOpen && (
      <p className="mt-3 rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] px-3 py-2 text-sm text-[#A85C52]">
       {formError}
      </p>
     )}
    </section>

    <section className="rounded-2xl border border-[#D9D0C8] bg-white p-4 shadow-[0_1px_4px_rgba(44,36,32,0.06)] sm:p-5">
     {filteredDocuments.length === 0 ? (
      <p className="rounded-xl border border-dashed border-[#D9D0C8] bg-[#F5F0EB] px-4 py-8 text-center text-sm text-[#5C7896]">
       Aucun document trouvé pour ce filtre.
      </p>
     ) : (
      <div className="space-y-3">
       {filteredDocuments.map((item) => {
        const canDelete = user && item.uploaderUserId === user.id;
        const uploaderLabel = item.uploaderRole === "parent2" ? "Parent 2" : "Parent 1";

        return (
         <article
          key={item.id}
          className="rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] px-4 py-3"
         >
          <div className="flex flex-wrap items-start justify-between gap-3">
           <div className="min-w-[220px] flex-1">
            <p className="text-base font-semibold text-[#2C2420]">
             <FileText size={16} className="mr-2 inline-flex" />
             {item.title}
            </p>
            <p className="mt-1 text-sm text-[#6B5D55]">{categoryLabel(item.category)}</p>
            <p className="mt-1 text-xs text-[#5D7B99]">
             Ajouté le {formatDateTimeLabel(item.createdAt)} · Uploadé par {uploaderLabel}
            </p>
            {item.childName && (
             <p className="mt-1 text-xs text-[#5D7B99]">Enfant: {item.childName}</p>
            )}
            {item.description && (
             <p className="mt-1 text-sm text-[#6B5D55]">{item.description}</p>
            )}
           </div>

           <div className="flex flex-wrap items-center gap-2">
            <a
             href={item.fileUrl}
             target="_blank"
             rel="noreferrer"
             className="inline-flex items-center justify-center rounded-xl border border-[#D9D0C8] bg-white px-3 py-2 text-sm font-semibold text-[#6B5D55] transition hover:bg-[#EDE8E3]"
            >
               <Eye size={15} className="mr-2" />
               Voir
            </a>
            <a
             href={item.fileUrl}
             download
             className="inline-flex items-center justify-center rounded-xl border border-[#D9D0C8] bg-white px-3 py-2 text-sm font-semibold text-[#6B5D55] transition hover:bg-[#EDE8E3]"
            >
               <Download size={15} className="mr-2" />
               Télécharger
            </a>
            {canDelete && (
             <button
              type="button"
              onClick={() => {
               void onDeleteDocument(item);
              }}
              disabled={isDeletingId === item.id}
              className="inline-flex items-center justify-center rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] px-3 py-2 text-sm font-semibold text-[#A85C52] transition hover:bg-[#FFECEF] disabled:cursor-not-allowed disabled:opacity-70"
             >
                <Trash2 size={15} className="mr-2" />
                {isDeletingId === item.id ? "Suppression..." : "Supprimer"}
             </button>
            )}
           </div>
          </div>
         </article>
        );
       })}
      </div>
     )}
    </section>
   </main>

   {formOpen && (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0F223680] p-4 sm:items-center">
     <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/70 bg-white p-6 shadow-[0_20px_60px_rgba(15,36,54,0.22)]">
      <div className="mb-4 flex items-center justify-between">
      <h2 className="text-xl font-semibold text-[#2C2420]">Ajouter un document</h2>
       <button
        type="button"
        onClick={() => {
         if (isUploading) {
          return;
         }
         setFormOpen(false);
         resetForm();
        }}
        className="rounded-lg border border-[#D9D0C8] px-2 py-1 text-sm text-[#6B5D55] hover:bg-[#EDE8E3]"
       >
        <X size={14} />
       </button>
      </div>

      {formError && (
       <p className="mb-4 rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] px-3 py-2 text-sm text-[#A85C52]">
        {formError}
       </p>
      )}

      <form className="space-y-4" onSubmit={onSubmit}>
       <div>
        <label htmlFor="docTitle" className="mb-1 block text-sm font-medium text-[#6B5D55]">Titre du document</label>
        <input
         id="docTitle"
         type="text"
         value={docTitle}
         onChange={(event) => setDocTitle(event.target.value)}
         className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
         placeholder="Ex: Prescription orthodontie"
        />
       </div>

       <div>
        <label htmlFor="docCategory" className="mb-1 block text-sm font-medium text-[#6B5D55]">Catégorie</label>
        <select
         id="docCategory"
         value={docCategory}
         onChange={(event) => setDocCategory(event.target.value as DocumentCategory)}
         className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
        >
         {CATEGORY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
         ))}
        </select>
       </div>

       <div>
        <label htmlFor="docChild" className="mb-1 block text-sm font-medium text-[#6B5D55]">Concerne quel enfant (optionnel)</label>
        <input
         id="docChild"
         type="text"
         value={docChildName}
         onChange={(event) => setDocChildName(event.target.value)}
         className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
         placeholder="Ex: Emma"
        />
       </div>

       <div>
        <label htmlFor="docDescription" className="mb-1 block text-sm font-medium text-[#6B5D55]">Description courte (optionnel)</label>
        <textarea
         id="docDescription"
         value={docDescription}
         onChange={(event) => setDocDescription(event.target.value)}
         rows={3}
         className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
        />
       </div>

       <div>
        <label htmlFor="docFile" className="mb-1 block text-sm font-medium text-[#6B5D55]">Upload fichier (PDF, JPG, PNG, Word)</label>
        <input
         id="docFile"
         type="file"
         accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
         onChange={onFileChange}
         className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2 text-sm text-[#2C2420]"
        />
        {docFile && <p className="mt-1 text-xs text-[#5D7B99]">Fichier: {docFile.name}</p>}
       </div>

       <label className="flex items-center gap-3 rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] px-3 py-2 text-sm text-[#6B5D55]">
        <input
         type="checkbox"
         checked={shareWithLegal}
         onChange={(event) => setShareWithLegal(event.target.checked)}
         className="h-4 w-4 rounded border-[#C6D9EC] text-[#7C6B5D] focus:ring-[#7C6B5D]/30"
        />
        🔓 Partager avec l'avocat/médiateur
       </label>

       <button
        type="submit"
        disabled={isUploading}
        className="w-full rounded-xl bg-[#7C6B5D] px-4 py-3 text-sm font-semibold text-white shadow-[0_1px_4px_rgba(44,36,32,0.12)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
       >
        {isUploading ? "Téléversement..." : "Enregistrer le document"}
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
