"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { CalendarIcon, CheckSquare, DollarSign, FileText, MessageSquare, UserCircle, Users } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { useFamily } from "@/components/FamilyProvider";
import { getFeatureAccess, type FeatureKey } from "@/lib/family";

type DashboardAction = {
 label: string;
 href: string;
 icon: React.ComponentType<{ size?: number; className?: string }>;
 feature: FeatureKey;
};

type ChildSummary = {
 id: string;
 displayName: string;
};

const GLOBAL_CHILD_FILTER_KEY = "twonest.selectedChildId";
const GLOBAL_CHILD_FILTER_NAME_KEY = "twonest.selectedChildName";
const JOINED_FAMILY_NAME_KEY = "twonest.joinedFamilyName";

const ACTIONS: DashboardAction[] = [
 { label: "Calendrier", href: "/calendar", icon: CalendarIcon, feature: "calendar" },
 { label: "Messages", href: "/messages", icon: MessageSquare, feature: "messages" },
 { label: "Taches", href: "/tasks", icon: CheckSquare, feature: "tasks" },
 { label: "Dépenses", href: "/expenses", icon: DollarSign, feature: "expenses" },
 { label: "Documents", href: "/documents", icon: FileText, feature: "documents" },
 { label: "Enfants", href: "/children", icon: Users, feature: "children" },
 { label: "Mon profil", href: "/profile", icon: UserCircle, feature: "profile" },
];

function getFirstName(user: User): string {
 const metadata = user.user_metadata ?? {};
 const firstName =
  metadata.first_name ??
  metadata.prenom ??
  (typeof metadata.name === "string" ? metadata.name.split(" ")[0] : undefined);

 if (typeof firstName === "string" && firstName.trim().length > 0) {
  return firstName.trim();
 }

 const emailPrefix = user.email?.split("@")[0]?.trim();
 if (emailPrefix && emailPrefix.length > 0) {
  return emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
 }

 return "Parent";
}

export default function DashboardPage() {
 const router = useRouter();
 const { activeFamilyId, activeFamily, currentRole, currentPermissions } = useFamily();
 const [user, setUser] = useState<User | null>(null);
 const [checkingSession, setCheckingSession] = useState(true);
 const [configError, setConfigError] = useState("");
 const [children, setChildren] = useState<ChildSummary[]>([]);
 const [selectedChildFilter, setSelectedChildFilter] = useState("all");
 const [joinedFamilyMessage, setJoinedFamilyMessage] = useState("");

 useEffect(() => {
  if (typeof window === "undefined") {
   return;
  }

  const joinedFamilyName = window.localStorage.getItem(JOINED_FAMILY_NAME_KEY);
  if (joinedFamilyName && joinedFamilyName.trim().length > 0) {
   setJoinedFamilyMessage(`Vous avez rejoint l'espace ${joinedFamilyName.trim()} !`);
   window.localStorage.removeItem(JOINED_FAMILY_NAME_KEY);
  }
 }, []);

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

  const loadSession = async () => {
   const { data } = await supabase.auth.getUser();

   if (!data.user) {
    router.replace("/");
    return;
   }

   setUser(data.user);

  const familyId = activeFamilyId ?? null;
   const byFamily = familyId
    ? await supabase.from("children").select("*").eq("family_id", familyId).order("created_at", { ascending: true })
    : { data: [] as Array<Record<string, unknown>> };
   const allRows = [
    ...(((byFamily.data ?? []) as Array<Record<string, unknown>>)),
   ];

   const dedupe = new Map<string, ChildSummary>();
   for (const row of allRows) {
    const childIdRaw = row.id;
    const childId = typeof childIdRaw === "string" || typeof childIdRaw === "number" ? String(childIdRaw) : "";
    if (!childId) {
     continue;
    }

    const firstNameRaw = row.first_name ?? row.prenom ?? row.name;
    const lastNameRaw = row.last_name ?? row.nom;
    const firstName = typeof firstNameRaw === "string" && firstNameRaw.trim().length > 0 ? firstNameRaw.trim() : "Enfant";
    const lastName = typeof lastNameRaw === "string" && lastNameRaw.trim().length > 0 ? lastNameRaw.trim() : "";
    const displayName = `${firstName} ${lastName}`.trim();
    if (!dedupe.has(childId)) {
     dedupe.set(childId, { id: childId, displayName });
    }
   }
   setChildren(Array.from(dedupe.values()));

   const savedFilter = window.localStorage.getItem(GLOBAL_CHILD_FILTER_KEY) ?? "all";
   setSelectedChildFilter(savedFilter);
   setCheckingSession(false);
  };

  loadSession();

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
 }, [activeFamilyId, router]);

 const firstName = useMemo(() => (user ? getFirstName(user) : "Parent"), [user]);
 const visibleActions = useMemo(() => {
  if (!currentRole) {
   return ACTIONS.filter((action) => action.feature === "profile");
  }
  return ACTIONS.filter((action) => getFeatureAccess(action.feature, currentRole, currentPermissions).allowed);
 }, [currentPermissions, currentRole]);

 const onChangeChildFilter = (value: string) => {
  setSelectedChildFilter(value);
  window.localStorage.setItem(GLOBAL_CHILD_FILTER_KEY, value);
  window.localStorage.setItem("twonest.selectedChildFilter", value);

  if (value === "all") {
   window.localStorage.setItem(GLOBAL_CHILD_FILTER_NAME_KEY, "");
   return;
  }

  const selectedChild = children.find((item) => item.id === value);
  window.localStorage.setItem(GLOBAL_CHILD_FILTER_NAME_KEY, selectedChild?.displayName ?? "");
 };

 const handleSignOut = async () => {
  const supabase = getSupabaseBrowserClient();
  await supabase.auth.signOut();
  router.replace("/");
 };

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

   <main className="relative mx-auto flex w-full max-w-4xl flex-col gap-8 rounded-3xl border border-white/70 bg-white/90 p-8 shadow-[0_2px_8px_rgba(44,36,32,0.08)] backdrop-blur-sm sm:p-10">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
     <div>
      <p className="text-xs font-semibold tracking-[0.2em] text-[#A89080]">TABLEAU DE BORD</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#2C2420]">Bonjour {firstName}</h1>
            {activeFamily && (
        <p className="mt-2 text-sm text-[#6B5D55]">Espace actif : {activeFamily.name}</p>
            )}
     </div>
     <button
      type="button"
      onClick={handleSignOut}
      className="inline-flex items-center justify-center rounded-xl border border-[#D9D0C8] px-4 py-2 text-sm font-semibold text-[#6B5D55] transition hover:bg-[#EDE8E3]"
     >
      Se deconnecter
     </button>
    </header>

    <section className="grid gap-4 sm:grid-cols-2">
       {joinedFamilyMessage && (
        <p className="sm:col-span-2 rounded-xl border border-[#D9D0C8] bg-[#F3F8F1] px-4 py-3 text-sm text-[#57745F]">
         {joinedFamilyMessage}
        </p>
       )}

     <div className="sm:col-span-2 rounded-2xl border border-[#D9D0C8] bg-[#F5F0EB] p-4">
      <label htmlFor="global-child-filter" className="mb-2 block text-sm font-semibold text-[#6B5D55]">
       Voir pour :
      </label>
      <select
       id="global-child-filter"
       value={selectedChildFilter}
       onChange={(event) => onChangeChildFilter(event.target.value)}
       className="w-full rounded-xl border border-[#D9D0C8] bg-white px-3 py-2.5 text-sm text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
      >
       <option value="all">Tous les enfants</option>
       {children.map((child) => (
        <option key={child.id} value={child.id}>{child.displayName}</option>
       ))}
      </select>
     </div>

     <Link
      href="/tasks"
      className="sm:col-span-2 rounded-2xl border border-[#D9D0C8] bg-[#FFF9F3] p-5 shadow-[0_1px_4px_rgba(44,36,32,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_2px_8px_rgba(44,36,32,0.08)]"
     >
      <p className="text-xs font-semibold tracking-[0.16em] text-[#A89080]">TABLEAU DE BORD TACHES</p>
      <p className="mt-2 text-lg font-semibold text-[#2C2420]">Voir la repartition Parent 1 / Parent 2</p>
      <p className="mt-1 text-sm text-[#6B5D55]">Filtres semaine, mois, annee et categorie disponibles.</p>
     </Link>

     <Link
      href="/calendar"
      className="sm:col-span-2 rounded-2xl border border-[#D9D0C8] bg-[#F5FAFF] p-5 shadow-[0_1px_4px_rgba(44,36,32,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_2px_8px_rgba(44,36,32,0.08)]"
     >
      <p className="text-xs font-semibold tracking-[0.16em] text-[#7C98B8]">COLLECTES</p>
      <p className="mt-2 text-lg font-semibold text-[#2C2420]">Configurer poubelles, recyclage et compost</p>
      <p className="mt-1 text-sm text-[#6B5D55]">Dans le calendrier: bouton 🗑️ Collectes puis sauvegarde des jours.</p>
     </Link>

     {visibleActions.map((action) => {
      const Icon = action.icon;
      return (
       <Link
        key={action.label}
        href={action.href}
        className="group rounded-2xl border border-[#D9D0C8] bg-white p-6 text-left shadow-[0_1px_4px_rgba(44,36,32,0.06)] transition hover:-translate-y-0.5 hover:border-[#D9D0C8] hover:shadow-[0_2px_8px_rgba(44,36,32,0.08)]"
       >
        <Icon size={22} className="text-[#7C6B5D]" />
        <p className="mt-4 text-lg font-semibold text-[#2C2420] group-hover:text-[#7C6B5D]">{action.label}</p>
       </Link>
      );
     })}
    </section>
   </main>
  </div>
 );
}
