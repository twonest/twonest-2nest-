"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
 CalendarIcon,
 CheckSquare,
 ChevronDown,
 DollarSign,
 FileText,
 Home,
 MessageSquare,
 UserCircle,
 Users,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { FamilyProvider, useFamily } from "@/components/FamilyProvider";
import { familyRoleLabel, familyTypeLabel, getFeatureAccess, type FeatureKey } from "@/lib/family";

type ShellRoute = {
 href: string;
 label: string;
 title: string;
 icon: React.ComponentType<{ size?: number; className?: string }>;
 feature: FeatureKey;
};

const PUBLIC_ROUTES = new Set(["/", "/login", "/signup"]);

const SHELL_ROUTES: ShellRoute[] = [
 { href: "/dashboard", label: "Tableau de bord", title: "Tableau de bord", icon: Home, feature: "dashboard" },
 { href: "/calendar", label: "Calendrier", title: "Calendrier", icon: CalendarIcon, feature: "calendar" },
 { href: "/messages", label: "Messages", title: "Messages", icon: MessageSquare, feature: "messages" },
 { href: "/tasks", label: "Tâches", title: "Tâches", icon: CheckSquare, feature: "tasks" },
 { href: "/expenses", label: "Dépenses", title: "Dépenses", icon: DollarSign, feature: "expenses" },
 { href: "/documents", label: "Documents", title: "Documents", icon: FileText, feature: "documents" },
 { href: "/children", label: "Enfants", title: "Enfants", icon: Users, feature: "children" },
 { href: "/spaces", label: "Espaces", title: "Espaces", icon: Users, feature: "spaces" },
 { href: "/profile", label: "Profil", title: "Profil", icon: UserCircle, feature: "profile" },
];

function isShellRoute(pathname: string): boolean {
 if (PUBLIC_ROUTES.has(pathname)) {
  return false;
 }

 return SHELL_ROUTES.some((route) => pathname.startsWith(route.href));
}

export default function AppShell({ children }: { children: React.ReactNode }) {
 return (
  <FamilyProvider>
   <ShellContent>{children}</ShellContent>
  </FamilyProvider>
 );
}

function ShellContent({ children }: { children: React.ReactNode }) {
 const pathname = usePathname();
 const router = useRouter();
 const { memberships, activeFamily, activeFamilyId, currentMembership, currentRole, currentPermissions, setActiveFamily, loading } = useFamily();
 const [firstName, setFirstName] = useState("Parent");
 const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
 const [selectorOpen, setSelectorOpen] = useState(false);
 const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
 const [overdueTasksCount, setOverdueTasksCount] = useState(0);

 const currentRoute = useMemo(() => {
  return SHELL_ROUTES.find((route) => pathname.startsWith(route.href)) ?? null;
 }, [pathname]);

 const visibleRoutes = useMemo(() => {
  if (!currentRole) {
   return SHELL_ROUTES.filter((route) => route.feature === "profile");
  }

  return SHELL_ROUTES.filter((route) => getFeatureAccess(route.feature, currentRole, currentPermissions).allowed);
 }, [currentPermissions, currentRole]);

 useEffect(() => {
  if (!isShellRoute(pathname)) {
   return;
  }

  const loadProfile = async () => {
   try {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) {
     return;
    }

    const profileByUser = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
    const profileById = profileByUser.error || !profileByUser.data
     ? await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()
     : null;

    const profile = (profileByUser.data ?? profileById?.data ?? null) as Record<string, unknown> | null;

    const candidateFirstName =
     typeof profile?.first_name === "string"
      ? profile.first_name
      : typeof profile?.prenom === "string"
       ? profile.prenom
       : typeof user.user_metadata?.first_name === "string"
        ? user.user_metadata.first_name
        : typeof user.user_metadata?.prenom === "string"
         ? user.user_metadata.prenom
         : typeof user.email === "string"
          ? user.email.split("@")[0]
          : "Parent";

    setFirstName(candidateFirstName.trim() || "Parent");

    const candidateAvatar =
     typeof profile?.avatar_url === "string"
      ? profile.avatar_url
      : typeof profile?.photo_url === "string"
       ? profile.photo_url
       : null;

    setAvatarUrl(candidateAvatar && candidateAvatar.trim().length > 0 ? candidateAvatar : null);
   } catch {
    setFirstName("Parent");
   }
  };

  loadProfile();
 }, [pathname]);

 useEffect(() => {
  setSelectorOpen(false);
 }, [pathname, activeFamilyId]);

 useEffect(() => {
  let unsubscribed = false;
  let cleanupRealtime: (() => void) | null = null;

  const setupUnreadBadge = async () => {
   if (!activeFamilyId || !isShellRoute(pathname)) {
    setUnreadMessagesCount(0);
    return;
   }

   try {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.auth.getUser();
    const user = data.user;

    if (!user) {
      setUnreadMessagesCount(0);
      return;
    }

    const refreshUnread = async () => {
      const countQuery = await supabase
       .from("messages")
       .select("id", { count: "exact", head: true })
       .eq("family_id", activeFamilyId)
       .neq("sender_id", user.id)
       .is("read_at", null);

      if (countQuery.error) {
       setUnreadMessagesCount(0);
       return;
      }

      if (!unsubscribed) {
       setUnreadMessagesCount(countQuery.count ?? 0);
      }
    };

    await refreshUnread();

    const channel = supabase
     .channel(`sidebar-unread-${activeFamilyId}-${user.id}`)
     .on(
      "postgres_changes",
      {
       event: "*",
       schema: "public",
       table: "messages",
       filter: `family_id=eq.${activeFamilyId}`,
      },
      async () => {
       await refreshUnread();
      },
     )
     .subscribe();

    cleanupRealtime = () => {
      channel.unsubscribe();
    };
   } catch {
    setUnreadMessagesCount(0);
   }
  };

  void setupUnreadBadge();

  return () => {
   unsubscribed = true;
   cleanupRealtime?.();
  };
 }, [activeFamilyId, pathname]);

 useEffect(() => {
  let unsubscribed = false;
  let cleanupRealtime: (() => void) | null = null;

  const setupOverdueBadge = async () => {
   if (!activeFamilyId || !isShellRoute(pathname)) {
    setOverdueTasksCount(0);
    return;
   }

   try {
    const supabase = getSupabaseBrowserClient();

    const refreshOverdue = async () => {
      const nowIso = new Date().toISOString();
      const countQuery = await supabase
       .from("tasks")
       .select("id", { count: "exact", head: true })
       .eq("family_id", activeFamilyId)
       .not("due_date", "is", null)
       .lt("due_date", nowIso)
       .is("completed_at", null);

      if (countQuery.error) {
       setOverdueTasksCount(0);
       return;
      }

      if (!unsubscribed) {
       setOverdueTasksCount(countQuery.count ?? 0);
      }
    };

    await refreshOverdue();

    const channel = supabase
     .channel(`sidebar-overdue-${activeFamilyId}`)
     .on(
      "postgres_changes",
      {
       event: "*",
       schema: "public",
       table: "tasks",
       filter: `family_id=eq.${activeFamilyId}`,
      },
      async () => {
       await refreshOverdue();
      },
     )
     .subscribe();

    cleanupRealtime = () => {
      channel.unsubscribe();
    };
   } catch {
    setOverdueTasksCount(0);
   }
  };

  void setupOverdueBadge();

  return () => {
   unsubscribed = true;
   cleanupRealtime?.();
  };
 }, [activeFamilyId, pathname]);

 const onSignOut = async () => {
  try {
   const supabase = getSupabaseBrowserClient();
   await supabase.auth.signOut();
  } finally {
   router.replace("/");
  }
 };

 if (!isShellRoute(pathname)) {
  return <>{children}</>;
 }

 if (loading) {
  return (
   <div className="flex min-h-screen items-center justify-center bg-[#F5F0EB] px-6">
  <p className="text-sm font-medium text-[#6B5D55]">Chargement de vos espaces 2nest...</p>
   </div>
  );
 }

 const pageTitle = currentRoute?.title ?? "2nest";

 return (
  <div className="min-h-screen bg-[#F5F0EB] text-[#2C2420]">
   <aside className="fixed inset-y-0 left-0 z-40 flex w-[240px] flex-col border-r border-[#7C6B5D] bg-[#2C2420] px-4 py-5" style={{ color: "#FFFFFF" }}>
    <div className="px-2">
      <p className="text-2xl font-bold tracking-tight text-[#FFFFFF]" style={{ color: "#FFFFFF" }}>2nest</p>
    </div>

  <div className="relative mt-5 px-2">
   <button
    type="button"
    onClick={() => setSelectorOpen((current) => !current)}
    className="flex w-full items-center justify-between rounded-xl border border-[#A89080] bg-transparent px-3 py-3 text-left text-sm font-medium text-[#FFFFFF]"
   >
    <div className="min-w-0">
   <p className="truncate font-medium text-[#FFFFFF]" style={{ color: "#FFFFFF" }}>{activeFamily?.name ?? "Choisir un espace"}</p>
     {currentMembership && (
   <p className="truncate text-xs text-[#FFFFFF]" style={{ color: "#FFFFFF" }}>
     {familyRoleLabel(currentMembership.role)} · {familyTypeLabel(activeFamily?.type ?? "family")}
    </p>
     )}
    </div>
    <ChevronDown size={16} className={`text-[#FFFFFF] transition ${selectorOpen ? "rotate-180" : ""}`} />
   </button>

   {selectorOpen && (
    <div className="absolute inset-x-2 top-[calc(100%+8px)] z-50 rounded-xl border border-[#A89080] bg-[#2C2420] p-2 shadow-[0_20px_40px_rgba(0,0,0,0.25)]">
     <div className="space-y-1">
    {memberships.map((membership) => {
     const isActive = membership.familyId === activeFamilyId;
     return (
      <button
       key={membership.id}
       type="button"
       onClick={() => {
      setActiveFamily(membership.familyId);
      router.refresh();
       }}
       className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
      isActive ? "bg-[#7C6B5D] text-[#FFFFFF]" : "text-[#FFFFFF] hover:bg-[#3D3028]"
       }`}
      >
       <div className="min-w-0">
      <p className="truncate font-medium text-[#FFFFFF]" style={{ color: "#FFFFFF" }}>{membership.family.name}</p>
      <p className="truncate text-xs text-[#FFFFFF]" style={{ color: "#FFFFFF" }}>{familyRoleLabel(membership.role)}</p>
       </div>
       {isActive ? <span className="text-xs font-semibold text-[#FFFFFF]">✓</span> : null}
      </button>
     );
    })}
     </div>

      <div className="my-2 border-t border-[#A89080]" />

     <Link
    href="/spaces/new"
   className="block rounded-lg px-3 py-2 text-sm font-medium text-[#FFFFFF] transition hover:bg-[#3D3028]"
   style={{ color: "#FFFFFF" }}
     >
    + Créer un nouvel espace
     </Link>
    </div>
   )}
  </div>

    <nav className="mt-6 flex-1 space-y-1">
   {visibleRoutes.map((route) => {
      const Icon = route.icon;
      const isActive = pathname.startsWith(route.href);
      return (
       <Link
        key={route.href}
        href={route.href}
        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
         isActive
          ? "bg-[#7C6B5D] text-[#FFFFFF]"
          : "text-[#FFFFFF] hover:bg-[#7C6B5D]/50"
        }`}
       >
        <Icon size={18} />
        <span className="flex items-center gap-2">
         <span>{route.label}</span>
         {route.href === "/messages" && unreadMessagesCount > 0 && !pathname.startsWith("/messages") && (
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#C93C3C] px-1.5 text-[10px] font-semibold text-white">
           {unreadMessagesCount > 99 ? "99+" : unreadMessagesCount}
          </span>
         )}
         {route.href === "/tasks" && overdueTasksCount > 0 && !pathname.startsWith("/tasks") && (
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#C93C3C] px-1.5 text-[10px] font-semibold text-white">
           {overdueTasksCount > 99 ? "99+" : overdueTasksCount}
          </span>
         )}
        </span>
       </Link>
      );
     })}
    </nav>

    <div className="rounded-xl border border-[#7C6B5D] bg-[#3A312B] p-3">
     <div className="flex items-center gap-3">
      <div className="h-9 w-9 overflow-hidden rounded-full bg-[#7C6B5D]">
       {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="Profil" className="h-full w-full object-cover" />
       ) : (
        <div className="flex h-full w-full items-center justify-center text-[#FFFFFF]">
         <UserCircle size={18} />
        </div>
       )}
      </div>
      <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#FFFFFF]" style={{ color: "#FFFFFF" }}>{firstName}</p>
        {activeFamily && (
             <p className="truncate text-xs text-[#FFFFFF]" style={{ color: "#FFFFFF" }}>{activeFamily.name}</p>
        )}
       <button
        type="button"
        onClick={onSignOut}
        className="text-xs font-medium text-[#FFFFFF] hover:text-white"
       >
        Se déconnecter
       </button>
      </div>
     </div>
    </div>
   </aside>

   <div className="ml-[240px] min-h-screen">
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#D9D0C8] bg-[#F5F0EB] px-6">
     <h1 className="text-2xl font-bold text-[#2C2420]">{pageTitle}</h1>
     <div className="flex items-center gap-2">
     </div>
    </header>

    <div className="px-6 py-6">{children}</div>
   </div>
  </div>
 );
}
