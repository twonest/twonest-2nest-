import type { SupabaseClient } from "@supabase/supabase-js";

type EventType = "Garde" | "Médecin" | "École" | "Activité";
type ParentRole = "parent1" | "parent2";
type SpecialDayType = "ferie" | "pedagogique" | "vacances" | "scolaire";
type SwapStatus = "en_attente" | "acceptee" | "refusee";

export type EventRow = {
  id?: string | number;
  title?: string;
  type?: EventType;
  start_at?: string;
  end_at?: string;
  user_id?: string;
  family_id?: string;
  parent?: string;
};

export type SwapRequestRow = {
  id?: string | number;
  demandeur_id?: string;
  date_demande?: string;
  date_originale?: string;
  date_proposee?: string;
  raison?: string;
  statut?: SwapStatus;
};

export type SpecialDayRow = {
  id?: string | number;
  title?: string;
  date?: string;
  type?: string;
  notes?: string;
  family_id?: string;
};

type SpecialDayInsertPayload = {
  title: string;
  date: string;
  type: SpecialDayType;
  notes: string | null;
  user_id: string;
  family_id?: string;
};

function throwIfError(error: { message: string } | null): void {
  if (error) {
    throw new Error(error.message);
  }
}

function isMissingFamilyIdColumnError(message: string): boolean {
  const normalized = message.toLowerCase();
  const isMissingColumn =
    (normalized.includes("column") && normalized.includes("does not exist")) ||
    (normalized.includes("could not find") && normalized.includes("schema cache"));

  return isMissingColumn && normalized.includes("family_id");
}

function familyColumnMigrationMessage(tableName: string): string {
  return `Le schéma Supabase de '${tableName}' est incomplet (colonne family_id manquante). Exécutez le script supabase/children_schema_run.sql puis rechargez la page.`;
}

export async function fetchEvents(client: SupabaseClient, familyId: string): Promise<EventRow[]> {
  const { data, error } = await client
    .from("events")
    .select("*")
    .eq("family_id", familyId)
    .order("start_at", { ascending: true });

  if (error && isMissingFamilyIdColumnError(error.message)) {
    throw new Error(familyColumnMigrationMessage("events"));
  }

  throwIfError(error);
  return (data as EventRow[]) ?? [];
}

export async function createEvent(
  client: SupabaseClient,
  payload: {
    title: string;
    type: EventType;
    user_id: string;
    family_id: string;
    parent: ParentRole;
    start_at: string;
    end_at: string;
  },
): Promise<string | null> {
  const { data, error } = await client.from("events").insert(payload).select("id").maybeSingle();

  if (error && isMissingFamilyIdColumnError(error.message)) {
    throw new Error(familyColumnMigrationMessage("events"));
  }

  throwIfError(error);
  return data?.id ? String(data.id) : null;
}

export async function updateEvent(
  client: SupabaseClient,
  eventId: string,
  payload: {
    title: string;
    type: EventType;
    parent: ParentRole;
    start_at: string;
    end_at: string;
  },
): Promise<void> {
  const { error } = await client.from("events").update(payload).eq("id", eventId);
  throwIfError(error);
}

export async function deleteEvent(client: SupabaseClient, eventId: string): Promise<void> {
  const { error } = await client.from("events").delete().eq("id", eventId);
  throwIfError(error);
}

export async function fetchProfileRole(client: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await client.from("profiles").select("role").eq("user_id", userId).maybeSingle();
  throwIfError(error);
  return (data?.role as string | undefined) ?? null;
}

export async function fetchSwapRequests(client: SupabaseClient): Promise<SwapRequestRow[]> {
  const { data, error } = await client.from("swap_requests").select("*").order("date_demande", { ascending: false });
  throwIfError(error);
  return (data as SwapRequestRow[]) ?? [];
}

export async function createSwapRequest(
  client: SupabaseClient,
  payload: {
    demandeur_id: string;
    date_demande: string;
    date_originale: string;
    date_proposee: string;
    raison: string;
    statut: SwapStatus;
  },
): Promise<void> {
  const { error } = await client.from("swap_requests").insert(payload);
  throwIfError(error);
}

export async function updateSwapRequestDecision(
  client: SupabaseClient,
  requestId: string,
  payload: {
    statut: SwapStatus;
  },
): Promise<void> {
  const { error } = await client.from("swap_requests").update(payload).eq("id", requestId);
  throwIfError(error);
}

export async function fetchSpecialDays(client: SupabaseClient, familyId: string): Promise<SpecialDayRow[]> {
  const { data, error } = await client
    .from("jours_speciaux")
    .select("*")
    .eq("family_id", familyId)
    .order("date", { ascending: true });

  if (error && isMissingFamilyIdColumnError(error.message)) {
    throw new Error(familyColumnMigrationMessage("jours_speciaux"));
  }

  throwIfError(error);
  return (data as SpecialDayRow[]) ?? [];
}

export async function createSpecialDay(
  client: SupabaseClient,
  payload: SpecialDayInsertPayload,
): Promise<void> {
  const { error } = await client.from("jours_speciaux").insert(payload);

  if (error && payload.family_id && isMissingFamilyIdColumnError(error.message)) {
    const { family_id: _ignoredFamilyId, ...fallbackPayload } = payload;
    const fallback = await client.from("jours_speciaux").insert(fallbackPayload);
    throwIfError(fallback.error);
    return;
  }

  throwIfError(error);
}

export async function createSpecialDaysBulk(
  client: SupabaseClient,
  payloads: SpecialDayInsertPayload[],
): Promise<number> {
  if (payloads.length === 0) {
    return 0;
  }

  const { error, count } = await client.from("jours_speciaux").insert(payloads, { count: "exact" });

  if (error && payloads.some((payload) => payload.family_id) && isMissingFamilyIdColumnError(error.message)) {
    const fallbackPayloads = payloads.map(({ family_id: _ignoredFamilyId, ...payload }) => payload);
    const fallback = await client.from("jours_speciaux").insert(fallbackPayloads, { count: "exact" });
    throwIfError(fallback.error);
    return fallback.count ?? fallbackPayloads.length;
  }

  throwIfError(error);
  return count ?? payloads.length;
}
