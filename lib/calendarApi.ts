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
};

function throwIfError(error: { message: string } | null): void {
  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchEvents(client: SupabaseClient, userId?: string): Promise<EventRow[]> {
  let query = client.from("events").select("*");
  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query.order("start_at", { ascending: true });
  throwIfError(error);
  return (data as EventRow[]) ?? [];
}

export async function createEvent(
  client: SupabaseClient,
  payload: {
    title: string;
    type: EventType;
    user_id: string;
    parent: ParentRole;
    start_at: string;
    end_at: string;
  },
): Promise<string | null> {
  const { data, error } = await client.from("events").insert(payload).select("id").maybeSingle();
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

export async function fetchSpecialDays(client: SupabaseClient): Promise<SpecialDayRow[]> {
  const { data, error } = await client.from("jours_speciaux").select("*").order("date", { ascending: true });
  throwIfError(error);
  return (data as SpecialDayRow[]) ?? [];
}

export async function createSpecialDay(
  client: SupabaseClient,
  payload: {
    title: string;
    date: string;
    type: SpecialDayType;
    notes: string | null;
    user_id: string;
  },
): Promise<void> {
  const { error } = await client.from("jours_speciaux").insert(payload);
  throwIfError(error);
}
