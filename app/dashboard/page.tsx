"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type DashboardAction = {
  label: string;
  emoji: string;
  href: string;
};

type ChildSummary = {
  id: string;
  firstName: string;
};

const GLOBAL_CHILD_FILTER_KEY = "twonest.selectedChildId";
const GLOBAL_CHILD_FILTER_NAME_KEY = "twonest.selectedChildName";

const ACTIONS: DashboardAction[] = [
  { emoji: "📅", label: "Calendrier", href: "/calendar" },
  { emoji: "💬", label: "Messages", href: "/messages" },
  { emoji: "💸", label: "Dépenses", href: "/expenses" },
  { emoji: "📁", label: "Documents", href: "/documents" },
  { emoji: "👶", label: "Enfants", href: "/children" },
  { emoji: "👤", label: "Mon profil", href: "/profile" },
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
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [configError, setConfigError] = useState("");
  const [children, setChildren] = useState<ChildSummary[]>([]);
  const [selectedChildFilter, setSelectedChildFilter] = useState("all");

  const resolveFamilyId = async (userId: string): Promise<string> => {
    const supabase = getSupabaseBrowserClient();
    const byUserId = await supabase.from("profiles").select("family_id").eq("user_id", userId).maybeSingle();
    const byId = byUserId.error || !byUserId.data
      ? await supabase.from("profiles").select("family_id").eq("id", userId).maybeSingle()
      : null;

    const row = (byUserId.data ?? byId?.data ?? null) as { family_id?: unknown } | null;
    return typeof row?.family_id === "string" && row.family_id.trim().length > 0 ? row.family_id : userId;
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
      return;
    }

    const loadSession = async () => {
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        router.replace("/");
        return;
      }

      setUser(data.user);

      const familyId = await resolveFamilyId(data.user.id);
      const byFamily = await supabase.from("children").select("*").eq("family_id", familyId).order("created_at", { ascending: true });
      const byUser = await supabase.from("children").select("*").eq("user_id", data.user.id).order("created_at", { ascending: true });
      const allRows = [
        ...(((byFamily.data ?? []) as Array<Record<string, unknown>>)),
        ...(((byUser.data ?? []) as Array<Record<string, unknown>>)),
      ];

      const dedupe = new Map<string, ChildSummary>();
      for (const row of allRows) {
        const childIdRaw = row.id;
        const childId = typeof childIdRaw === "string" || typeof childIdRaw === "number" ? String(childIdRaw) : "";
        if (!childId) {
          continue;
        }

        const firstNameRaw = row.first_name ?? row.prenom ?? row.name;
        const firstName = typeof firstNameRaw === "string" && firstNameRaw.trim().length > 0 ? firstNameRaw.trim() : "Enfant";
        if (!dedupe.has(childId)) {
          dedupe.set(childId, { id: childId, firstName });
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
  }, [router]);

  const firstName = useMemo(() => (user ? getFirstName(user) : "Parent"), [user]);

  const onChangeChildFilter = (value: string) => {
    setSelectedChildFilter(value);
    window.localStorage.setItem(GLOBAL_CHILD_FILTER_KEY, value);
    window.localStorage.setItem("twonest.selectedChildFilter", value);

    if (value === "all") {
      window.localStorage.setItem(GLOBAL_CHILD_FILTER_NAME_KEY, "");
      return;
    }

    const selectedChild = children.find((item) => item.id === value);
    window.localStorage.setItem(GLOBAL_CHILD_FILTER_NAME_KEY, selectedChild?.firstName ?? "");
  };

  const handleSignOut = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/");
  };

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#F6FAFF] to-[#EEF5FC] px-6">
        <p className="text-sm font-medium text-[#5B7691]">Chargement de votre espace 2nest...</p>
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
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#F6FAFF] via-[#F0F7FE] to-[#EAF3FC] px-6 py-10">
      <div className="pointer-events-none absolute -top-32 -left-24 h-80 w-80 rounded-full bg-[#4A90D9]/20 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-[#80B7EA]/20 blur-3xl" />

      <main className="relative mx-auto flex w-full max-w-4xl flex-col gap-8 rounded-3xl border border-white/70 bg-white/90 p-8 shadow-[0_24px_80px_rgba(38,78,120,0.12)] backdrop-blur-sm sm:p-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-[#5F81A3]">TABLEAU DE BORD</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#17324D]">Bonjour {firstName} 🪺</h1>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center justify-center rounded-xl border border-[#D0DFEE] px-4 py-2 text-sm font-semibold text-[#365A7B] transition hover:bg-[#F1F7FD]"
          >
            Se deconnecter
          </button>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 rounded-2xl border border-[#D7E6F4] bg-[#F8FBFF] p-4">
            <label htmlFor="global-child-filter" className="mb-2 block text-sm font-semibold text-[#365A7B]">
              Voir pour :
            </label>
            <select
              id="global-child-filter"
              value={selectedChildFilter}
              onChange={(event) => onChangeChildFilter(event.target.value)}
              className="w-full rounded-xl border border-[#D8E4F0] bg-white px-3 py-2.5 text-sm text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
            >
              <option value="all">Tous les enfants</option>
              {children.map((child) => (
                <option key={child.id} value={child.id}>{child.firstName}</option>
              ))}
            </select>
          </div>

          {ACTIONS.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="group rounded-2xl border border-[#D7E6F4] bg-white p-6 text-left shadow-[0_8px_26px_rgba(74,144,217,0.08)] transition hover:-translate-y-0.5 hover:border-[#B8D5EF] hover:shadow-[0_12px_32px_rgba(74,144,217,0.16)]"
            >
              <span className="text-2xl" aria-hidden="true">
                {action.emoji}
              </span>
              <p className="mt-4 text-lg font-semibold text-[#214567] group-hover:text-[#2E6395]">{action.label}</p>
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}
