"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  CalendarIcon,
  CheckSquare,
  DollarSign,
  FileText,
  MessageSquare,
  UserCircle,
  Users,
  ShoppingBag,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { useFamily } from "@/components/FamilyProvider";
import { getFeatureAccess, type FeatureKey } from "@/lib/family";


type DashboardModule = {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  feature: FeatureKey;
  getDescription: (data?: Record<string, unknown>) => string;
};

type ChildSummary = {
  id: string;
  displayName: string;
};

const GLOBAL_CHILD_FILTER_KEY = "twonest.selectedChildId";
const GLOBAL_CHILD_FILTER_NAME_KEY = "twonest.selectedChildName";
const JOINED_FAMILY_NAME_KEY = "twonest.joinedFamilyName";

const MODULES: DashboardModule[] = [
  {
    label: "Calendrier",
    href: "/calendar",
    icon: CalendarIcon,
    feature: "calendar",
    getDescription: () => "3 événements cette semaine",
  },
  {
    label: "Messages",
    href: "/messages",
    icon: MessageSquare,
    feature: "messages",
    getDescription: () => "2 messages non lus",
  },
  {
    label: "Dépenses",
    href: "/expenses",
    icon: DollarSign,
    feature: "expenses",
    getDescription: () => "Solde : Parent 2 doit 127$",
  },
  {
    label: "Documents",
    href: "/documents",
    icon: FileText,
    feature: "documents",
    getDescription: () => "5 documents",
  },
  {
    label: "Enfants",
    href: "/children",
    icon: Users,
    feature: "children",
    getDescription: (data) => {
      const childCount = (data?.childCount as number) || 0;
      return childCount > 0 ? `${childCount} ${childCount === 1 ? "enfant" : "enfants"}` : "Aucun enfant";
    },
  },
  {
    label: "Tâches",
    href: "/tasks",
    icon: CheckSquare,
    feature: "tasks",
    getDescription: () => "4 tâches en attente",
  },
  {
    label: "Épicerie",
    href: "/grocery",
    icon: ShoppingBag,
    feature: "grocery",
    getDescription: (data) => {
      const count = (data?.groceryCount as number) || 0;
      return count > 0 ? `${count} items sur la liste` : "Liste vide";
    },
  },
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

function formatDate(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  return date.toLocaleDateString("fr-FR", options);
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
  const [groceryCount, setGroceryCount] = useState(0);

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
          : "Configuration Supabase manquante. Redémarre le serveur Next.js.",
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

      // Load grocery count
      if (familyId) {
        const groceryResponse = await supabase
          .from("grocery_items")
          .select("id")
          .eq("family_id", familyId)
          .eq("is_checked", false);
        setGroceryCount((groceryResponse.data ?? []).length);
      }

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
  const visibleModules = useMemo(() => {
    if (!currentRole) {
      return [];
    }
    return MODULES.filter((module) => getFeatureAccess(module.feature, currentRole, currentPermissions).allowed);
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
      <div className="flex min-h-screen items-center justify-center bg-[#F5F0EB] px-6">
        <p className="text-sm font-medium text-[#6B5D55]">Chargement de votre espace 2nest...</p>
      </div>
    );
  }

  if (configError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F0EB] px-6">
        <p className="max-w-xl text-center text-sm font-medium text-[#A85C52]">{configError}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F0EB]">
      {/* Header */}
      <div className="border-b border-[#E1D6CB] bg-white/95 backdrop-blur-sm sticky top-0 z-30">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-[#2C2420] tracking-tight">
                Bonjour {firstName} 👋
              </h1>
              <p className="mt-2 text-base text-[#6B5D55]">
                {formatDate(new Date())}
              </p>
              {activeFamily && (
                <p className="mt-1 text-sm text-[#A89080]">Espace : {activeFamily.name}</p>
              )}
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 rounded-lg border border-[#D9D0C8] bg-white px-4 py-2 text-sm font-semibold text-[#6B5D55] transition hover:bg-[#F9F7F3]"
            >
              <LogOut size={16} />
              Se déconnecter
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-6 py-8 space-y-8">
        {joinedFamilyMessage && (
          <div className="rounded-2xl border border-[#D9D0C8] bg-[#F0F8F3] px-6 py-4">
            <p className="text-sm font-medium text-[#2C2420]">{joinedFamilyMessage}</p>
          </div>
        )}

        {/* Today's Overview Card */}
        <Link
          href="/calendar"
          className="group block rounded-2xl border border-[#D9D0C8] bg-white p-8 shadow-sm hover:shadow-md transition"
        >
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-[#2C2420]">Aujourd'hui</h2>
              <div className="mt-4 space-y-2">
                <p className="text-base text-[#6B5D55]">📅 <span className="font-semibold">3 événements cette semaine</span></p>
                <p className="text-base text-[#6B5D55]">✅ <span className="font-semibold">4 tâches à faire</span></p>
                <p className="text-base text-[#6B5D55]">👶 <span className="font-semibold">Changement de garde à 18h</span></p>
              </div>
            </div>
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#7C6B5D]/10">
              <ChevronRight size={24} className="text-[#7C6B5D]" />
            </div>
          </div>
        </Link>

        {/* Child Filter */}
        <div className="rounded-2xl border border-[#D9D0C8] bg-white p-6">
          <label htmlFor="child-filter" className="block text-sm font-semibold text-[#6B5D55] mb-3">
            Affichage pour :
          </label>
          <select
            id="child-filter"
            value={selectedChildFilter}
            onChange={(e) => onChangeChildFilter(e.target.value)}
            className="w-full rounded-xl border border-[#D9D0C8] bg-[#F9F7F3] px-4 py-3 text-sm text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-2 focus:ring-[#7C6B5D]/20"
          >
            <option value="all">Tous les enfants</option>
            {children.map((child) => (
              <option key={child.id} value={child.id}>
                {child.displayName}
              </option>
            ))}
          </select>
        </div>

        {/* Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleModules.map((module) => {
            const Icon = module.icon;
            const description = module.getDescription({ childCount: children.length, groceryCount });
            return (
              <Link
                key={module.label}
                href={module.href}
                className="group block rounded-2xl border border-[#D9D0C8] bg-white p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7C6B5D]/10 mb-4">
                      <Icon size={20} className="text-[#7C6B5D]" />
                    </div>
                    <h3 className="text-lg font-bold text-[#2C2420]">{module.label}</h3>
                    <p className="mt-2 text-sm text-[#6B5D55]">{description}</p>
                  </div>
                  <ChevronRight size={18} className="text-[#D9D0C8] group-hover:text-[#7C6B5D] transition flex-shrink-0 mt-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}

