"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { acceptInvitationToken, setStoredActiveFamilyId } from "@/lib/family";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

const JOINED_FAMILY_NAME_KEY = "twonest.joinedFamilyName";

function InviteAcceptContent() {
 const router = useRouter();
 const searchParams = useSearchParams();
 const [errorMessage, setErrorMessage] = useState("");

 useEffect(() => {
  const token = (searchParams.get("invitation_token") ?? "").trim();
  const inviteEmail = (searchParams.get("invitation_email") ?? "").trim();

  const run = async () => {
   if (!token) {
    router.replace("/signup");
    return;
   }

   try {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.auth.getUser();

    if (!data.user) {
     const query = new URLSearchParams({ invitation_token: token });
     if (inviteEmail) {
      query.set("invitation_email", inviteEmail);
     }
     router.replace(`/signup?${query.toString()}`);
     return;
    }

    const accepted = await acceptInvitationToken(data.user, token);
    if (accepted) {
     setStoredActiveFamilyId(accepted.familyId);
     window.localStorage.setItem(JOINED_FAMILY_NAME_KEY, accepted.familyName);
    }

    router.replace("/dashboard");
   } catch (error) {
    setErrorMessage(error instanceof Error ? error.message : "Impossible d'activer l'invitation.");
   }
  };

  void run();
 }, [router, searchParams]);

 return (
  <div className="flex min-h-screen items-center justify-center bg-[#F5F0EB] px-6">
   <div className="max-w-md rounded-2xl border border-[#D9D0C8] bg-white p-6 text-center">
    <p className="text-sm font-semibold text-[#2C2420]">Activation de l'invitation en cours...</p>
    {errorMessage ? <p className="mt-3 text-sm text-[#A85C52]">{errorMessage}</p> : null}
   </div>
  </div>
 );
}

export default function InviteAcceptPage() {
 return (
  <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#F5F0EB] px-6"><p className="text-sm text-[#6B5D55]">Chargement...</p></div>}>
   <InviteAcceptContent />
  </Suspense>
 );
}
