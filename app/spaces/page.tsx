"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Settings, UserPlus, X } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import {
 CHILD_PERMISSION_OPTIONS,
 FAMILY_TYPE_OPTIONS,
 familyRoleLabel,
 familyTypeLabel,
 getDefaultFamilyPermissions,
 normalizeChildPermissions,
 normalizeFamilyPermissions,
 type ChildPermissionKey,
 type FamilyRole,
 type FamilyType,
} from "@/lib/family";
import { useFamily } from "@/components/FamilyProvider";

type MemberRow = {
 id: string;
 user_id: string | null;
 family_id: string;
 role: FamilyRole;
 status: "active" | "pending";
 invite_email: string | null;
 permissions: ReturnType<typeof getDefaultFamilyPermissions>;
 displayName: string;
};

type ChildRow = {
 id: string;
 displayName: string;
};

type ChildPermissionRow = {
 id: string;
 child_id: string;
 user_id: string;
 permissions: Partial<Record<ChildPermissionKey, boolean>>;
};

const INVITE_ROLE_OPTIONS: Array<{ value: FamilyRole; label: string }> = [
 { value: "parent", label: "Co-parent" },
 { value: "step_parent", label: "Beau-parent" },
 { value: "grand_parent", label: "Grand-parent" },
 { value: "mediator", label: "Médiateur" },
];

export default function SpacesPage() {
 const router = useRouter();
 const { user, memberships, activeFamilyId, refreshFamilies, setActiveFamily, currentMembership } = useFamily();
 const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
 const [membersByFamily, setMembersByFamily] = useState<Record<string, MemberRow[]>>({});
 const [childrenByFamily, setChildrenByFamily] = useState<Record<string, ChildRow[]>>({});
 const [childPermissionsByUser, setChildPermissionsByUser] = useState<Record<string, Record<string, Partial<Record<ChildPermissionKey, boolean>>>>>(() => ({}));
 const [inviteModalOpen, setInviteModalOpen] = useState(false);
 const [inviteEmail, setInviteEmail] = useState("");
 const [inviteRole, setInviteRole] = useState<FamilyRole>("parent");
 const [renameName, setRenameName] = useState("");
 const [renameType, setRenameType] = useState<FamilyType>("family");
 const [savingState, setSavingState] = useState<string | null>(null);
 const [errorMessage, setErrorMessage] = useState("");
 const [successMessage, setSuccessMessage] = useState("");

 const selectedMembership = useMemo(
  () => memberships.find((membership) => membership.familyId === selectedFamilyId) ?? null,
  [memberships, selectedFamilyId],
 );

 const canManageSelectedSpace = selectedMembership?.role === "parent";

 useEffect(() => {
  const nextSelected = selectedFamilyId && memberships.some((membership) => membership.familyId === selectedFamilyId)
   ? selectedFamilyId
   : activeFamilyId ?? memberships[0]?.familyId ?? null;

  setSelectedFamilyId(nextSelected);
 }, [activeFamilyId, memberships, selectedFamilyId]);

 useEffect(() => {
  if (!selectedMembership) {
   return;
  }

  setRenameName(selectedMembership.family.name);
  setRenameType(selectedMembership.family.type);
 }, [selectedMembership]);

 useEffect(() => {
  if (!user || memberships.length === 0) {
   return;
  }

  const loadRelations = async () => {
   const supabase = getSupabaseBrowserClient();
   const familyIds = memberships.map((membership) => membership.familyId);

   const [{ data: memberData }, { data: childrenData }, { data: permissionData }, { data: profilesData }] = await Promise.all([
    supabase.from("family_members").select("id, family_id, user_id, role, status, invite_email, permissions").in("family_id", familyIds).order("created_at", { ascending: true }),
    supabase.from("children").select("id, family_id, first_name, last_name, prenom, nom").in("family_id", familyIds).order("created_at", { ascending: true }),
    supabase.from("child_permissions").select("id, child_id, user_id, permissions"),
    supabase.from("profiles").select("user_id, first_name, last_name, prenom, nom, email"),
   ]);

   const profileMap = new Map<string, string>();
   for (const row of (profilesData ?? []) as Array<Record<string, unknown>>) {
    const userId = typeof row.user_id === "string" ? row.user_id : null;
    if (!userId) {
     continue;
    }
    const displayName = [row.first_name, row.prenom, row.last_name, row.nom]
     .filter((value) => typeof value === "string" && value.trim().length > 0)
     .map((value) => String(value).trim())
     .join(" ") || (typeof row.email === "string" ? row.email : "Membre");
    profileMap.set(userId, displayName);
   }

   const nextMembers: Record<string, MemberRow[]> = {};
   for (const row of (memberData ?? []) as Array<Record<string, unknown>>) {
    const familyId = typeof row.family_id === "string" ? row.family_id : "";
    if (!familyId) {
     continue;
    }

    const role = (row.role as FamilyRole | undefined) ?? "parent";
    const userId = typeof row.user_id === "string" ? row.user_id : null;
    const displayName = userId ? profileMap.get(userId) ?? (typeof row.invite_email === "string" ? row.invite_email : "Membre") : (typeof row.invite_email === "string" ? row.invite_email : "Invitation en attente");
    const nextRow: MemberRow = {
     id: typeof row.id === "string" ? row.id : `${familyId}-${displayName}`,
     user_id: userId,
     family_id: familyId,
     role,
     status: row.status === "pending" ? "pending" : "active",
     invite_email: typeof row.invite_email === "string" ? row.invite_email : null,
     permissions: normalizeFamilyPermissions(role, row.permissions),
     displayName,
    };

    nextMembers[familyId] = [...(nextMembers[familyId] ?? []), nextRow];
   }
   setMembersByFamily(nextMembers);

   const nextChildren: Record<string, ChildRow[]> = {};
   const childIdToFamily = new Map<string, string>();
   for (const row of (childrenData ?? []) as Array<Record<string, unknown>>) {
    const familyId = typeof row.family_id === "string" ? row.family_id : "";
    const childId = typeof row.id === "string" ? row.id : "";
    if (!familyId || !childId) {
     continue;
    }

    const displayName = `${typeof row.first_name === "string" ? row.first_name : typeof row.prenom === "string" ? row.prenom : "Enfant"} ${typeof row.last_name === "string" ? row.last_name : typeof row.nom === "string" ? row.nom : ""}`.trim();
    childIdToFamily.set(childId, familyId);
    nextChildren[familyId] = [...(nextChildren[familyId] ?? []), { id: childId, displayName }];
   }
   setChildrenByFamily(nextChildren);

   const nextPermissions: Record<string, Record<string, Partial<Record<ChildPermissionKey, boolean>>>> = {};
   for (const row of (permissionData ?? []) as Array<Record<string, unknown>>) {
    const childId = typeof row.child_id === "string" ? row.child_id : "";
    const userId = typeof row.user_id === "string" ? row.user_id : "";
    const familyId = childIdToFamily.get(childId);
    if (!childId || !userId || !familyId) {
     continue;
    }

    nextPermissions[userId] = nextPermissions[userId] ?? {};
    nextPermissions[userId][childId] = normalizeChildPermissions(row.permissions);
   }
   setChildPermissionsByUser(nextPermissions);
  };

  void loadRelations();
 }, [memberships, user]);

 const selectedFamilyMembers = selectedFamilyId ? membersByFamily[selectedFamilyId] ?? [] : [];
 const selectedFamilyChildren = selectedFamilyId ? childrenByFamily[selectedFamilyId] ?? [] : [];

 const resetInviteState = () => {
  setInviteEmail("");
  setInviteRole("parent");
  setInviteModalOpen(false);
 };

 const onInviteMember = async (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();

  if (!user || !selectedFamilyId) {
   return;
  }

  if (!inviteEmail.trim()) {
   setErrorMessage("L’email du membre est obligatoire.");
   return;
  }

  setSavingState("invite");
  setErrorMessage("");
  setSuccessMessage("");

  try {
   const supabase = getSupabaseBrowserClient();
   const normalizedEmail = inviteEmail.trim().toLowerCase();
     const { data: invitationRow, error: invitationError } = await supabase
      .from("invitations")
      .insert({
       email_invite: normalizedEmail,
       family_id: selectedFamilyId,
       role: inviteRole,
       statut: "en_attente",
       created_by: user.id,
      })
      .select("token")
      .maybeSingle();

     if (invitationError || !invitationRow?.token) {
      throw new Error(invitationError?.message ?? "Impossible de créer l’invitation.");
     }

     await supabase.from("family_members").upsert(
      {
       family_id: selectedFamilyId,
       user_id: null,
       invite_email: normalizedEmail,
       role: inviteRole,
       permissions: getDefaultFamilyPermissions(inviteRole),
       status: "pending",
       invited_by: user.id,
      },
      { onConflict: "family_id,invite_email" },
     );

     const redirectBase = typeof window !== "undefined" ? window.location.origin : "";
     const activationUrl = `${redirectBase}/invite/accept?invitation_token=${encodeURIComponent(String(invitationRow.token))}&invitation_email=${encodeURIComponent(normalizedEmail)}`;

     const otp = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
       emailRedirectTo: activationUrl,
       shouldCreateUser: true,
       data: {
        invitation_token: String(invitationRow.token),
        family_id: selectedFamilyId,
        role: inviteRole,
       },
      },
     });

     if (otp.error) {
      throw new Error(otp.error.message);
     }

   await refreshFamilies();
   resetInviteState();
     setSuccessMessage(`✅ Invitation envoyée à ${normalizedEmail} !`);
  } catch (error) {
   setErrorMessage(error instanceof Error ? error.message : "Erreur pendant l’invitation.");
  } finally {
   setSavingState(null);
  }
 };

 const onRenameFamily = async (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  if (!selectedFamilyId || !renameName.trim()) {
   return;
  }

  setSavingState("rename");
  setErrorMessage("");
  setSuccessMessage("");

  try {
   const supabase = getSupabaseBrowserClient();
   const { error } = await supabase.from("families").update({ name: renameName.trim(), type: renameType }).eq("id", selectedFamilyId);
   if (error) {
    throw new Error(error.message);
   }

   await refreshFamilies();
   setSuccessMessage("Espace mis à jour.");
  } catch (error) {
   setErrorMessage(error instanceof Error ? error.message : "Erreur pendant la mise à jour de l’espace.");
  } finally {
   setSavingState(null);
  }
 };

 const onSaveMemberPermissions = async (member: MemberRow) => {
  if (!selectedFamilyId || !user) {
   return;
  }

  setSavingState(`member-${member.id}`);
  setErrorMessage("");
  setSuccessMessage("");

  try {
   const supabase = getSupabaseBrowserClient();
   const familyPermissions = member.permissions;
   const { error: updateMemberError } = await supabase.from("family_members").update({ permissions: familyPermissions }).eq("id", member.id);
   if (updateMemberError) {
    throw new Error(updateMemberError.message);
   }

   if (member.user_id) {
    for (const child of selectedFamilyChildren) {
     await supabase.from("child_permissions").upsert({
      child_id: child.id,
      user_id: member.user_id,
      accorde_par: user.id,
      permissions: childPermissionsByUser[member.user_id]?.[child.id] ?? {},
     }, { onConflict: "child_id,user_id" });
    }
   }

   setSuccessMessage(`Permissions mises à jour pour ${member.displayName}.`);
  } catch (error) {
   setErrorMessage(error instanceof Error ? error.message : "Erreur pendant la sauvegarde des permissions.");
  } finally {
   setSavingState(null);
  }
 };

 const onLeaveFamily = async (familyId: string) => {
  if (!user) {
   return;
  }

  setSavingState(`leave-${familyId}`);
  setErrorMessage("");
  setSuccessMessage("");

  try {
   const supabase = getSupabaseBrowserClient();
   const { error } = await supabase.from("family_members").delete().eq("family_id", familyId).eq("user_id", user.id);
   if (error) {
    throw new Error(error.message);
   }

   await refreshFamilies();
   setSuccessMessage("Vous avez quitté cet espace.");
   if (activeFamilyId === familyId) {
    const nextMembership = memberships.find((membership) => membership.familyId !== familyId);
    if (nextMembership) {
     setActiveFamily(nextMembership.familyId);
    }
   }
  } catch (error) {
   setErrorMessage(error instanceof Error ? error.message : "Erreur pendant la sortie de l’espace.");
  } finally {
   setSavingState(null);
  }
 };

 return (
  <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#F5F0EB] via-[#EEE6DE] to-[#ECE7E1] px-4 py-8 sm:px-6 sm:py-10">
   <div className="pointer-events-none absolute -top-32 -left-24 h-80 w-80 rounded-full bg-[#D8C6B5]/30 blur-3xl" />
   <div className="pointer-events-none absolute right-0 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-[#BFCFDE]/30 blur-3xl" />

   <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-6 rounded-3xl border border-white/70 bg-white/90 p-6 shadow-[0_24px_80px_rgba(44,36,32,0.1)] backdrop-blur-sm sm:p-8">
    <header className="flex flex-wrap items-center justify-between gap-3">
     <div>
      <p className="text-xs font-semibold tracking-[0.2em] text-[#A89080]">ESPACES FAMILIAUX</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#2C2420]">Vos espaces</h1>
     </div>

     <div className="flex items-center gap-2">
      <Link
       href="/dashboard"
       className="inline-flex items-center justify-center rounded-xl border border-[#D9D0C8] px-4 py-2 text-sm font-semibold text-[#6B5D55] transition hover:bg-[#EDE8E3]"
      >
       <ArrowLeft size={16} className="mr-2" />
       Retour
      </Link>
      <Link
       href="/spaces/new"
       className="inline-flex items-center justify-center rounded-xl bg-[#7C6B5D] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(124,107,93,0.2)] transition hover:brightness-105"
      >
       + Créer un espace
      </Link>
     </div>
    </header>

    {(errorMessage || successMessage) && (
      <p className={`rounded-xl border px-4 py-3 text-sm ${errorMessage ? "border-[#E5D7CB] bg-[#FFF5F0] text-[#A85C52]" : "border-[#D9D0C8] bg-[#F3F8F1] text-[#57745F]"}`}>
       {errorMessage || successMessage}
      </p>
    )}

    <section className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
     <div className="rounded-2xl border border-[#D9D0C8] bg-[#FFFCF9] p-4">
      <h2 className="text-lg font-semibold text-[#2C2420]">Tous les espaces</h2>
      <div className="mt-4 space-y-3">
       {memberships.map((membership) => {
        const isActive = membership.familyId === activeFamilyId;
        return (
         <article key={membership.id} className="rounded-2xl border border-[#E7D9CB] bg-white p-4 shadow-[0_8px_18px_rgba(44,36,32,0.04)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
           <div>
            <p className="text-lg font-semibold text-[#2C2420]">{membership.family.name}</p>
            <p className="mt-1 text-sm text-[#6B5D55]">
             {familyTypeLabel(membership.family.type)} · {membership.family.memberCount} membres · {familyRoleLabel(membership.role)}
            </p>
           </div>

           {isActive ? (
            <span className="rounded-full border border-[#D3C3B5] bg-[#F5F0EB] px-3 py-1 text-xs font-semibold text-[#7C6B5D]">Actif</span>
           ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
           <button
            type="button"
            onClick={() => {
             setActiveFamily(membership.familyId);
             router.push("/dashboard");
            }}
            className="rounded-xl bg-[#7C6B5D] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105"
           >
            Entrer
           </button>
           <button
            type="button"
            onClick={() => setSelectedFamilyId(membership.familyId)}
            className="rounded-xl border border-[#D9D0C8] bg-white px-4 py-2 text-sm font-semibold text-[#6B5D55] transition hover:bg-[#F5F0EB]"
           >
            Gérer
           </button>
           <button
            type="button"
            onClick={() => onLeaveFamily(membership.familyId)}
            disabled={savingState === `leave-${membership.familyId}`}
            className="rounded-xl border border-[#E5D7CB] bg-[#FFF5F0] px-4 py-2 text-sm font-semibold text-[#A85C52] transition hover:bg-[#FFECE6] disabled:opacity-70"
           >
            Quitter
           </button>
          </div>
         </article>
        );
       })}
      </div>
     </div>

     <div className="rounded-2xl border border-[#D9D0C8] bg-white p-4">
      {selectedMembership ? (
       <>
        <div className="flex items-center justify-between gap-3">
         <div>
          <h2 className="text-lg font-semibold text-[#2C2420]">Gérer {selectedMembership.family.name}</h2>
          <p className="mt-1 text-sm text-[#6B5D55]">Paramètres, invitations et permissions de cet espace.</p>
         </div>
         <Settings size={18} className="text-[#7C6B5D]" />
        </div>

        {!canManageSelectedSpace && (
         <p className="mt-4 rounded-xl border border-[#E8DDD4] bg-[#FAF6F2] px-4 py-3 text-sm text-[#6B5D55]">
          Seuls les parents peuvent renommer l’espace, inviter des membres et modifier les permissions.
         </p>
        )}

        {canManageSelectedSpace && (
         <div className="mt-4 space-y-6">
          <form className="space-y-3 rounded-2xl border border-[#E7D9CB] bg-[#FFFCF9] p-4" onSubmit={onRenameFamily}>
           <label className="block text-sm font-semibold text-[#6B5D55]">Nom de l’espace</label>
           <input
            value={renameName}
            onChange={(event) => setRenameName(event.target.value)}
            className="w-full rounded-xl border border-[#D9D0C8] bg-white px-4 py-3 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
           />

           <label className="block text-sm font-semibold text-[#6B5D55]">Type</label>
           <select
            value={renameType}
            onChange={(event) => setRenameType(event.target.value as FamilyType)}
            className="w-full rounded-xl border border-[#D9D0C8] bg-white px-4 py-3 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
           >
            {FAMILY_TYPE_OPTIONS.map((option) => (
             <option key={option.value} value={option.value}>{option.label}</option>
            ))}
           </select>

           <button
            type="submit"
            disabled={savingState === "rename"}
            className="rounded-xl bg-[#7C6B5D] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-70"
           >
            {savingState === "rename" ? "Enregistrement..." : "Sauvegarder l’espace"}
           </button>
          </form>

          <div className="space-y-4 rounded-2xl border border-[#E7D9CB] bg-[#FFFCF9] p-4">
           <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
             <UserPlus size={16} className="text-[#7C6B5D]" />
             <h3 className="text-base font-semibold text-[#2C2420]">Invitations</h3>
            </div>
            <button
             type="button"
             onClick={() => setInviteModalOpen(true)}
             className="rounded-xl bg-[#7C6B5D] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105"
            >
             Inviter mon co-parent
            </button>
           </div>
           <p className="text-sm text-[#6B5D55]">Envoyez une invitation interne par email avec un lien d’activation sécurisé.</p>
          </div>

          <div className="space-y-4 rounded-2xl border border-[#E7D9CB] bg-[#FFFCF9] p-4">
           <h3 className="text-base font-semibold text-[#2C2420]">Membres et permissions</h3>
           {selectedFamilyMembers.map((member) => (
            <div key={member.id} className="rounded-xl border border-[#E7D9CB] bg-white p-4">
             <div className="flex items-start justify-between gap-3">
              <div>
               <p className="font-semibold text-[#2C2420]">{member.displayName}</p>
               <p className="text-sm text-[#6B5D55]">{familyRoleLabel(member.role)} · {member.status === "pending" ? "Invitation en attente" : "Actif"}</p>
              </div>
              {member.user_id === user?.id ? (
               <span className="rounded-full border border-[#D3C3B5] bg-[#F5F0EB] px-3 py-1 text-xs font-semibold text-[#7C6B5D]">Vous</span>
              ) : null}
             </div>

             {member.role === "step_parent" && member.user_id && (
              <div className="mt-4 space-y-4">
               <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(member.permissions).map(([key, enabled]) => (
                 <label key={key} className="flex items-center gap-2 rounded-lg border border-[#E7D9CB] px-3 py-2 text-sm text-[#6B5D55]">
                  <input
                   type="checkbox"
                   checked={enabled}
                   onChange={(event) => setMembersByFamily((current) => ({
                    ...current,
                    [selectedFamilyId!]: (current[selectedFamilyId!] ?? []).map((item) => item.id === member.id ? { ...item, permissions: { ...item.permissions, [key]: event.target.checked } } : item),
                   }))}
                  />
                  <span>{key}</span>
                 </label>
                ))}
               </div>

               <div className="space-y-3">
                {selectedFamilyChildren.map((child) => {
                 const childPermissions = childPermissionsByUser[member.user_id ?? ""]?.[child.id] ?? {};
                 return (
                  <div key={child.id} className="rounded-xl border border-[#E7D9CB] p-3">
                   <p className="font-medium text-[#2C2420]">{child.displayName}</p>
                   <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {CHILD_PERMISSION_OPTIONS.map((option) => (
                     <label key={option.value} className="flex items-center gap-2 text-sm text-[#6B5D55]">
                      <input
                       type="checkbox"
                       checked={Boolean(childPermissions[option.value])}
                       onChange={(event) => setChildPermissionsByUser((current) => ({
                        ...current,
                        [member.user_id ?? ""]: {
                         ...(current[member.user_id ?? ""] ?? {}),
                         [child.id]: {
                          ...((current[member.user_id ?? ""] ?? {})[child.id] ?? {}),
                          [option.value]: event.target.checked,
                         },
                        },
                       }))}
                      />
                      <span>{option.label}</span>
                     </label>
                    ))}
                   </div>
                  </div>
                 );
                })}
               </div>

               <button
                type="button"
                onClick={() => onSaveMemberPermissions(member)}
                disabled={savingState === `member-${member.id}`}
                className="rounded-xl bg-[#7C6B5D] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-70"
               >
                {savingState === `member-${member.id}` ? "Sauvegarde..." : "Sauvegarder les permissions"}
               </button>
              </div>
             )}
            </div>
           ))}
          </div>
         </div>
        )}
       </>
      ) : (
       <p className="rounded-xl border border-[#D9D0C8] bg-[#F8F2EC] px-4 py-3 text-sm text-[#6B5D55]">Sélectionnez un espace pour le gérer.</p>
      )}
     </div>
    </section>

    {inviteModalOpen && canManageSelectedSpace && (
     <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C2420]/45 px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#D9D0C8] bg-white p-5 shadow-[0_24px_80px_rgba(44,36,32,0.25)]">
       <div className="flex items-center justify-between gap-3">
      <h3 className="text-lg font-semibold text-[#2C2420]">Inviter mon co-parent</h3>
      <button
       type="button"
       onClick={resetInviteState}
       className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E7D9CB] text-[#7C6B5D]"
      >
       <X size={14} />
      </button>
       </div>

       <form className="mt-4 space-y-4" onSubmit={onInviteMember}>
      <div>
       <label className="mb-1 block text-sm font-semibold text-[#6B5D55]">Adresse courriel du co-parent</label>
       <input
        type="email"
        value={inviteEmail}
        onChange={(event) => setInviteEmail(event.target.value)}
        placeholder="nom@exemple.com"
        className="w-full rounded-xl border border-[#D9D0C8] bg-white px-4 py-3 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
       />
      </div>

      <div>
       <label className="mb-1 block text-sm font-semibold text-[#6B5D55]">Rôle</label>
       <select
        value={inviteRole}
        onChange={(event) => setInviteRole(event.target.value as FamilyRole)}
        className="w-full rounded-xl border border-[#D9D0C8] bg-white px-4 py-3 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
       >
        {INVITE_ROLE_OPTIONS.map((option) => (
         <option key={option.value} value={option.value}>{option.label}</option>
        ))}
       </select>
      </div>

      <button
       type="submit"
       disabled={savingState === "invite"}
       className="w-full rounded-xl bg-[#7C6B5D] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-70"
      >
       {savingState === "invite" ? "Envoi..." : "Envoyer l'invitation"}
      </button>
       </form>
      </div>
     </div>
    )}
   </main>
  </div>
 );
}