"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import {
 ACTIVE_FAMILY_STORAGE_KEY,
 fetchUserMemberships,
 type FamilyMembership,
 type FamilyPermissionSet,
 type FamilyRole,
 type FamilySummary,
 resolveActiveFamilyId,
 setStoredActiveFamilyId,
 ensureProfileExists,
 reconcilePendingFamilyInvites,
 getDefaultFamilyPermissions,
} from "@/lib/family";

type FamilyContextValue = {
 user: User | null;
 loading: boolean;
 configError: string;
 memberships: FamilyMembership[];
 activeFamilyId: string | null;
 activeFamily: FamilySummary | null;
 currentMembership: FamilyMembership | null;
 currentRole: FamilyRole | null;
 currentPermissions: FamilyPermissionSet;
 refreshFamilies: () => Promise<void>;
 setActiveFamily: (familyId: string) => void;
};

const FamilyContext = createContext<FamilyContextValue | null>(null);

const PUBLIC_ROUTES = new Set(["/", "/login", "/signup"]);
const GLOBAL_CHILD_FILTER_KEY = "twonest.selectedChildId";
const GLOBAL_CHILD_FILTER_NAME_KEY = "twonest.selectedChildName";

function emptyPermissions(): FamilyPermissionSet {
 return getDefaultFamilyPermissions("parent");
}

export function FamilyProvider({ children }: { children: React.ReactNode }) {
 const router = useRouter();
 const pathname = usePathname();
 const [user, setUser] = useState<User | null>(null);
 const [loading, setLoading] = useState(true);
 const [configError, setConfigError] = useState("");
 const [memberships, setMemberships] = useState<FamilyMembership[]>([]);
 const [activeFamilyId, setActiveFamilyId] = useState<string | null>(null);

 const refreshFamilies = async () => {
  try {
   const supabase = getSupabaseBrowserClient();
   const { data } = await supabase.auth.getUser();
   if (!data.user) {
    setUser(null);
    setMemberships([]);
    setActiveFamilyId(null);
    return;
   }

   await ensureProfileExists(data.user);
   await reconcilePendingFamilyInvites(data.user);
   const nextMemberships = await fetchUserMemberships(data.user);
   setUser(data.user);
   setMemberships(nextMemberships);
   const nextActiveFamilyId = resolveActiveFamilyId(
    nextMemberships,
    typeof window === "undefined" ? null : window.localStorage.getItem(ACTIVE_FAMILY_STORAGE_KEY),
   );
   setActiveFamilyId(nextActiveFamilyId);
   setStoredActiveFamilyId(nextActiveFamilyId);

   const isPublicRoute = PUBLIC_ROUTES.has(pathname);

   if (isPublicRoute && data.user) {
    router.replace("/dashboard");
   }
  } catch (error) {
     setMemberships([]);
     setActiveFamilyId(null);
     setStoredActiveFamilyId(null);
   setConfigError(
    error instanceof Error
     ? error.message
     : "Configuration Supabase manquante. Redemarre le serveur Next.js.",
   );
  }
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
   setLoading(false);
   return;
  }

  const load = async () => {
   const { data } = await supabase.auth.getUser();

   if (!data.user) {
    setUser(null);
    setMemberships([]);
    setActiveFamilyId(null);
    setLoading(false);

    if (!PUBLIC_ROUTES.has(pathname)) {
     router.replace("/");
    }
    return;
   }

   await refreshFamilies();
   setLoading(false);
  };

  void load();

  const {
   data: { subscription },
  } = supabase.auth.onAuthStateChange(async (_event, session) => {
   if (!session?.user) {
    setUser(null);
    setMemberships([]);
    setActiveFamilyId(null);
    setStoredActiveFamilyId(null);
    if (!PUBLIC_ROUTES.has(pathname)) {
      router.replace("/");
    }
    return;
   }

   await refreshFamilies();
  });

  const onFamilyChanged = (event: Event) => {
   const nextFamilyId = (event as CustomEvent<{ familyId?: string | null }>).detail?.familyId ?? null;
   setActiveFamilyId(nextFamilyId);
  };

  window.addEventListener("twonest:family-changed", onFamilyChanged);

  return () => {
   subscription.unsubscribe();
   window.removeEventListener("twonest:family-changed", onFamilyChanged);
  };
 }, [pathname, router]);

 const setActiveFamily = (familyId: string) => {
  setActiveFamilyId(familyId);
  setStoredActiveFamilyId(familyId);
  if (typeof window !== "undefined") {
   window.localStorage.setItem(GLOBAL_CHILD_FILTER_KEY, "all");
   window.localStorage.setItem(GLOBAL_CHILD_FILTER_NAME_KEY, "");
  }
 };

 const currentMembership = useMemo(
  () => memberships.find((membership) => membership.familyId === activeFamilyId) ?? null,
  [memberships, activeFamilyId],
 );

 const value = useMemo<FamilyContextValue>(() => ({
  user,
  loading,
  configError,
  memberships,
  activeFamilyId,
  activeFamily: currentMembership?.family ?? null,
  currentMembership,
  currentRole: currentMembership?.role ?? null,
  currentPermissions: currentMembership?.permissions ?? emptyPermissions(),
  refreshFamilies,
  setActiveFamily,
 }), [user, loading, configError, memberships, activeFamilyId, currentMembership]);

 return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

export function useFamily() {
 const context = useContext(FamilyContext);
 if (!context) {
  throw new Error("useFamily must be used inside FamilyProvider");
 }
 return context;
}