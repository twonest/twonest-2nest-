"use client";

import Link from "next/link";
import moment from "moment";
import "moment/locale/fr";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, momentLocalizer, Views } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type EventType = "Garde" | "Médecin" | "École" | "Activité";

type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  type: EventType;
  ownerUserId: string | null;
  parent: string | null;
};

type SupabaseEventRow = {
  id?: string | number;
  title?: string;
  type?: EventType;
  start_at?: string;
  end_at?: string;
  start_date?: string;
  end_date?: string;
  start?: string;
  end?: string;
  user_id?: string;
  owner_id?: string;
  parent?: string;
  parent_role?: string;
};

const localizer = momentLocalizer(moment);
const EVENT_TYPES: EventType[] = ["Garde", "Médecin", "École", "Activité"];

function formatForDateTimeLocal(date: Date): string {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60_000);
  return localDate.toISOString().slice(0, 16);
}

export default function CalendarPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [configError, setConfigError] = useState("");

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState("");

  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState<EventType>("Garde");
  const [startAt, setStartAt] = useState(() => formatForDateTimeLocal(new Date()));
  const [endAt, setEndAt] = useState(() => formatForDateTimeLocal(new Date(Date.now() + 60 * 60 * 1000)));

  const canSubmit = useMemo(() => title.trim().length > 0 && startAt.length > 0 && endAt.length > 0, [title, startAt, endAt]);

  useEffect(() => {
    moment.locale("fr");
  }, []);

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
      setIsLoadingEvents(false);
      return;
    }

    const loadUserAndEvents = async () => {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        router.replace("/");
        return;
      }

      setUser(userData.user);
      setCheckingSession(false);

      const { data, error } = await supabase.from("events").select("*").order("start_at", { ascending: true });

      if (error) {
        setFormError(error.message);
        setIsLoadingEvents(false);
        return;
      }

      const mapped = (data as SupabaseEventRow[])
        .map((row): CalendarEvent | null => {
          const rowStart = row.start_at ?? row.start_date ?? row.start;
          const rowEnd = row.end_at ?? row.end_date ?? row.end;

          if (!row.id || !row.title || !rowStart || !rowEnd || !row.type) {
            return null;
          }

          const startDate = new Date(rowStart);
          const endDate = new Date(rowEnd);

          if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
            return null;
          }

          return {
            id: String(row.id),
            title: `${row.title} · ${row.type}`,
            type: row.type,
            start: startDate,
            end: endDate,
            ownerUserId: row.user_id ?? row.owner_id ?? null,
            parent: row.parent ?? row.parent_role ?? null,
          };
        })
        .filter((event): event is CalendarEvent => event !== null);

      setEvents(mapped);
      setIsLoadingEvents(false);
    };

    loadUserAndEvents();

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

  const openForm = () => {
    setFormError("");
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setFormError("");
  };

  const refreshEvents = async () => {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.from("events").select("*").order("start_at", { ascending: true });

    if (error) {
      setFormError(error.message);
      return;
    }

    const mapped = (data as SupabaseEventRow[])
      .map((row): CalendarEvent | null => {
        const rowStart = row.start_at ?? row.start_date ?? row.start;
        const rowEnd = row.end_at ?? row.end_date ?? row.end;

        if (!row.id || !row.title || !rowStart || !rowEnd || !row.type) {
          return null;
        }

        const startDate = new Date(rowStart);
        const endDate = new Date(rowEnd);

        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
          return null;
        }

        return {
          id: String(row.id),
          title: `${row.title} · ${row.type}`,
          type: row.type,
          start: startDate,
          end: endDate,
          ownerUserId: row.user_id ?? row.owner_id ?? null,
          parent: row.parent ?? row.parent_role ?? null,
        };
      })
      .filter((event): event is CalendarEvent => event !== null);

    setEvents(mapped);
  };

  const onCreateEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit || !user) {
      setFormError("Tous les champs sont obligatoires.");
      return;
    }

    const startDate = new Date(startAt);
    const endDate = new Date(endAt);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      setFormError("Dates invalides.");
      return;
    }

    if (endDate <= startDate) {
      setFormError("La date de fin doit être après la date de début.");
      return;
    }

    setIsCreating(true);
    setFormError("");

    try {
      const supabase = getSupabaseBrowserClient();
      const basePayload = {
        title: title.trim(),
        type: eventType,
        user_id: user.id,
      };

      const { error: insertError } = await supabase.from("events").insert({
        ...basePayload,
        start_at: startDate.toISOString(),
        end_at: endDate.toISOString(),
      });

      if (insertError) {
        const { error: fallbackError } = await supabase.from("events").insert({
          ...basePayload,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
        });

        if (fallbackError) {
          setFormError(fallbackError.message);
          return;
        }
      }

      await refreshEvents();
      setTitle("");
      setEventType("Garde");
      setStartAt(formatForDateTimeLocal(new Date()));
      setEndAt(formatForDateTimeLocal(new Date(Date.now() + 60 * 60 * 1000)));
      setFormOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Erreur pendant l'enregistrement de l'événement.");
    } finally {
      setIsCreating(false);
    }
  };

  if (checkingSession || isLoadingEvents) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#F6FAFF] to-[#EEF5FC] px-6">
        <p className="text-sm font-medium text-[#5B7691]">Chargement du calendrier...</p>
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
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#F6FAFF] via-[#F0F7FE] to-[#EAF3FC] px-4 py-8 sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute -top-32 -left-24 h-80 w-80 rounded-full bg-[#4A90D9]/20 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-[#80B7EA]/20 blur-3xl" />

      <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-6 rounded-3xl border border-white/70 bg-white/90 p-6 shadow-[0_24px_80px_rgba(38,78,120,0.12)] backdrop-blur-sm sm:p-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-[#5F81A3]">PLANNING</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#17324D]">📅 Calendrier</h1>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-xl border border-[#D0DFEE] px-4 py-2 text-sm font-semibold text-[#365A7B] transition hover:bg-[#F1F7FD]"
            >
              ← Retour
            </Link>
            <button
              type="button"
              onClick={openForm}
              className="inline-flex items-center justify-center rounded-xl bg-[#4A90D9] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(74,144,217,0.35)] transition hover:brightness-105"
            >
              + Ajouter
            </button>
          </div>
        </header>

        {formError && (
          <p className="rounded-xl border border-[#E3B4B8] bg-[#FFF4F5] px-4 py-3 text-sm text-[#8D3E45]">{formError}</p>
        )}

        <section className="overflow-hidden rounded-2xl border border-[#D7E6F4] bg-white p-2 shadow-[0_10px_28px_rgba(74,144,217,0.08)] sm:p-4">
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            defaultView={Views.MONTH}
            views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
            style={{ height: 650 }}
            eventPropGetter={(event) => {
              const isParentOne = event.ownerUserId === user?.id || event.parent === "parent1";
              return {
                style: {
                  backgroundColor: isParentOne ? "#4A90D9" : "#50C878",
                  borderRadius: "10px",
                  border: "none",
                  color: "#ffffff",
                  padding: "2px 6px",
                  fontWeight: 600,
                },
              };
            }}
            messages={{
              month: "Mois",
              week: "Semaine",
              day: "Jour",
              agenda: "Agenda",
              today: "Aujourd'hui",
              previous: "Précédent",
              next: "Suivant",
              noEventsInRange: "Aucun événement sur cette période.",
            }}
          />
        </section>
      </main>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F223680] p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/70 bg-white p-6 shadow-[0_20px_60px_rgba(15,36,54,0.22)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[#17324D]">Nouvel événement</h2>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg border border-[#D0DFEE] px-2 py-1 text-sm text-[#365A7B] hover:bg-[#F1F7FD]"
              >
                ✕
              </button>
            </div>

            <form className="space-y-4" onSubmit={onCreateEvent}>
              <div>
                <label htmlFor="title" className="mb-1 block text-sm font-medium text-[#2D4B68]">
                  Titre de l'événement
                </label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="w-full rounded-xl border border-[#D8E4F0] px-3 py-2.5 text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
                  placeholder="Ex: Rendez-vous pédiatre"
                />
              </div>

              <div>
                <label htmlFor="type" className="mb-1 block text-sm font-medium text-[#2D4B68]">
                  Type
                </label>
                <select
                  id="type"
                  value={eventType}
                  onChange={(event) => setEventType(event.target.value as EventType)}
                  className="w-full rounded-xl border border-[#D8E4F0] px-3 py-2.5 text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
                >
                  {EVENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="startAt" className="mb-1 block text-sm font-medium text-[#2D4B68]">
                  Date début
                </label>
                <input
                  id="startAt"
                  type="datetime-local"
                  value={startAt}
                  onChange={(event) => setStartAt(event.target.value)}
                  className="w-full rounded-xl border border-[#D8E4F0] px-3 py-2.5 text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
                />
              </div>

              <div>
                <label htmlFor="endAt" className="mb-1 block text-sm font-medium text-[#2D4B68]">
                  Date fin
                </label>
                <input
                  id="endAt"
                  type="datetime-local"
                  value={endAt}
                  onChange={(event) => setEndAt(event.target.value)}
                  className="w-full rounded-xl border border-[#D8E4F0] px-3 py-2.5 text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
                />
              </div>

              <button
                type="submit"
                disabled={isCreating}
                className="mt-2 w-full rounded-xl bg-[#4A90D9] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(74,144,217,0.35)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isCreating ? "Enregistrement..." : "Enregistrer"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
