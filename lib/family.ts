import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export const ACTIVE_FAMILY_STORAGE_KEY = "twonest.activeFamilyId";
export const FAMILY_CHANGED_EVENT = "twonest:family-changed";

export type FamilyType = "family" | "coparenting" | "solo";

export type FamilyRole = "parent" | "step_parent" | "grand_parent" | "mediator";

export type ChildPermissionKey =
 | "calendar"
 | "school_info"
 | "emergency_contacts"
 | "medical_record"
 | "legal_documents"
 | "expenses";

export type FamilyPermissionKey =
 | ChildPermissionKey
 | "messages"
 | "invite_members"
 | "space_settings"
 | "custody_journal";

export type FeatureKey =
 | "dashboard"
 | "calendar"
 | "messages"
 | "expenses"
 | "documents"
 | "children"
 | "profile"
 | "spaces";

export type FamilyPermissionSet = Record<FamilyPermissionKey, boolean>;

export type FamilySummary = {
 id: string;
 name: string;
 type: FamilyType;
 createdBy: string | null;
 createdAt: string | null;
 memberCount: number;
};

export type FamilyMembership = {
 id: string;
 familyId: string;
 userId: string | null;
 role: FamilyRole;
 status: "active" | "pending";
 inviteEmail: string | null;
 permissions: FamilyPermissionSet;
 invitedBy: string | null;
 createdAt: string | null;
 family: FamilySummary;
};

export type ChildPermissionRecord = {
 id: string;
 childId: string;
 userId: string;
 grantedBy: string | null;
 permissions: Partial<Record<ChildPermissionKey, boolean>>;
 createdAt: string | null;
};

export type FeatureAccess = {
 allowed: boolean;
 readOnly: boolean;
 reason: string;
};

const DEFAULT_CHILD_PERMISSIONS: ChildPermissionKey[] = ["calendar", "school_info", "emergency_contacts"];

const FAMILY_ROUTE_PERMISSIONS: Record<FeatureKey, (role: FamilyRole, permissions: FamilyPermissionSet, hasChildAccess: boolean) => FeatureAccess> = {
 dashboard: () => ({ allowed: true, readOnly: true, reason: "" }),
 calendar: (role, permissions) => {
  if (role === "parent") {
   return { allowed: true, readOnly: false, reason: "" };
  }
  if (role === "step_parent" && permissions.calendar) {
   return { allowed: true, readOnly: true, reason: "" };
  }
  if (role === "grand_parent") {
   return { allowed: true, readOnly: true, reason: "" };
  }
  if (role === "mediator" && permissions.custody_journal) {
   return { allowed: true, readOnly: true, reason: "" };
  }
  return { allowed: false, readOnly: true, reason: "Votre rôle ne permet pas d’accéder au calendrier de cet espace." };
 },
 messages: (role, permissions) => {
  if (role === "parent") {
   return { allowed: true, readOnly: false, reason: "" };
  }
  if (role === "step_parent" && permissions.messages) {
   return { allowed: true, readOnly: false, reason: "" };
  }
  return { allowed: false, readOnly: true, reason: "Les messages privés ne sont pas disponibles pour ce rôle." };
 },
 expenses: (role, permissions) => {
  if (role === "parent") {
   return { allowed: true, readOnly: false, reason: "" };
  }
  if (role === "step_parent" && permissions.expenses) {
   return { allowed: true, readOnly: true, reason: "" };
  }
  if (role === "mediator" && permissions.expenses) {
   return { allowed: true, readOnly: true, reason: "" };
  }
  return { allowed: false, readOnly: true, reason: "Les dépenses de cet espace ne sont pas accessibles avec ce rôle." };
 },
 documents: (role, permissions) => {
  if (role === "parent") {
   return { allowed: true, readOnly: false, reason: "" };
  }
  if (role === "step_parent" && permissions.legal_documents) {
   return { allowed: true, readOnly: true, reason: "" };
  }
  if (role === "mediator" && permissions.legal_documents) {
   return { allowed: true, readOnly: true, reason: "" };
  }
  return { allowed: false, readOnly: true, reason: "Les documents légaux ne sont pas accessibles avec ce rôle." };
 },
 children: (role, permissions, hasChildAccess) => {
  if (role === "parent") {
   return { allowed: true, readOnly: false, reason: "" };
  }
  if (role === "step_parent" && (hasChildAccess || permissions.calendar || permissions.school_info || permissions.emergency_contacts || permissions.medical_record || permissions.legal_documents || permissions.expenses)) {
   return { allowed: true, readOnly: true, reason: "" };
  }
  return { allowed: false, readOnly: true, reason: "Le profil enfant n’est pas accessible avec ce rôle." };
 },
 profile: () => ({ allowed: true, readOnly: false, reason: "" }),
 spaces: () => ({ allowed: true, readOnly: true, reason: "" }),
};

export const FAMILY_TYPE_OPTIONS: Array<{ value: FamilyType; label: string; description: string }> = [
 { value: "family", label: "Famille", description: "Couple ou famille nucléaire" },
 { value: "coparenting", label: "Co-parentalité", description: "Parents séparés" },
 { value: "solo", label: "Solo", description: "Parent seul" },
];

export const FAMILY_ROLE_OPTIONS: Array<{ value: FamilyRole; label: string; description: string }> = [
 { value: "parent", label: "Parent", description: "Accès complet" },
 { value: "step_parent", label: "Beau-parent", description: "Accès partiel configurable" },
 { value: "grand_parent", label: "Grand-parent", description: "Lecture seule calendrier et activités" },
 { value: "mediator", label: "Médiateur / Avocat", description: "Lecture légale et historique" },
];

export const CHILD_PERMISSION_OPTIONS: Array<{ value: ChildPermissionKey; label: string }> = [
 { value: "calendar", label: "Calendrier et activités" },
 { value: "school_info", label: "Infos scolaires" },
 { value: "emergency_contacts", label: "Contacts d’urgence" },
 { value: "medical_record", label: "Dossier médical" },
 { value: "legal_documents", label: "Documents légaux" },
 { value: "expenses", label: "Dépenses" },
];

export function familyTypeLabel(value: FamilyType): string {
 const option = FAMILY_TYPE_OPTIONS.find((item) => item.value === value);
 return option?.label ?? value;
}

export function familyRoleLabel(value: FamilyRole): string {
 const option = FAMILY_ROLE_OPTIONS.find((item) => item.value === value);
 return option?.label ?? value;
}

export function getDefaultFamilyPermissions(role: FamilyRole): FamilyPermissionSet {
 if (role === "parent") {
  return {
   calendar: true,
   school_info: true,
   emergency_contacts: true,
   medical_record: true,
   legal_documents: true,
   expenses: true,
   messages: true,
   invite_members: true,
   space_settings: true,
   custody_journal: true,
  };
 }

 if (role === "step_parent") {
  return {
   calendar: true,
   school_info: true,
   emergency_contacts: true,
   medical_record: false,
   legal_documents: false,
   expenses: false,
   messages: false,
   invite_members: false,
   space_settings: false,
   custody_journal: false,
  };
 }

 if (role === "grand_parent") {
  return {
   calendar: true,
   school_info: false,
   emergency_contacts: false,
   medical_record: false,
   legal_documents: false,
   expenses: false,
   messages: false,
   invite_members: false,
   space_settings: false,
   custody_journal: false,
  };
 }

 return {
  calendar: false,
  school_info: false,
  emergency_contacts: false,
  medical_record: false,
  legal_documents: true,
  expenses: true,
  messages: false,
  invite_members: false,
  space_settings: false,
  custody_journal: true,
 };
}

export function normalizeFamilyPermissions(role: FamilyRole, raw: unknown): FamilyPermissionSet {
 const defaults = getDefaultFamilyPermissions(role);
 if (!raw || typeof raw !== "object") {
  return defaults;
 }

 const next = { ...defaults };
 for (const key of Object.keys(defaults) as FamilyPermissionKey[]) {
  if (typeof (raw as Record<string, unknown>)[key] === "boolean") {
   next[key] = Boolean((raw as Record<string, unknown>)[key]);
  }
 }
 return next;
}

export function normalizeChildPermissions(raw: unknown): Partial<Record<ChildPermissionKey, boolean>> {
 if (!raw || typeof raw !== "object") {
  return {};
 }

 const result: Partial<Record<ChildPermissionKey, boolean>> = {};
 for (const option of CHILD_PERMISSION_OPTIONS) {
  if (typeof (raw as Record<string, unknown>)[option.value] === "boolean") {
   result[option.value] = Boolean((raw as Record<string, unknown>)[option.value]);
  }
 }
 return result;
}

export function getStoredActiveFamilyId(): string | null {
 if (typeof window === "undefined") {
  return null;
 }
 return window.localStorage.getItem(ACTIVE_FAMILY_STORAGE_KEY);
}

export function setStoredActiveFamilyId(familyId: string | null) {
 if (typeof window === "undefined") {
  return;
 }

 if (!familyId) {
  window.localStorage.removeItem(ACTIVE_FAMILY_STORAGE_KEY);
 } else {
  window.localStorage.setItem(ACTIVE_FAMILY_STORAGE_KEY, familyId);
 }

 window.dispatchEvent(new CustomEvent(FAMILY_CHANGED_EVENT, { detail: { familyId } }));
}

export function resolveActiveFamilyId(memberships: FamilyMembership[], preferredId?: string | null): string | null {
 if (memberships.length === 0) {
  return null;
 }

 if (preferredId && memberships.some((membership) => membership.familyId === preferredId)) {
  return preferredId;
 }

 return memberships[0]?.familyId ?? null;
}

export async function ensureProfileExists(user: User) {
 const supabase = getSupabaseBrowserClient();
 const nowIso = new Date().toISOString();
 const byUserId = await supabase.from("profiles").select("id, user_id").eq("user_id", user.id).maybeSingle();

 if (!byUserId.error && byUserId.data?.id) {
  if (byUserId.data.id !== user.id) {
   await supabase.from("profiles").update({ id: user.id, updated_at: nowIso }).eq("id", byUserId.data.id);
  }
  return;
 }

 const byId = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
 if (!byId.error && byId.data?.id) {
  await supabase.from("profiles").update({ user_id: user.id, updated_at: nowIso }).eq("id", user.id);
  return;
 }

 await supabase.from("profiles").insert({
  id: user.id,
  user_id: user.id,
  email: user.email ?? "",
  first_name: typeof user.user_metadata?.first_name === "string" ? user.user_metadata.first_name : null,
  last_name: typeof user.user_metadata?.last_name === "string" ? user.user_metadata.last_name : null,
  country: "Canada",
  role: "parent1",
  created_at: nowIso,
  updated_at: nowIso,
 });
}

export async function reconcilePendingFamilyInvites(user: User) {
 const email = user.email?.trim().toLowerCase();
 if (!email) {
  return;
 }

 const supabase = getSupabaseBrowserClient();
 const { data, error } = await supabase
  .from("family_members")
  .select("id, invite_email, user_id, status")
  .is("user_id", null)
  .eq("status", "pending")
  .ilike("invite_email", email);

 if (error || !Array.isArray(data) || data.length === 0) {
  return;
 }

 for (const row of data as Array<Record<string, unknown>>) {
  if (typeof row.id !== "string") {
   continue;
  }

  await supabase
   .from("family_members")
   .update({ user_id: user.id, status: "active" })
   .eq("id", row.id);
 }
}

export async function fetchUserMemberships(user: User): Promise<FamilyMembership[]> {
 const supabase = getSupabaseBrowserClient();
 const { data, error } = await supabase
  .from("family_members")
  .select("id, family_id, user_id, role, status, invite_email, permissions, invited_by, created_at, families(id, name, type, created_by, created_at)")
  .eq("user_id", user.id)
  .eq("status", "active")
  .order("created_at", { ascending: true });

 if (error || !Array.isArray(data)) {
  return [];
 }

 const familyIds = data
  .map((item) => (typeof item.family_id === "string" ? item.family_id : null))
  .filter((value): value is string => Boolean(value));

 const countMap = await fetchFamilyMemberCounts(familyIds);

 return data
  .map((row): FamilyMembership | null => {
   const familyId = typeof row.family_id === "string" ? row.family_id : "";
   const nested = Array.isArray(row.families) ? row.families[0] : row.families;
   if (!familyId || !nested || typeof nested !== "object") {
    return null;
   }

   const role = normalizeFamilyRole(row.role);
   return {
    id: typeof row.id === "string" ? row.id : `${familyId}-${row.user_id ?? "member"}`,
    familyId,
    userId: typeof row.user_id === "string" ? row.user_id : null,
    role,
    status: row.status === "pending" ? "pending" : "active",
    inviteEmail: typeof row.invite_email === "string" ? row.invite_email : null,
    permissions: normalizeFamilyPermissions(role, row.permissions),
    invitedBy: typeof row.invited_by === "string" ? row.invited_by : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
    family: {
     id: typeof nested.id === "string" ? nested.id : familyId,
     name: typeof nested.name === "string" && nested.name.trim().length > 0 ? nested.name.trim() : "Espace familial",
     type: normalizeFamilyType(nested.type),
     createdBy: typeof nested.created_by === "string" ? nested.created_by : null,
     createdAt: typeof nested.created_at === "string" ? nested.created_at : null,
     memberCount: countMap.get(familyId) ?? 1,
    },
   };
  })
  .filter((item): item is FamilyMembership => item !== null);
}

async function fetchFamilyMemberCounts(familyIds: string[]): Promise<Map<string, number>> {
 const uniqueIds = Array.from(new Set(familyIds));
 if (uniqueIds.length === 0) {
  return new Map();
 }

 const supabase = getSupabaseBrowserClient();
 const { data, error } = await supabase
  .from("family_members")
  .select("family_id")
  .in("family_id", uniqueIds)
  .eq("status", "active");

 if (error || !Array.isArray(data)) {
  return new Map();
 }

 const map = new Map<string, number>();
 for (const row of data as Array<Record<string, unknown>>) {
  if (typeof row.family_id !== "string") {
   continue;
  }
  map.set(row.family_id, (map.get(row.family_id) ?? 0) + 1);
 }
 return map;
}

export async function fetchChildPermissionRecords(userId: string, childIds: string[]): Promise<ChildPermissionRecord[]> {
 if (childIds.length === 0) {
  return [];
 }

 const supabase = getSupabaseBrowserClient();
 const { data, error } = await supabase
  .from("child_permissions")
  .select("id, child_id, user_id, accorde_par, permissions, created_at")
  .eq("user_id", userId)
  .in("child_id", childIds);

 if (error || !Array.isArray(data)) {
  return [];
 }

 return data
  .map((row): ChildPermissionRecord | null => {
   if (typeof row.id !== "string" || typeof row.child_id !== "string" || typeof row.user_id !== "string") {
    return null;
   }
   return {
    id: row.id,
    childId: row.child_id,
    userId: row.user_id,
    grantedBy: typeof row.accorde_par === "string" ? row.accorde_par : null,
    permissions: normalizeChildPermissions(row.permissions),
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
   };
  })
  .filter((item): item is ChildPermissionRecord => item !== null);
}

export function buildChildPermissionMap(records: ChildPermissionRecord[]): Map<string, Partial<Record<ChildPermissionKey, boolean>>> {
 const map = new Map<string, Partial<Record<ChildPermissionKey, boolean>>>();
 for (const record of records) {
  map.set(record.childId, record.permissions);
 }
 return map;
}

export function hasAnyChildPermission(childPermissionMap: Map<string, Partial<Record<ChildPermissionKey, boolean>>>): boolean {
 for (const permissions of childPermissionMap.values()) {
  if (Object.values(permissions).some(Boolean)) {
   return true;
  }
 }
 return false;
}

export function getFeatureAccess(feature: FeatureKey, role: FamilyRole, permissions: FamilyPermissionSet, childPermissionMap?: Map<string, Partial<Record<ChildPermissionKey, boolean>>>): FeatureAccess {
 const hasChildAccess = childPermissionMap ? hasAnyChildPermission(childPermissionMap) : false;
 return FAMILY_ROUTE_PERMISSIONS[feature](role, permissions, hasChildAccess);
}

export function getAllowedChildPermissionDefaults(): Partial<Record<ChildPermissionKey, boolean>> {
 return Object.fromEntries(DEFAULT_CHILD_PERMISSIONS.map((permission) => [permission, true])) as Partial<Record<ChildPermissionKey, boolean>>;
}

export function normalizeFamilyType(value: unknown): FamilyType {
 if (value === "coparenting") {
  return "coparenting";
 }
 if (value === "solo") {
  return "solo";
 }
 return "family";
}

export function normalizeFamilyRole(value: unknown): FamilyRole {
 if (value === "step_parent") {
  return "step_parent";
 }
 if (value === "grand_parent") {
  return "grand_parent";
 }
 if (value === "mediator") {
  return "mediator";
 }
 return "parent";
}

export async function resolvePostAuthDestination(user: User): Promise<string> {
 await ensureProfileExists(user);
 await reconcilePendingFamilyInvites(user);
 const memberships = await fetchUserMemberships(user);
 if (memberships.length === 0) {
  return "/espaces/nouveau?first=1";
 }
 return "/dashboard";
}