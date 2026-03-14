"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
 CalendarIcon,
 DollarSign,
 FileText,
 MessageSquare,
 UserCircle,
 Users,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type ShellRoute = {
 href: string;
 label: string;
 title: string;
 icon: React.ComponentType<{ size?: number; className?: string }>;
 actionLabel?: string;
};

const PUBLIC_ROUTES = new Set(["/", "/login", "/signup"]);

const SHELL_ROUTES: ShellRoute[] = [
 { href: "/dashboard", label: "Tableau de bord", title: "Tableau de bord", icon: UserCircle },
 { href: "/calendar", label: "Calendrier", title: "Calendrier", icon: CalendarIcon },
 { href: "/messages", label: "Messages", title: "Messages", icon: MessageSquare },
 { href: "/expenses", label: "Dépenses", title: "Dépenses", icon: DollarSign },
 { href: "/documents", label: "Documents", title: "Documents", icon: FileText },
 { href: "/children", label: "Enfants", title: "Enfants", icon: Users },
 { href: "/profile", label: "Profil", title: "Profil", icon: UserCircle },
];

function isShellRoute(pathname: string): boolean {
 if (PUBLIC_ROUTES.has(pathname)) {
  return false;
 }

 return SHELL_ROUTES.some((route) => pathname.startsWith(route.href));
}

export default function AppShell({ children }: { children: React.ReactNode }) {
 const pathname = usePathname();
 const router = useRouter();
 const [firstName, setFirstName] = useState("Parent");
 const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

 const currentRoute = useMemo(() => {
  return SHELL_ROUTES.find((route) => pathname.startsWith(route.href)) ?? null;
 }, [pathname]);

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

 const pageTitle = currentRoute?.title ?? "2nest";

 return (
  <div className="min-h-screen bg-[#F5F0EB] text-[#2C2420]">
   <aside className="fixed inset-y-0 left-0 z-40 flex w-[240px] flex-col border-r border-[#7C6B5D] bg-[#2C2420] px-4 py-5">
    <div className="px-2">
     <p className="text-2xl font-bold tracking-tight text-white">2nest</p>
    </div>

    <nav className="mt-6 flex-1 space-y-1">
     {SHELL_ROUTES.map((route) => {
      const Icon = route.icon;
      const isActive = pathname.startsWith(route.href);
      return (
       <Link
        key={route.href}
        href={route.href}
        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
         isActive
          ? "bg-[#7C6B5D] text-white"
          : "text-white hover:bg-[#7C6B5D]/50"
        }`}
       >
        <Icon size={18} />
        <span>{route.label}</span>
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
        <div className="flex h-full w-full items-center justify-center text-white">
         <UserCircle size={18} />
        </div>
       )}
      </div>
      <div className="min-w-0">
       <p className="truncate text-sm font-semibold text-white">{firstName}</p>
       <button
        type="button"
        onClick={onSignOut}
        className="text-xs font-medium text-[#EDE8E3] hover:text-white"
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
