"use client";

import Link from "next/link";
import jsPDF from "jspdf";
import moment from "moment";
import "moment/locale/fr";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, momentLocalizer, Views } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type EventType = "Garde" | "Médecin" | "École" | "Activité";
type ParentRole = "parent1" | "parent2";
type SpecialDayType = "ferie" | "pedagogique" | "vacances" | "scolaire";

type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  kind: "event";
  type: EventType;
  ownerUserId: string | null;
  parent: string | null;
};

type SpecialDay = {
  id: string;
  title: string;
  date: string;
  type: SpecialDayType;
  notes: string | null;
};

type CalendarSpecialDayEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: true;
  kind: "special";
  specialType: SpecialDayType;
  notes: string | null;
};

type CalendarDisplayEvent = CalendarEvent | CalendarSpecialDayEvent;

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

type SupabaseJournalGardeRow = {
  id?: string | number;
  event_id?: string | number;
  garde_date?: string;
  guard_day?: string;
  date?: string;
  parent_role?: string;
  parent?: string;
  title?: string;
};

type JournalGardeEntry = {
  id: string;
  eventId: string;
  gardeDate: string;
  parentRole: ParentRole;
  title: string;
};

type SupabaseSpecialDayRow = {
  id?: string | number;
  title?: string;
  name?: string;
  date?: string;
  day_date?: string;
  type?: string;
  kind?: string;
  notes?: string;
  note?: string;
};

type SwapStatus = "pending" | "accepted" | "refused";

type SwapRequest = {
  id: string;
  requesterUserId: string | null;
  originalDate: string;
  proposedDate: string;
  reason: string;
  status: SwapStatus;
  responseReason: string | null;
  createdAt: string | null;
  respondedAt: string | null;
};

type SupabaseSwapRow = {
  id?: string | number;
  requester_user_id?: string;
  user_id?: string;
  owner_id?: string;
  original_date?: string;
  proposed_date?: string;
  current_date?: string;
  new_date?: string;
  reason?: string;
  request_reason?: string;
  status?: string;
  response_reason?: string;
  refusal_reason?: string;
  created_at?: string;
  responded_at?: string;
};

type SupabaseGuardScheduleRow = {
  schedule_type?: string;
  custom_schedule?: unknown;
  exchange_time?: string;
  exchange_location?: string;
  legal_contact_name?: string;
  case_number?: string;
  agreement_date?: string;
  mediator_notes?: string;
};

type ToastState = {
  message: string;
  variant: "success";
};

type DecisionType = "accept" | "refuse";
type GuardScheduleType = "weekly_alternating" | "biweekly_alternating" | "custom_shared";
type CustomDayRule = { enabled: boolean; parentRole: ParentRole };
type CustomScheduleMap = Record<number, CustomDayRule>;

const localizer = momentLocalizer(moment);
const EVENT_TYPES: EventType[] = ["Garde", "Médecin", "École", "Activité"];
const WEEKDAY_OPTIONS: Array<{ jsDay: number; label: string }> = [
  { jsDay: 1, label: "Lundi" },
  { jsDay: 2, label: "Mardi" },
  { jsDay: 3, label: "Mercredi" },
  { jsDay: 4, label: "Jeudi" },
  { jsDay: 5, label: "Vendredi" },
  { jsDay: 6, label: "Samedi" },
  { jsDay: 0, label: "Dimanche" },
];
const SPECIAL_DAY_OPTIONS: Array<{ value: SpecialDayType; label: string; emoji: string; color: string }> = [
  { value: "ferie", label: "Jour férié", emoji: "🔴", color: "#D94A4A" },
  { value: "pedagogique", label: "Congé pédagogique", emoji: "🟡", color: "#D9A74A" },
  { value: "vacances", label: "Vacances scolaires", emoji: "🟢", color: "#50C878" },
  { value: "scolaire", label: "Événement scolaire", emoji: "🔵", color: "#4A90D9" },
];
const SHARED_MONTH_KEY = "twonest.selectedMonth";

function formatForDateTimeLocal(date: Date): string {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function formatForDateInput(date: Date): string {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function formatDateLabel(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString("fr-CA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatMonthLabel(date: Date): string {
  const label = date.toLocaleDateString("fr-CA", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function shiftMonth(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function toMonthValue(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

function fromMonthValue(monthValue: string): Date | null {
  const [rawYear, rawMonth] = monthValue.split("-");
  const year = Number(rawYear);
  const month = Number(rawMonth);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }

  return new Date(year, month - 1, 1);
}

function normalizeParentRole(value: string | null | undefined): ParentRole {
  const normalized = (value ?? "").toLowerCase();
  return normalized.includes("2") ? "parent2" : "parent1";
}

function normalizeSpecialDayType(value: string | undefined): SpecialDayType {
  const normalized = (value ?? "").toLowerCase();
  if (normalized.includes("ferie") || normalized.includes("féri")) {
    return "ferie";
  }
  if (normalized.includes("pedo") || normalized.includes("peda")) {
    return "pedagogique";
  }
  if (normalized.includes("vacan")) {
    return "vacances";
  }
  return "scolaire";
}

function toDateOnlyKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function listDateKeysBetween(start: Date, end: Date): string[] {
  const current = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const values: string[] = [];

  while (current <= last) {
    values.push(toDateOnlyKey(current));
    current.setDate(current.getDate() + 1);
  }

  return values;
}

function createDefaultCustomSchedule(): CustomScheduleMap {
  return {
    0: { enabled: true, parentRole: "parent2" },
    1: { enabled: true, parentRole: "parent1" },
    2: { enabled: true, parentRole: "parent1" },
    3: { enabled: true, parentRole: "parent1" },
    4: { enabled: true, parentRole: "parent1" },
    5: { enabled: true, parentRole: "parent1" },
    6: { enabled: true, parentRole: "parent2" },
  };
}

function normalizeGuardScheduleType(value: string | undefined): GuardScheduleType {
  if (value === "biweekly_alternating" || value === "custom_shared") {
    return value;
  }
  return "weekly_alternating";
}

function normalizeCustomSchedule(value: unknown): CustomScheduleMap {
  const normalized = createDefaultCustomSchedule();
  if (!value || typeof value !== "object") {
    return normalized;
  }

  const candidate = value as Record<string, unknown>;

  for (const day of [0, 1, 2, 3, 4, 5, 6]) {
    const rawRule = candidate[String(day)];
    if (!rawRule || typeof rawRule !== "object") {
      continue;
    }

    const typedRule = rawRule as Record<string, unknown>;
    const enabled = typeof typedRule.enabled === "boolean" ? typedRule.enabled : normalized[day].enabled;
    const parentRaw =
      typeof typedRule.parentRole === "string"
        ? typedRule.parentRole
        : typeof typedRule.parent_role === "string"
          ? typedRule.parent_role
          : normalized[day].parentRole;

    normalized[day] = {
      enabled,
      parentRole: normalizeParentRole(parentRaw),
    };
  }

  return normalized;
}

function normalizeTimeInput(value: string | undefined): string {
  if (!value || value.length < 5) {
    return "17:00";
  }
  return value.slice(0, 5);
}

function isHoraireSchemaColumnMissing(message: string): boolean {
  const normalized = message.toLowerCase();
  const referencesTable = normalized.includes("horaire_garde");
  const missingColumnHint =
    normalized.includes("column") && normalized.includes("does not exist")
      ? true
      : normalized.includes("could not find") && normalized.includes("schema cache");

  return referencesTable && missingColumnHint;
}

function horaireSchemaMigrationMessage(): string {
  return "Le schéma Supabase de 'horaire_garde' est incomplet (colonne manquante, ex: user_id ou agreement_date). Exécutez le script supabase/horaire_garde_schema_run.sql puis rechargez la page.";
}

function isEventsMissingColumnError(message: string, column: string): boolean {
  const normalized = message.toLowerCase();
  const missingColumnHint =
    normalized.includes("column") && normalized.includes("does not exist")
      ? true
      : normalized.includes("could not find") && normalized.includes("schema cache");

  return normalized.includes("events") && normalized.includes(column.toLowerCase()) && missingColumnHint;
}

function toUtcDayMs(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function resolveScheduleParent(
  scheduleType: GuardScheduleType,
  date: Date,
  anchorDate: Date,
  customSchedule: CustomScheduleMap,
): ParentRole | null {
  if (scheduleType === "custom_shared") {
    const rule = customSchedule[date.getDay()];
    if (!rule || !rule.enabled) {
      return null;
    }
    return rule.parentRole;
  }

  const weekDiff = Math.floor((toUtcDayMs(date) - toUtcDayMs(anchorDate)) / (7 * 24 * 60 * 60 * 1000));
  const cycleIndex = scheduleType === "weekly_alternating" ? weekDiff : Math.floor(weekDiff / 2);
  return cycleIndex % 2 === 0 ? "parent1" : "parent2";
}

export default function CalendarPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [configError, setConfigError] = useState("");

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [journalEntries, setJournalEntries] = useState<JournalGardeEntry[]>([]);
  const [specialDays, setSpecialDays] = useState<SpecialDay[]>([]);
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([]);
  const [isLoadingSwapRequests, setIsLoadingSwapRequests] = useState(true);

  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreatingSwapRequest, setIsCreatingSwapRequest] = useState(false);
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [swapFormOpen, setSwapFormOpen] = useState(false);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [specialDayFormOpen, setSpecialDayFormOpen] = useState(false);
  const [journalEditOpen, setJournalEditOpen] = useState(false);
  const [scheduleFormOpen, setScheduleFormOpen] = useState(false);

  const [formError, setFormError] = useState("");
  const [editError, setEditError] = useState("");
  const [swapError, setSwapError] = useState("");
  const [decisionError, setDecisionError] = useState("");
  const [specialDayError, setSpecialDayError] = useState("");
  const [journalEditError, setJournalEditError] = useState("");
  const [scheduleError, setScheduleError] = useState("");
  const [toast, setToast] = useState<ToastState | null>(null);

  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState<EventType>("Garde");
  const [startAt, setStartAt] = useState(() => formatForDateTimeLocal(new Date()));
  const [endAt, setEndAt] = useState(() => formatForDateTimeLocal(new Date(Date.now() + 60 * 60 * 1000)));

  const [editingEventId, setEditingEventId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editEventType, setEditEventType] = useState<EventType>("Garde");
  const [editStartAt, setEditStartAt] = useState("");
  const [editEndAt, setEditEndAt] = useState("");

  const [originalDate, setOriginalDate] = useState(() => formatForDateInput(new Date()));
  const [proposedDate, setProposedDate] = useState(() => formatForDateInput(new Date(Date.now() + 24 * 60 * 60 * 1000)));
  const [swapReason, setSwapReason] = useState("");

  const [decisionType, setDecisionType] = useState<DecisionType>("accept");
  const [decisionRequestId, setDecisionRequestId] = useState("");
  const [decisionReason, setDecisionReason] = useState("");
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [profileRole, setProfileRole] = useState<ParentRole>("parent1");

  const [specialDayTitle, setSpecialDayTitle] = useState("");
  const [specialDayDate, setSpecialDayDate] = useState(() => formatForDateInput(new Date()));
  const [specialDayType, setSpecialDayType] = useState<SpecialDayType>("ferie");
  const [specialDayNotes, setSpecialDayNotes] = useState("");
  const [isCreatingSpecialDay, setIsCreatingSpecialDay] = useState(false);
  const [isSavingJournalEdit, setIsSavingJournalEdit] = useState(false);
  const [isDeletingJournalEntry, setIsDeletingJournalEntry] = useState(false);
  const [isApplyingSchedule, setIsApplyingSchedule] = useState(false);

  const [editingJournalId, setEditingJournalId] = useState("");
  const [editingJournalEventId, setEditingJournalEventId] = useState("");
  const [editingJournalStartDate, setEditingJournalStartDate] = useState(() => formatForDateInput(new Date()));
  const [editingJournalEndDate, setEditingJournalEndDate] = useState(() => formatForDateInput(new Date()));
  const [editingJournalParentRole, setEditingJournalParentRole] = useState<ParentRole>("parent1");
  const [editingJournalNotes, setEditingJournalNotes] = useState("");
  const [scheduleType, setScheduleType] = useState<GuardScheduleType>("weekly_alternating");
  const [customSchedule, setCustomSchedule] = useState<CustomScheduleMap>(() => createDefaultCustomSchedule());
  const [exchangeTime, setExchangeTime] = useState("17:00");
  const [exchangeLocation, setExchangeLocation] = useState("École");
  const [legalContactName, setLegalContactName] = useState("");
  const [legalCaseNumber, setLegalCaseNumber] = useState("");
  const [agreementDate, setAgreementDate] = useState(() => formatForDateInput(new Date()));
  const [mediatorNotes, setMediatorNotes] = useState("");

  const canSubmit = useMemo(() => title.trim().length > 0 && startAt.length > 0 && endAt.length > 0, [title, startAt, endAt]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    moment.locale("fr");
  }, []);

  useEffect(() => {
    const storedMonth = window.localStorage.getItem(SHARED_MONTH_KEY);
    if (!storedMonth) {
      return;
    }

    const parsedDate = fromMonthValue(storedMonth);
    if (parsedDate) {
      setCalendarDate(parsedDate);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SHARED_MONTH_KEY, toMonthValue(calendarDate));
  }, [calendarDate]);

  const refreshEvents = async (client = getSupabaseBrowserClient()) => {
    let query = client.from("events").select("*");
    let { data, error } = await query.order("start_at", { ascending: true });

    if (error) {
      const fallback = await client.from("events").select("*");
      data = fallback.data;
      error = fallback.error;
    }

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
          title: row.title,
          kind: "event",
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

  const refreshJournalEntries = async (client = getSupabaseBrowserClient()) => {
    let { data, error } = await client.from("journal_garde").select("*").order("garde_date", { ascending: true });

    if (error) {
      const fallback = await client.from("journal_garde").select("*");
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      return;
    }

    const mapped = (data as SupabaseJournalGardeRow[])
      .map((row): JournalGardeEntry | null => {
        const gardeDate = row.garde_date ?? row.guard_day ?? row.date;
        const eventId = row.event_id ? String(row.event_id) : "";
        if (!row.id || !gardeDate || !eventId) {
          return null;
        }

        return {
          id: String(row.id),
          eventId,
          gardeDate,
          parentRole: normalizeParentRole(row.parent_role ?? row.parent),
          title: row.title ?? "Garde",
        };
      })
      .filter((entry): entry is JournalGardeEntry => entry !== null);

    setJournalEntries(mapped);
  };

  const refreshSpecialDays = async (client = getSupabaseBrowserClient()) => {
    let { data, error } = await client.from("jours_speciaux").select("*").order("date", { ascending: true });

    if (error) {
      const fallback = await client.from("jours_speciaux").select("*");
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      return;
    }

    const mapped = (data as SupabaseSpecialDayRow[])
      .map((row): SpecialDay | null => {
        const date = row.date ?? row.day_date;
        const title = row.title ?? row.name;
        if (!row.id || !date || !title) {
          return null;
        }

        return {
          id: String(row.id),
          title,
          date,
          type: normalizeSpecialDayType(row.type ?? row.kind),
          notes: row.notes ?? row.note ?? null,
        };
      })
      .filter((item): item is SpecialDay => item !== null);

    setSpecialDays(mapped);
  };

  const syncJournalForEvent = async (
    eventId: string,
    eventTypeValue: EventType,
    eventStart: Date,
    eventEnd: Date,
    parentRole: ParentRole,
    eventTitle: string,
    client = getSupabaseBrowserClient(),
  ) => {
    await client.from("journal_garde").delete().eq("event_id", eventId);

    if (eventTypeValue !== "Garde") {
      return;
    }

    const gardeDays = listDateKeysBetween(eventStart, eventEnd);
    if (gardeDays.length === 0) {
      return;
    }

    const rows = gardeDays.map((day) => ({
      event_id: eventId,
      garde_date: day,
      parent_role: parentRole,
      title: eventTitle,
    }));

    const { error } = await client.from("journal_garde").insert(rows);
    if (error) {
      await client.from("journal_garde").insert(
        gardeDays.map((day) => ({
          event_id: eventId,
          guard_day: day,
          parent: parentRole,
          title: eventTitle,
        })),
      );
    }
  };

  const refreshSwapRequests = async (client = getSupabaseBrowserClient()) => {
    let query = client.from("swap_requests").select("*");
    let { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      const fallback = await client.from("swap_requests").select("*");
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      setSwapError(error.message);
      return;
    }

    const mapped = (data as SupabaseSwapRow[])
      .map((row): SwapRequest | null => {
        const rowOriginalDate = row.original_date ?? row.current_date;
        const rowProposedDate = row.proposed_date ?? row.new_date;

        if (!row.id || !rowOriginalDate || !rowProposedDate) {
          return null;
        }

        const statusCandidate = row.status ?? "pending";
        const status: SwapStatus =
          statusCandidate === "accepted" || statusCandidate === "refused" ? statusCandidate : "pending";

        return {
          id: String(row.id),
          requesterUserId: row.requester_user_id ?? row.user_id ?? row.owner_id ?? null,
          originalDate: rowOriginalDate,
          proposedDate: rowProposedDate,
          reason: row.reason ?? row.request_reason ?? "",
          status,
          responseReason: row.response_reason ?? row.refusal_reason ?? null,
          createdAt: row.created_at ?? null,
          respondedAt: row.responded_at ?? null,
        };
      })
      .filter((request): request is SwapRequest => request !== null);

    setSwapRequests(mapped);
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
      setIsLoadingEvents(false);
      setIsLoadingSwapRequests(false);
      return;
    }

    const loadInitialData = async () => {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        router.replace("/");
        return;
      }

      setUser(userData.user);
      setCheckingSession(false);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", userData.user.id)
        .maybeSingle();

      setProfileRole(normalizeParentRole(profileData?.role));

      await Promise.all([
        refreshEvents(supabase),
        refreshSwapRequests(supabase),
        refreshJournalEntries(supabase),
        refreshSpecialDays(supabase),
      ]);
      setIsLoadingEvents(false);
      setIsLoadingSwapRequests(false);
    };

    loadInitialData();

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

  const openEditForm = (selectedEvent: CalendarEvent) => {
    setEditError("");
    setEditingEventId(selectedEvent.id);
    setEditTitle(selectedEvent.title);
    setEditEventType(selectedEvent.type);
    setEditStartAt(formatForDateTimeLocal(selectedEvent.start));
    setEditEndAt(formatForDateTimeLocal(selectedEvent.end));
    setEditOpen(true);
  };

  const closeEditForm = () => {
    setEditOpen(false);
    setEditError("");
    setEditingEventId("");
  };

  const openSwapForm = () => {
    setSwapError("");
    setSwapFormOpen(true);
  };

  const closeSwapForm = () => {
    setSwapFormOpen(false);
    setSwapError("");
  };

  const openScheduleForm = async () => {
    setScheduleError("");
    setScheduleFormOpen(true);

    if (!user) {
      return;
    }

    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("horaire_garde")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        if (isHoraireSchemaColumnMissing(error.message)) {
          setScheduleError(horaireSchemaMigrationMessage());
          return;
        }
        setScheduleError(error.message);
        return;
      }

      if (!data) {
        return;
      }

      const row = data as SupabaseGuardScheduleRow;
      setScheduleType(normalizeGuardScheduleType(row.schedule_type));
      setCustomSchedule(normalizeCustomSchedule(row.custom_schedule));
      setExchangeTime(normalizeTimeInput(row.exchange_time));
      setExchangeLocation(row.exchange_location ?? "");
      setLegalContactName(row.legal_contact_name ?? "");
      setLegalCaseNumber(row.case_number ?? "");
      setAgreementDate(row.agreement_date ?? formatForDateInput(new Date()));
      setMediatorNotes(row.mediator_notes ?? "");
    } catch (error) {
      setScheduleError(error instanceof Error ? error.message : "Impossible de charger l'horaire sauvegardé.");
    }
  };

  const closeScheduleForm = () => {
    setScheduleFormOpen(false);
    setScheduleError("");
  };

  const openJournalEditForm = (entry: JournalGardeEntry) => {
    setJournalEditError("");
    setEditingJournalId(entry.id);
    setEditingJournalEventId(entry.eventId);
    setEditingJournalStartDate(entry.gardeDate);
    setEditingJournalEndDate(entry.gardeDate);
    setEditingJournalParentRole(entry.parentRole);
    setEditingJournalNotes(entry.title);
    setJournalEditOpen(true);
  };

  const closeJournalEditForm = () => {
    setJournalEditOpen(false);
    setJournalEditError("");
    setEditingJournalId("");
    setEditingJournalEventId("");
  };

  const openDecisionModal = (request: SwapRequest, type: DecisionType) => {
    setDecisionError("");
    setDecisionType(type);
    setDecisionRequestId(request.id);
    setDecisionReason("");
    setDecisionOpen(true);
  };

  const closeDecisionModal = () => {
    setDecisionOpen(false);
    setDecisionError("");
    setDecisionReason("");
    setDecisionRequestId("");
    setDecisionType("accept");
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
        parent: profileRole,
        start_at: startDate.toISOString(),
        end_at: endDate.toISOString(),
      }).select("id").maybeSingle();

      let createdEventId: string | null = null;

      if (!insertError) {
        const { data: latest } = await supabase
          .from("events")
          .select("id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        createdEventId = latest?.id ? String(latest.id) : null;
      } else {
        const { data: fallbackInserted, error: fallbackError } = await supabase.from("events").insert({
          ...basePayload,
          parent: profileRole,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
        }).select("id").maybeSingle();

        if (fallbackError) {
          setFormError(fallbackError.message);
          return;
        }

        createdEventId = fallbackInserted?.id ? String(fallbackInserted.id) : null;
      }

      if (createdEventId) {
        await syncJournalForEvent(createdEventId, eventType, startDate, endDate, profileRole, title.trim(), supabase);
        await refreshJournalEntries(supabase);
      }

      await refreshEvents();
      setTitle("");
      setEventType("Garde");
      setStartAt(formatForDateTimeLocal(new Date()));
      setEndAt(formatForDateTimeLocal(new Date(Date.now() + 60 * 60 * 1000)));
      setFormOpen(false);
      setToast({ message: "Événement créé avec succès.", variant: "success" });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Erreur pendant l'enregistrement de l'événement.");
    } finally {
      setIsCreating(false);
    }
  };

  const onUpdateEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingEventId || editTitle.trim().length === 0 || editStartAt.length === 0 || editEndAt.length === 0) {
      setEditError("Tous les champs sont obligatoires.");
      return;
    }

    const startDate = new Date(editStartAt);
    const endDate = new Date(editEndAt);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      setEditError("Dates invalides.");
      return;
    }

    if (endDate <= startDate) {
      setEditError("La date de fin doit être après la date de début.");
      return;
    }

    setIsUpdating(true);
    setEditError("");

    try {
      const supabase = getSupabaseBrowserClient();
      const basePayload = {
        title: editTitle.trim(),
        type: editEventType,
      };

      const { error: updateError } = await supabase
        .from("events")
        .update({
          ...basePayload,
          parent: profileRole,
          start_at: startDate.toISOString(),
          end_at: endDate.toISOString(),
        })
        .eq("id", editingEventId);

      if (updateError) {
        const { error: fallbackError } = await supabase
          .from("events")
          .update({
            ...basePayload,
            parent: profileRole,
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
          })
          .eq("id", editingEventId);

        if (fallbackError) {
          setEditError(fallbackError.message);
          return;
        }
      }

      await syncJournalForEvent(editingEventId, editEventType, startDate, endDate, profileRole, editTitle.trim(), supabase);
      await refreshJournalEntries(supabase);

      await refreshEvents();
      closeEditForm();
      setToast({ message: "Événement modifié avec succès.", variant: "success" });
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Erreur pendant la modification de l'événement.");
    } finally {
      setIsUpdating(false);
    }
  };

  const onDeleteEvent = async () => {
    if (!editingEventId) {
      return;
    }

    setIsDeleting(true);
    setEditError("");

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("events").delete().eq("id", editingEventId);

      if (error) {
        setEditError(error.message);
        return;
      }

      await supabase.from("journal_garde").delete().eq("event_id", editingEventId);
      await refreshJournalEntries(supabase);

      await refreshEvents();
      closeEditForm();
      setToast({ message: "Événement supprimé.", variant: "success" });
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Erreur pendant la suppression de l'événement.");
    } finally {
      setIsDeleting(false);
    }
  };

  const onCreateSwapRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user || originalDate.length === 0 || proposedDate.length === 0 || swapReason.trim().length === 0) {
      setSwapError("Tous les champs sont obligatoires.");
      return;
    }

    setIsCreatingSwapRequest(true);
    setSwapError("");

    try {
      const supabase = getSupabaseBrowserClient();
      const payload = {
        requester_user_id: user.id,
        original_date: originalDate,
        proposed_date: proposedDate,
        reason: swapReason.trim(),
        status: "pending",
      };

      const { error } = await supabase.from("swap_requests").insert(payload);

      if (error) {
        const { error: fallbackError } = await supabase.from("swap_requests").insert({
          user_id: user.id,
          current_date: originalDate,
          new_date: proposedDate,
          reason: swapReason.trim(),
          status: "pending",
        });

        if (fallbackError) {
          setSwapError(fallbackError.message);
          return;
        }
      }

      await refreshSwapRequests();
      setOriginalDate(formatForDateInput(new Date()));
      setProposedDate(formatForDateInput(new Date(Date.now() + 24 * 60 * 60 * 1000)));
      setSwapReason("");
      closeSwapForm();
      setToast({ message: "Demande envoyée au co-parent.", variant: "success" });
    } catch (error) {
      setSwapError(error instanceof Error ? error.message : "Erreur pendant la création de la demande.");
    } finally {
      setIsCreatingSwapRequest(false);
    }
  };

  const onSaveJournalEntry = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingJournalId || !editingJournalEventId || !editingJournalStartDate || !editingJournalEndDate) {
      setJournalEditError("Tous les champs sont obligatoires.");
      return;
    }

    const startDate = new Date(`${editingJournalStartDate}T00:00:00`);
    const endDate = new Date(`${editingJournalEndDate}T00:00:00`);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      setJournalEditError("Dates invalides.");
      return;
    }

    if (endDate < startDate) {
      setJournalEditError("La date fin doit être après ou égale à la date début.");
      return;
    }

    if (editingJournalStartDate !== editingJournalEndDate) {
      setJournalEditError("Pour modifier une entrée unique, la date début et la date fin doivent être identiques.");
      return;
    }

    setIsSavingJournalEdit(true);
    setJournalEditError("");

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("journal_garde")
        .update({
          event_id: editingJournalEventId,
          garde_date: editingJournalStartDate,
          parent_role: editingJournalParentRole,
          title: editingJournalNotes.trim() || "Garde",
        })
        .eq("id", editingJournalId);

      if (error) {
        const fallback = await supabase
          .from("journal_garde")
          .update({
            event_id: editingJournalEventId,
            guard_day: editingJournalStartDate,
            parent: editingJournalParentRole,
            title: editingJournalNotes.trim() || "Garde",
          })
          .eq("id", editingJournalId);

        if (fallback.error) {
          setJournalEditError(fallback.error.message);
          return;
        }
      }

      await refreshJournalEntries(supabase);
      closeJournalEditForm();
      setToast({ message: "Entrée du journal modifiée.", variant: "success" });
    } catch (error) {
      setJournalEditError(error instanceof Error ? error.message : "Erreur pendant la sauvegarde de l'entrée.");
    } finally {
      setIsSavingJournalEdit(false);
    }
  };

  const onDeleteJournalEntry = async () => {
    if (!editingJournalId) {
      return;
    }

    const confirmed = window.confirm("Confirmer la suppression de cette entrée du journal de garde ?");
    if (!confirmed) {
      return;
    }

    setIsDeletingJournalEntry(true);
    setJournalEditError("");

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("journal_garde").delete().eq("id", editingJournalId);

      if (error) {
        setJournalEditError(error.message);
        return;
      }

      await refreshJournalEntries(supabase);
      closeJournalEditForm();
      setToast({ message: "Entrée du journal supprimée.", variant: "success" });
    } catch (error) {
      setJournalEditError(error instanceof Error ? error.message : "Erreur pendant la suppression de l'entrée.");
    } finally {
      setIsDeletingJournalEntry(false);
    }
  };

  const onSubmitDecision = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!decisionRequestId) {
      return;
    }

    if (decisionType === "refuse" && decisionReason.trim().length === 0) {
      setDecisionError("Une raison est obligatoire pour refuser.");
      return;
    }

    setIsSubmittingDecision(true);
    setDecisionError("");

    try {
      const supabase = getSupabaseBrowserClient();
      const newStatus = decisionType === "accept" ? "accepted" : "refused";

      const { error } = await supabase
        .from("swap_requests")
        .update({
          status: newStatus,
          responded_at: new Date().toISOString(),
          response_reason: decisionType === "refuse" ? decisionReason.trim() : null,
        })
        .eq("id", decisionRequestId);

      if (error) {
        const { error: fallbackError } = await supabase
          .from("swap_requests")
          .update({
            status: newStatus,
            refusal_reason: decisionType === "refuse" ? decisionReason.trim() : null,
          })
          .eq("id", decisionRequestId);

        if (fallbackError) {
          setDecisionError(fallbackError.message);
          return;
        }
      }

      await refreshSwapRequests();
      closeDecisionModal();
      setToast({
        message: decisionType === "accept" ? "Demande acceptée." : "Demande refusée.",
        variant: "success",
      });
    } catch (error) {
      setDecisionError(error instanceof Error ? error.message : "Erreur pendant la mise à jour de la demande.");
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  const statusUi: Record<SwapStatus, { label: string; emoji: string; className: string }> = {
    pending: {
      label: "En attente",
      emoji: "🟡",
      className: "border-[#F5E4A8] bg-[#FFF9E8] text-[#8A6A00]",
    },
    accepted: {
      label: "Acceptée",
      emoji: "✅",
      className: "border-[#BDDCC5] bg-[#F2FAF4] text-[#2D6940]",
    },
    refused: {
      label: "Refusée",
      emoji: "❌",
      className: "border-[#E3B4B8] bg-[#FFF4F5] text-[#8D3E45]",
    },
  };

  const specialTypeConfig = useMemo(() => {
    return SPECIAL_DAY_OPTIONS.reduce<Record<SpecialDayType, { label: string; emoji: string; color: string }>>(
      (accumulator, item) => {
        accumulator[item.value] = { label: item.label, emoji: item.emoji, color: item.color };
        return accumulator;
      },
      {
        ferie: { label: "Jour férié", emoji: "🔴", color: "#D94A4A" },
        pedagogique: { label: "Congé pédagogique", emoji: "🟡", color: "#D9A74A" },
        vacances: { label: "Vacances scolaires", emoji: "🟢", color: "#50C878" },
        scolaire: { label: "Événement scolaire", emoji: "🔵", color: "#4A90D9" },
      },
    );
  }, []);

  const calendarSpecialEvents = useMemo<CalendarSpecialDayEvent[]>(() => {
    return specialDays
      .map((specialDay) => {
        const start = new Date(`${specialDay.date}T00:00:00`);
        if (Number.isNaN(start.getTime())) {
          return null;
        }
        const end = new Date(start);
        end.setDate(end.getDate() + 1);

        return {
          id: `special-${specialDay.id}`,
          title: specialDay.title,
          start,
          end,
          allDay: true,
          kind: "special",
          specialType: specialDay.type,
          notes: specialDay.notes,
        };
      })
      .filter((item): item is CalendarSpecialDayEvent => item !== null);
  }, [specialDays]);

  const calendarDisplayEvents = useMemo<CalendarDisplayEvent[]>(() => {
    return [...events, ...calendarSpecialEvents];
  }, [calendarSpecialEvents, events]);

  const monthDatePrefix = useMemo(
    () => `${calendarDate.getFullYear()}-${`${calendarDate.getMonth() + 1}`.padStart(2, "0")}`,
    [calendarDate],
  );
  const yearDatePrefix = useMemo(() => `${calendarDate.getFullYear()}-`, [calendarDate]);

  const journalMonthEntries = useMemo(
    () => journalEntries.filter((entry) => entry.gardeDate.startsWith(monthDatePrefix)),
    [journalEntries, monthDatePrefix],
  );
  const journalYearEntries = useMemo(
    () => journalEntries.filter((entry) => entry.gardeDate.startsWith(yearDatePrefix)),
    [journalEntries, yearDatePrefix],
  );

  const monthCounts = useMemo(() => {
    const parent1 = new Set<string>();
    const parent2 = new Set<string>();

    for (const entry of journalMonthEntries) {
      const key = `${entry.parentRole}:${entry.gardeDate}`;
      if (entry.parentRole === "parent1") {
        parent1.add(key);
      } else {
        parent2.add(key);
      }
    }

    return { parent1: parent1.size, parent2: parent2.size };
  }, [journalMonthEntries]);

  const yearCounts = useMemo(() => {
    const parent1 = new Set<string>();
    const parent2 = new Set<string>();

    for (const entry of journalYearEntries) {
      const key = `${entry.parentRole}:${entry.gardeDate}`;
      if (entry.parentRole === "parent1") {
        parent1.add(key);
      } else {
        parent2.add(key);
      }
    }

    return { parent1: parent1.size, parent2: parent2.size };
  }, [journalYearEntries]);

  const maxMonthCount = Math.max(monthCounts.parent1, monthCounts.parent2, 1);

  const onCreateSpecialDay = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user || specialDayTitle.trim().length === 0 || specialDayDate.length === 0) {
      setSpecialDayError("Titre et date sont obligatoires.");
      return;
    }

    setIsCreatingSpecialDay(true);
    setSpecialDayError("");

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("jours_speciaux").insert({
        title: specialDayTitle.trim(),
        date: specialDayDate,
        type: specialDayType,
        notes: specialDayNotes.trim() || null,
        user_id: user.id,
      });

      if (error) {
        const fallback = await supabase.from("jours_speciaux").insert({
          name: specialDayTitle.trim(),
          day_date: specialDayDate,
          kind: specialDayType,
          note: specialDayNotes.trim() || null,
          owner_id: user.id,
        });

        if (fallback.error) {
          setSpecialDayError(fallback.error.message);
          return;
        }
      }

      await refreshSpecialDays(supabase);
      setSpecialDayTitle("");
      setSpecialDayDate(formatForDateInput(new Date()));
      setSpecialDayType("ferie");
      setSpecialDayNotes("");
      setSpecialDayFormOpen(false);
      setToast({ message: "Jour spécial ajouté.", variant: "success" });
    } catch (error) {
      setSpecialDayError(error instanceof Error ? error.message : "Erreur pendant l'ajout du jour spécial.");
    } finally {
      setIsCreatingSpecialDay(false);
    }
  };

  const onApplyGuardSchedule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user) {
      setScheduleError("Session invalide.");
      return;
    }

    if (!exchangeTime || !exchangeLocation.trim() || !legalContactName.trim() || !agreementDate) {
      setScheduleError("Veuillez remplir les champs obligatoires de l'horaire.");
      return;
    }

    const agreementAnchor = new Date(`${agreementDate}T00:00:00`);
    if (Number.isNaN(agreementAnchor.getTime())) {
      setScheduleError("Date de l'entente invalide.");
      return;
    }

    setIsApplyingSchedule(true);
    setScheduleError("");

    try {
      const supabase = getSupabaseBrowserClient();
      const schedulePayload = {
        user_id: user.id,
        schedule_type: scheduleType,
        custom_schedule: scheduleType === "custom_shared" ? customSchedule : null,
        exchange_time: exchangeTime,
        exchange_location: exchangeLocation.trim(),
        legal_contact_name: legalContactName.trim(),
        case_number: legalCaseNumber.trim() || null,
        agreement_date: agreementDate,
        mediator_notes: mediatorNotes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { error: saveScheduleError } = await supabase
        .from("horaire_garde")
        .upsert(schedulePayload, { onConflict: "user_id" });

      if (saveScheduleError) {
        if (isHoraireSchemaColumnMissing(saveScheduleError.message)) {
          setScheduleError(horaireSchemaMigrationMessage());
          return;
        }
        setScheduleError(saveScheduleError.message);
        return;
      }

      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 12);
      const startIso = startDate.toISOString();
      const endIso = endDate.toISOString();

      let existingEventsData: Array<{ id?: string | number }> = [];
      let existingEventsError: { message: string } | null = null;

      const existingByStartAt = await supabase
        .from("events")
        .select("id")
        .eq("user_id", user.id)
        .eq("type", "Garde")
        .eq("title", "Horaire de garde (auto)")
        .gte("start_at", startIso)
        .lt("start_at", endIso);

      if (existingByStartAt.error) {
        const fallbackByStartDate = await supabase
          .from("events")
          .select("id")
          .eq("user_id", user.id)
          .eq("type", "Garde")
          .eq("title", "Horaire de garde (auto)")
          .gte("start_date", startIso)
          .lt("start_date", endIso);

        if (fallbackByStartDate.error) {
          const fallbackByStart = await supabase
            .from("events")
            .select("id")
            .eq("user_id", user.id)
            .eq("type", "Garde")
            .eq("title", "Horaire de garde (auto)")
            .gte("start", startIso)
            .lt("start", endIso);

          existingEventsData = fallbackByStart.data ?? [];
          existingEventsError = fallbackByStart.error;
        } else {
          existingEventsData = fallbackByStartDate.data ?? [];
        }
      } else {
        existingEventsData = existingByStartAt.data ?? [];
      }

      if (existingEventsError) {
        setScheduleError(existingEventsError.message);
        return;
      }

      const existingEventIds = existingEventsData
        .map((row) => (row.id ? String(row.id) : ""))
        .filter((value) => value.length > 0);

      if (existingEventIds.length > 0) {
        await supabase.from("journal_garde").delete().in("event_id", existingEventIds);
        await supabase.from("events").delete().in("id", existingEventIds);
      }

      const generatedEvents: Array<{
        title: string;
        type: EventType;
        user_id: string;
        parent: ParentRole;
        start_at: string;
        end_at: string;
      }> = [];

      const cursor = new Date(startDate);
      while (cursor < endDate) {
        const parentRole = resolveScheduleParent(scheduleType, cursor, agreementAnchor, customSchedule);
        if (parentRole) {
          const dayStart = new Date(cursor);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(cursor);
          dayEnd.setHours(23, 59, 0, 0);

          generatedEvents.push({
            title: "Horaire de garde (auto)",
            type: "Garde",
            user_id: user.id,
            parent: parentRole,
            start_at: dayStart.toISOString(),
            end_at: dayEnd.toISOString(),
          });
        }

        cursor.setDate(cursor.getDate() + 1);
      }

      if (generatedEvents.length === 0) {
        setScheduleError("Aucun jour de garde généré. Vérifiez la configuration personnalisée.");
        return;
      }

      let insertedRows:
        | Array<{ id?: string | number; start_at?: string; start_date?: string; start?: string; parent?: string; parent_role?: string }>
        | null = null;

      const inserted = await supabase
        .from("events")
        .insert(generatedEvents)
        .select("*");

      if (inserted.error) {
        const fallbackInserted = await supabase
          .from("events")
          .insert(
            generatedEvents.map((row) => ({
              title: row.title,
              type: row.type,
              user_id: row.user_id,
              parent: row.parent,
              start_date: row.start_at,
              end_date: row.end_at,
            })),
          )
          .select("*");

        if (fallbackInserted.error) {
          if (
            isEventsMissingColumnError(fallbackInserted.error.message, "start_date") ||
            isEventsMissingColumnError(fallbackInserted.error.message, "end_date")
          ) {
            const fallbackLegacyInserted = await supabase
              .from("events")
              .insert(
                generatedEvents.map((row) => ({
                  title: row.title,
                  type: row.type,
                  user_id: row.user_id,
                  parent: row.parent,
                  start: row.start_at,
                  end: row.end_at,
                })),
              )
              .select("*");

            if (fallbackLegacyInserted.error) {
              setScheduleError(fallbackLegacyInserted.error.message);
              return;
            }

            insertedRows = fallbackLegacyInserted.data ?? [];
          } else {
            setScheduleError(fallbackInserted.error.message);
            return;
          }
        } else {
          insertedRows = fallbackInserted.data ?? [];
        }
      } else {
        insertedRows = inserted.data ?? [];
      }

      const journalRows = (insertedRows ?? [])
        .map((row) => {
          const id = row.id ? String(row.id) : "";
          const startValue = row.start_at ?? row.start_date ?? row.start;
          if (!id || !startValue) {
            return null;
          }

          const gardeDate = startValue.slice(0, 10);
          return {
            event_id: id,
            garde_date: gardeDate,
            parent_role: normalizeParentRole(row.parent ?? row.parent_role),
            title: "Horaire de garde (auto)",
          };
        })
        .filter((row): row is { event_id: string; garde_date: string; parent_role: ParentRole; title: string } => row !== null);

      if (journalRows.length > 0) {
        const journalInsert = await supabase.from("journal_garde").upsert(journalRows, { onConflict: "event_id,garde_date" });

        if (journalInsert.error) {
          const fallbackJournalRows = journalRows.map((row) => ({
            event_id: row.event_id,
            guard_day: row.garde_date,
            parent: row.parent_role,
            title: row.title,
          }));
          const fallbackJournalInsert = await supabase
            .from("journal_garde")
            .upsert(fallbackJournalRows, { onConflict: "event_id,guard_day" });

          if (fallbackJournalInsert.error) {
            setScheduleError(fallbackJournalInsert.error.message);
            return;
          }
        }
      }

      await refreshEvents(supabase);
      await refreshJournalEntries(supabase);
      closeScheduleForm();
      setToast({ message: "Horaire appliqué sur les 12 prochains mois.", variant: "success" });
    } catch (error) {
      setScheduleError(error instanceof Error ? error.message : "Erreur pendant l'application de l'horaire.");
    } finally {
      setIsApplyingSchedule(false);
    }
  };

  const onExportCalendarPdf = () => {
    const doc = new jsPDF();
    const monthLabel = formatMonthLabel(calendarDate);
    const fileName = `calendrier-2nest-${toMonthValue(calendarDate)}.pdf`;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - 28;
    const left = 14;
    const right = pageWidth - 14;
    const monthKey = toMonthValue(calendarDate);

    const monthEvents = events
      .filter((eventItem) => toMonthValue(eventItem.start) === monthKey)
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    const monthSpecialDays = specialDays
      .filter((item) => item.date.startsWith(`${calendarDate.getFullYear()}-${`${calendarDate.getMonth() + 1}`.padStart(2, "0")}`))
      .sort((a, b) => a.date.localeCompare(b.date));

    const monthGuardByParent = { parent1: 0, parent2: 0 };
    for (const eventItem of monthEvents) {
      if (eventItem.type !== "Garde") {
        continue;
      }
      if (normalizeParentRole(eventItem.parent) === "parent1") {
        monthGuardByParent.parent1 += 1;
      } else {
        monthGuardByParent.parent2 += 1;
      }
    }

    let y = 18;

    const ensurePageSpace = (required = 8) => {
      if (y + required <= 280) {
        return;
      }
      doc.addPage();
      y = 18;
    };

    const addSectionTitle = (value: string) => {
      ensurePageSpace(10);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text(value, left, y);
      y += 7;
      doc.setFont("helvetica", "normal");
    };

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(`Calendrier 2nest - ${monthLabel}`, 14, y);

    y += 8;
    doc.setLineWidth(0.3);
    doc.line(left, y, right, y);

    y += 7;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Période: ${monthLabel}`, left, y);
    y += 6;
    doc.text(`Événements total (mois): ${monthEvents.length}`, left, y);
    y += 6;
    doc.text(`Jours spéciaux (mois): ${monthSpecialDays.length}`, left, y);

    addSectionTitle("Résumé de garde");
    doc.setFontSize(11);
    doc.text(`Jours de garde ce mois: Parent 1 = ${monthCounts.parent1} | Parent 2 = ${monthCounts.parent2}`, left, y);
    y += 6;
    doc.text(`Jours de garde cette année: Parent 1 = ${yearCounts.parent1} | Parent 2 = ${yearCounts.parent2}`, left, y);
    y += 6;
    doc.text(`Événements "Garde" du mois: Parent 1 = ${monthGuardByParent.parent1} | Parent 2 = ${monthGuardByParent.parent2}`, left, y);

    addSectionTitle("Événements du mois");

    ensurePageSpace(10);
    doc.setFillColor(241, 247, 253);
    doc.rect(left, y, contentWidth, 8, "F");
    doc.rect(left, y, contentWidth, 8);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Date", left + 2, y + 5.5);
    doc.text("Titre", left + 34, y + 5.5);
    doc.text("Type", right - 42, y + 5.5);
    y += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    if (monthEvents.length === 0) {
      doc.text("Aucun événement.", left + 2, y + 5.5);
      doc.rect(left, y, contentWidth, 8);
      y += 6;
    } else {
      for (const eventItem of monthEvents) {
        ensurePageSpace(10);
        doc.rect(left, y, contentWidth, 8);
        const dateLabel = `${eventItem.start.toLocaleDateString("fr-CA")}`;
        const titleLabel = eventItem.title.length > 32 ? `${eventItem.title.slice(0, 32)}…` : eventItem.title;
        doc.text(dateLabel, left + 2, y + 5.5);
        doc.text(titleLabel, left + 34, y + 5.5);
        doc.text(eventItem.type, right - 42, y + 5.5);
        y += 8;
      }
    }

    addSectionTitle("Jours spéciaux du mois");
    ensurePageSpace(10);
    doc.setFillColor(241, 247, 253);
    doc.rect(left, y, contentWidth, 8, "F");
    doc.rect(left, y, contentWidth, 8);
    doc.setFont("helvetica", "bold");
    doc.text("Date", left + 2, y + 5.5);
    doc.text("Titre", left + 34, y + 5.5);
    doc.text("Type", right - 52, y + 5.5);
    y += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    if (monthSpecialDays.length === 0) {
      doc.text("Aucun jour spécial.", left + 2, y + 5.5);
      doc.rect(left, y, contentWidth, 8);
    } else {
      for (const item of monthSpecialDays) {
        ensurePageSpace(10);
        doc.rect(left, y, contentWidth, 8);
        const titleLabel = item.title.length > 32 ? `${item.title.slice(0, 32)}…` : item.title;
        doc.text(formatDateLabel(item.date), left + 2, y + 5.5);
        doc.text(titleLabel, left + 34, y + 5.5);
        doc.text(specialTypeConfig[item.type].label, right - 52, y + 5.5);
        y += 8;
      }
    }

    ensurePageSpace(10);
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(94, 122, 149);
    doc.text(`Document généré le ${new Date().toLocaleDateString("fr-CA")}`, left, y);
    doc.setTextColor(0, 0, 0);

    doc.save(fileName);
    setToast({ message: "PDF du calendrier exporté.", variant: "success" });
  };

  if (checkingSession || isLoadingEvents || isLoadingSwapRequests) {
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

        <section className="rounded-2xl border border-[#D7E6F4] bg-white p-4 shadow-[0_10px_28px_rgba(74,144,217,0.08)] sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-[#17324D]">CALENDRIER</h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setJournalOpen((current) => !current)}
                className="inline-flex items-center justify-center rounded-xl border border-[#D0DFEE] bg-white px-4 py-2 text-sm font-semibold text-[#365A7B] transition hover:bg-[#F1F7FD]"
              >
                📓 Journal de garde
              </button>
              <button
                type="button"
                onClick={() => {
                  setSpecialDayError("");
                  setSpecialDayFormOpen(true);
                }}
                className="inline-flex items-center justify-center rounded-xl border border-[#D0DFEE] bg-white px-4 py-2 text-sm font-semibold text-[#365A7B] transition hover:bg-[#F1F7FD]"
              >
                ➕ Ajouter un jour spécial
              </button>
              <button
                type="button"
                onClick={openScheduleForm}
                className="inline-flex items-center justify-center rounded-xl border border-[#D0DFEE] bg-white px-4 py-2 text-sm font-semibold text-[#365A7B] transition hover:bg-[#F1F7FD]"
              >
                📋 Horaire de garde
              </button>
              <button
                type="button"
                onClick={openForm}
                className="inline-flex items-center justify-center rounded-xl bg-[#4A90D9] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(74,144,217,0.35)] transition hover:brightness-105"
              >
                + Ajouter un événement
              </button>
              <button
                type="button"
                onClick={onExportCalendarPdf}
                className="inline-flex items-center justify-center rounded-xl border border-[#D0DFEE] bg-white px-4 py-2 text-sm font-semibold text-[#365A7B] transition hover:bg-[#F1F7FD]"
              >
                📥 Export PDF du calendrier
              </button>
            </div>
          </div>

          {journalOpen && (
            <div className="mb-4 rounded-2xl border border-[#D7E6F4] bg-[#F8FBFF] p-4">
              <p className="text-xs font-semibold tracking-[0.18em] text-[#5F81A3]">JOURNAL DE GARDE</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[#D7E6F4] bg-white p-3 text-sm text-[#2D4B68]">
                  <p className="font-semibold text-[#17324D]">{formatMonthLabel(calendarDate)}</p>
                  <p className="mt-1">Parent 1 : <span className="font-semibold">{monthCounts.parent1} jours</span></p>
                  <p>Parent 2 : <span className="font-semibold">{monthCounts.parent2} jours</span></p>
                </div>
                <div className="rounded-xl border border-[#D7E6F4] bg-white p-3 text-sm text-[#2D4B68]">
                  <p className="font-semibold text-[#17324D]">Année {calendarDate.getFullYear()}</p>
                  <p className="mt-1">Parent 1 : <span className="font-semibold">{yearCounts.parent1} jours</span></p>
                  <p>Parent 2 : <span className="font-semibold">{yearCounts.parent2} jours</span></p>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-[#D7E6F4] bg-white p-3">
                <p className="text-xs font-semibold tracking-[0.16em] text-[#5F81A3]">GRAPHIQUE SIMPLE</p>
                <div className="mt-2 space-y-2 text-sm">
                  <div>
                    <p className="mb-1 font-medium text-[#2D4B68]">Parent 1 ({monthCounts.parent1})</p>
                    <div className="h-3 rounded-full bg-[#E8F2FC]">
                      <div className="h-3 rounded-full bg-[#4A90D9]" style={{ width: `${(monthCounts.parent1 / maxMonthCount) * 100}%` }} />
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 font-medium text-[#2D4B68]">Parent 2 ({monthCounts.parent2})</p>
                    <div className="h-3 rounded-full bg-[#E9F8EE]">
                      <div className="h-3 rounded-full bg-[#50C878]" style={{ width: `${(monthCounts.parent2 / maxMonthCount) * 100}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-[#D7E6F4] bg-white p-3">
                <p className="text-xs font-semibold tracking-[0.16em] text-[#5F81A3]">LISTE DES JOURS DE GARDE DU MOIS</p>
                <div className="mt-2 space-y-2 text-sm text-[#2D4B68]">
                  {journalMonthEntries.length === 0 ? (
                    <p>Aucune garde ce mois-ci.</p>
                  ) : (
                    journalMonthEntries
                      .sort((a, b) => a.gardeDate.localeCompare(b.gardeDate))
                      .map((entry) => (
                        <article
                          key={entry.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#E0EBF6] bg-[#FAFCFF] px-3 py-2"
                        >
                          <p>
                            {formatDateLabel(entry.gardeDate)} · {entry.parentRole === "parent1" ? "Parent 1" : "Parent 2"}
                            {entry.title ? ` · ${entry.title}` : ""}
                          </p>
                          <button
                            type="button"
                            onClick={() => openJournalEditForm(entry)}
                            className="rounded-lg border border-[#D0DFEE] bg-white px-3 py-1.5 text-xs font-semibold text-[#365A7B] transition hover:bg-[#F1F7FD]"
                          >
                            ✏️ Modifier
                          </button>
                        </article>
                      ))
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="mb-4 flex items-center justify-between gap-2 rounded-2xl border border-[#CFE1F2] bg-[#F4F9FF] px-3 py-3 sm:px-4">
            <button
              type="button"
              onClick={() => setCalendarDate((current) => shiftMonth(current, -1))}
              className="rounded-xl border border-[#D0DFEE] bg-white px-3 py-2 text-sm font-semibold text-[#365A7B] transition hover:bg-[#F1F7FD]"
            >
              ←
            </button>

            <p className="text-center text-base font-semibold text-[#1F4D77] sm:text-lg">
              {formatMonthLabel(shiftMonth(calendarDate, -1))} | {formatMonthLabel(calendarDate)} | {formatMonthLabel(shiftMonth(calendarDate, 1))}
            </p>

            <button
              type="button"
              onClick={() => setCalendarDate((current) => shiftMonth(current, 1))}
              className="rounded-xl border border-[#D0DFEE] bg-white px-3 py-2 text-sm font-semibold text-[#365A7B] transition hover:bg-[#F1F7FD]"
            >
              →
            </button>
          </div>

          {formError && (
            <p className="mb-4 rounded-xl border border-[#E3B4B8] bg-[#FFF4F5] px-4 py-3 text-sm text-[#8D3E45]">{formError}</p>
          )}

          <p className="mb-3 text-sm font-medium text-[#5B7691]">Clique sur un événement pour le modifier ou le supprimer.</p>

          <div className="overflow-hidden rounded-2xl border border-[#D7E6F4] bg-white p-2 sm:p-4">
            <Calendar
              localizer={localizer}
              events={calendarDisplayEvents}
              startAccessor="start"
              endAccessor="end"
              allDayAccessor="allDay"
              date={calendarDate}
              onNavigate={(date) => setCalendarDate(date)}
              defaultView={Views.MONTH}
              views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
              toolbar={false}
              style={{ height: 640 }}
              titleAccessor={(event: CalendarDisplayEvent) =>
                event.kind === "special"
                  ? `${specialTypeConfig[event.specialType].emoji} ${event.title}`
                  : `${event.title} · ${event.type}`
              }
              onSelectEvent={(event: CalendarDisplayEvent) => {
                if (event.kind === "special") {
                  return;
                }
                openEditForm(event);
              }}
              eventPropGetter={(event) => {
                if (event.kind === "special") {
                  const cfg = specialTypeConfig[event.specialType];
                  return {
                    style: {
                      backgroundColor: cfg.color,
                      borderRadius: "10px",
                      border: "none",
                      color: "#ffffff",
                      padding: "2px 6px",
                      fontWeight: 600,
                    },
                  };
                }
                const isParentOne = event.parent
                  ? normalizeParentRole(event.parent) === "parent1"
                  : event.ownerUserId === user?.id;
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
          </div>
        </section>

        <section className="rounded-2xl border border-[#D7E6F4] bg-white p-4 shadow-[0_10px_28px_rgba(74,144,217,0.08)] sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-[#17324D]">DEMANDES DE CHANGEMENT</h2>
            <button
              type="button"
              onClick={openSwapForm}
              className="inline-flex items-center justify-center rounded-xl bg-[#4A90D9] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(74,144,217,0.35)] transition hover:brightness-105"
            >
              Demander un changement de garde
            </button>
          </div>

          {swapError && (
            <p className="mb-4 rounded-xl border border-[#E3B4B8] bg-[#FFF4F5] px-4 py-3 text-sm text-[#8D3E45]">{swapError}</p>
          )}

          <div className="space-y-3">
            {swapRequests.length === 0 ? (
              <p className="rounded-xl border border-[#D7E6F4] bg-[#F8FBFF] px-4 py-3 text-sm text-[#4A6783]">
                Aucune demande pour le moment.
              </p>
            ) : (
              swapRequests.map((request) => {
                const isMine = request.requesterUserId === user?.id;
                const canModerate = !isMine && request.status === "pending";
                const statusInfo = statusUi[request.status];

                return (
                  <article key={request.id} className="rounded-xl border border-[#D7E6F4] bg-[#FAFCFF] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[#17324D]">
                          {formatDateLabel(request.originalDate)} → {formatDateLabel(request.proposedDate)}
                        </p>
                        <p className="mt-1 text-sm text-[#4A6783]">{request.reason || "Aucune raison précisée."}</p>
                        <p className="mt-1 text-xs text-[#6B86A1]">
                          {isMine ? "Demande envoyée par vous" : "Demande du co-parent"}
                          {request.createdAt ? ` · ${new Date(request.createdAt).toLocaleString("fr-CA")}` : ""}
                        </p>
                        {request.responseReason && (
                          <p className="mt-1 text-xs text-[#8D3E45]">Raison du refus: {request.responseReason}</p>
                        )}
                      </div>

                      <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${statusInfo.className}`}>
                        <span>{statusInfo.emoji}</span>
                        <span>{statusInfo.label}</span>
                      </span>
                    </div>

                    {canModerate && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openDecisionModal(request, "accept")}
                          className="rounded-xl bg-[#50C878] px-3 py-2 text-sm font-semibold text-white transition hover:brightness-105"
                        >
                          Accepter
                        </button>
                        <button
                          type="button"
                          onClick={() => openDecisionModal(request, "refuse")}
                          className="rounded-xl border border-[#E3B4B8] bg-[#FFF4F5] px-3 py-2 text-sm font-semibold text-[#8D3E45] transition hover:bg-[#FFECEF]"
                        >
                          Refuser + raison
                        </button>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </section>
      </main>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0F223680] p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/70 bg-white p-6 shadow-[0_20px_60px_rgba(15,36,54,0.22)]">
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

      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0F223680] p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/70 bg-white p-6 shadow-[0_20px_60px_rgba(15,36,54,0.22)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[#17324D]">Modifier l'événement</h2>
              <button
                type="button"
                onClick={closeEditForm}
                className="rounded-lg border border-[#D0DFEE] px-2 py-1 text-sm text-[#365A7B] hover:bg-[#F1F7FD]"
              >
                ✕
              </button>
            </div>

            {editError && (
              <p className="mb-4 rounded-xl border border-[#E3B4B8] bg-[#FFF4F5] px-3 py-2 text-sm text-[#8D3E45]">
                {editError}
              </p>
            )}

            <form className="space-y-4" onSubmit={onUpdateEvent}>
              <div>
                <label htmlFor="editTitle" className="mb-1 block text-sm font-medium text-[#2D4B68]">
                  Titre de l'événement
                </label>
                <input
                  id="editTitle"
                  type="text"
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                  className="w-full rounded-xl border border-[#D8E4F0] px-3 py-2.5 text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
                />
              </div>

              <div>
                <label htmlFor="editType" className="mb-1 block text-sm font-medium text-[#2D4B68]">
                  Type
                </label>
                <select
                  id="editType"
                  value={editEventType}
                  onChange={(event) => setEditEventType(event.target.value as EventType)}
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
                <label htmlFor="editStartAt" className="mb-1 block text-sm font-medium text-[#2D4B68]">
                  Date début
                </label>
                <input
                  id="editStartAt"
                  type="datetime-local"
                  value={editStartAt}
                  onChange={(event) => setEditStartAt(event.target.value)}
                  className="w-full rounded-xl border border-[#D8E4F0] px-3 py-2.5 text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
                />
              </div>

              <div>
                <label htmlFor="editEndAt" className="mb-1 block text-sm font-medium text-[#2D4B68]">
                  Date fin
                </label>
                <input
                  id="editEndAt"
                  type="datetime-local"
                  value={editEndAt}
                  onChange={(event) => setEditEndAt(event.target.value)}
                  className="w-full rounded-xl border border-[#D8E4F0] px-3 py-2.5 text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
                />
              </div>

              <div className="mt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={isUpdating || isDeleting}
                  className="flex-1 rounded-xl bg-[#4A90D9] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(74,144,217,0.35)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isUpdating ? "Mise à jour..." : "Enregistrer"}
                </button>
                <button
                  type="button"
                  onClick={onDeleteEvent}
                  disabled={isUpdating || isDeleting}
                  className="flex-1 rounded-xl border border-[#E3B4B8] bg-[#FFF4F5] px-4 py-3 text-sm font-semibold text-[#8D3E45] transition hover:bg-[#FFECEF] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isDeleting ? "Suppression..." : "Supprimer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {swapFormOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0F223680] p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/70 bg-white p-6 shadow-[0_20px_60px_rgba(15,36,54,0.22)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[#17324D]">Nouvelle demande de garde</h2>
              <button
                type="button"
                onClick={closeSwapForm}
                className="rounded-lg border border-[#D0DFEE] px-2 py-1 text-sm text-[#365A7B] hover:bg-[#F1F7FD]"
              >
                ✕
              </button>
            </div>

            {swapError && (
              <p className="mb-4 rounded-xl border border-[#E3B4B8] bg-[#FFF4F5] px-3 py-2 text-sm text-[#8D3E45]">
                {swapError}
              </p>
            )}

            <form className="space-y-4" onSubmit={onCreateSwapRequest}>
              <div>
                <label htmlFor="originalDate" className="mb-1 block text-sm font-medium text-[#2D4B68]">
                  Date originale
                </label>
                <input
                  id="originalDate"
                  type="date"
                  value={originalDate}
                  onChange={(event) => setOriginalDate(event.target.value)}
                  className="w-full rounded-xl border border-[#D8E4F0] px-3 py-2.5 text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
                />
              </div>

              <div>
                <label htmlFor="proposedDate" className="mb-1 block text-sm font-medium text-[#2D4B68]">
                  Date proposée
                </label>
                <input
                  id="proposedDate"
                  type="date"
                  value={proposedDate}
                  onChange={(event) => setProposedDate(event.target.value)}
                  className="w-full rounded-xl border border-[#D8E4F0] px-3 py-2.5 text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
                />
              </div>

              <div>
                <label htmlFor="swapReason" className="mb-1 block text-sm font-medium text-[#2D4B68]">
                  Raison
                </label>
                <textarea
                  id="swapReason"
                  value={swapReason}
                  onChange={(event) => setSwapReason(event.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-[#D8E4F0] px-3 py-2.5 text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
                  placeholder="Expliquez brièvement la demande..."
                />
              </div>

              <button
                type="submit"
                disabled={isCreatingSwapRequest}
                className="mt-2 w-full rounded-xl bg-[#4A90D9] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(74,144,217,0.35)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isCreatingSwapRequest ? "Envoi..." : "Envoyer la demande"}
              </button>
            </form>
          </div>
        </div>
      )}

      {journalEditOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0F223680] p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/70 bg-white p-6 shadow-[0_20px_60px_rgba(15,36,54,0.22)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[#17324D]">Modifier une entrée du journal</h2>
              <button
                type="button"
                onClick={closeJournalEditForm}
                className="rounded-lg border border-[#D0DFEE] px-2 py-1 text-sm text-[#365A7B] hover:bg-[#F1F7FD]"
              >
                ✕
              </button>
            </div>

            {journalEditError && (
              <p className="mb-4 rounded-xl border border-[#E3B4B8] bg-[#FFF4F5] px-3 py-2 text-sm text-[#8D3E45]">
                {journalEditError}
              </p>
            )}

            <form className="space-y-4" onSubmit={onSaveJournalEntry}>
              <div>
                <label htmlFor="journalEditStartDate" className="mb-1 block text-sm font-medium text-[#2D4B68]">
                  Date début
                </label>
                <input
                  id="journalEditStartDate"
                  type="date"
                  value={editingJournalStartDate}
                  onChange={(event) => setEditingJournalStartDate(event.target.value)}
                  className="w-full rounded-xl border border-[#D8E4F0] px-3 py-2.5 text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
                />
              </div>

              <div>
                <label htmlFor="journalEditEndDate" className="mb-1 block text-sm font-medium text-[#2D4B68]">
                  Date fin
                </label>
                <input
                  id="journalEditEndDate"
                  type="date"
                  value={editingJournalEndDate}
                  onChange={(event) => setEditingJournalEndDate(event.target.value)}
                  className="w-full rounded-xl border border-[#D8E4F0] px-3 py-2.5 text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
                />
              </div>

              <div>
                <label htmlFor="journalEditParentRole" className="mb-1 block text-sm font-medium text-[#2D4B68]">
                  Parent responsable
                </label>
                <select
                  id="journalEditParentRole"
                  value={editingJournalParentRole}
                  onChange={(event) => setEditingJournalParentRole(event.target.value as ParentRole)}
                  className="w-full rounded-xl border border-[#D8E4F0] px-3 py-2.5 text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
                >
                  <option value="parent1">Parent 1</option>
                  <option value="parent2">Parent 2</option>
                </select>
              </div>

              <div>
                <label htmlFor="journalEditNotes" className="mb-1 block text-sm font-medium text-[#2D4B68]">
                  Notes
                </label>
                <textarea
                  id="journalEditNotes"
                  value={editingJournalNotes}
                  onChange={(event) => setEditingJournalNotes(event.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-[#D8E4F0] px-3 py-2.5 text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
                  placeholder="Notes sur la garde"
                />
              </div>

              <div className="mt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={isSavingJournalEdit || isDeletingJournalEntry}
                  className="flex-1 rounded-xl bg-[#4A90D9] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(74,144,217,0.35)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSavingJournalEdit ? "Sauvegarde..." : "💾 Sauvegarder"}
                </button>
                <button
                  type="button"
                  onClick={onDeleteJournalEntry}
                  disabled={isSavingJournalEdit || isDeletingJournalEntry}
                  className="flex-1 rounded-xl border border-[#E3B4B8] bg-[#FFF4F5] px-4 py-3 text-sm font-semibold text-[#8D3E45] transition hover:bg-[#FFECEF] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isDeletingJournalEntry ? "Suppression..." : "🗑️ Supprimer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {scheduleFormOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0F223680] p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/70 bg-white p-6 shadow-[0_20px_60px_rgba(15,36,54,0.22)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[#17324D]">📋 Horaire de garde</h2>
              <button
                type="button"
                onClick={closeScheduleForm}
                className="rounded-lg border border-[#D0DFEE] px-2 py-1 text-sm text-[#365A7B] hover:bg-[#F1F7FD]"
              >
                ✕
              </button>
            </div>

            {scheduleError && (
              <p className="mb-4 rounded-xl border border-[#E3B4B8] bg-[#FFF4F5] px-3 py-2 text-sm text-[#8D3E45]">
                {scheduleError}
              </p>
            )}

            <form className="space-y-5" onSubmit={onApplyGuardSchedule}>
              <section className="rounded-xl border border-[#D7E6F4] bg-[#F8FBFF] p-4">
                <p className="text-xs font-semibold tracking-[0.16em] text-[#5F81A3]">CONFIGURATION DE L'HORAIRE</p>
                <div className="mt-3">
                  <label htmlFor="scheduleType" className="mb-1 block text-sm font-medium text-[#2D4B68]">
                    Type d'horaire
                  </label>
                  <select
                    id="scheduleType"
                    value={scheduleType}
                    onChange={(event) => setScheduleType(event.target.value as GuardScheduleType)}
                    className="w-full rounded-xl border border-[#D8E4F0] bg-white px-3 py-2.5 text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
                  >
                    <option value="weekly_alternating">Semaine alternée (7 jours / 7 jours)</option>
                    <option value="biweekly_alternating">2 semaines / 2 semaines</option>
                    <option value="custom_shared">Garde partagée personnalisée</option>
                  </select>
                </div>

                {scheduleType === "custom_shared" && (
                  <div className="mt-3 space-y-2">
                    {WEEKDAY_OPTIONS.map((day) => (
                      <div
                        key={day.label}
                        className="grid grid-cols-1 items-center gap-2 rounded-lg border border-[#E0EBF6] bg-white p-2 sm:grid-cols-[1fr_140px]"
                      >
                        <label className="flex items-center gap-2 text-sm text-[#2D4B68]">
                          <input
                            type="checkbox"
                            checked={customSchedule[day.jsDay]?.enabled ?? false}
                            onChange={(event) =>
                              setCustomSchedule((current) => ({
                                ...current,
                                [day.jsDay]: {
                                  ...(current[day.jsDay] ?? { enabled: true, parentRole: "parent1" }),
                                  enabled: event.target.checked,
                                },
                              }))
                            }
                            className="h-4 w-4 rounded border-[#C6D9EC] text-[#4A90D9] focus:ring-[#4A90D9]/30"
                          />
                          {day.label}
                        </label>
                        <select
                          value={customSchedule[day.jsDay]?.parentRole ?? "parent1"}
                          onChange={(event) =>
                            setCustomSchedule((current) => ({
                              ...current,
                              [day.jsDay]: {
                                ...(current[day.jsDay] ?? { enabled: true, parentRole: "parent1" }),
                                parentRole: event.target.value as ParentRole,
                              },
                            }))
                          }
                          className="w-full rounded-lg border border-[#D8E4F0] bg-white px-2 py-2 text-sm text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-2 focus:ring-[#4A90D9]/20"
                        >
                          <option value="parent1">Parent 1</option>
                          <option value="parent2">Parent 2</option>
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-[#D7E6F4] bg-[#F8FBFF] p-4">
                <p className="text-xs font-semibold tracking-[0.16em] text-[#5F81A3]">DÉTAILS DE L'ÉCHANGE</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="exchangeTime" className="mb-1 block text-sm font-medium text-[#2D4B68]">
                      Heure de l'échange
                    </label>
                    <input
                      id="exchangeTime"
                      type="time"
                      value={exchangeTime}
                      onChange={(event) => setExchangeTime(event.target.value)}
                      className="w-full rounded-xl border border-[#D8E4F0] bg-white px-3 py-2.5 text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
                    />
                  </div>
                  <div>
                    <label htmlFor="exchangeLocation" className="mb-1 block text-sm font-medium text-[#2D4B68]">
                      Lieu de l'échange
                    </label>
                    <input
                      id="exchangeLocation"
                      type="text"
                      value={exchangeLocation}
                      onChange={(event) => setExchangeLocation(event.target.value)}
                      placeholder="Ex: école, domicile"
                      className="w-full rounded-xl border border-[#D8E4F0] bg-white px-3 py-2.5 text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-[#D7E6F4] bg-[#F8FBFF] p-4">
                <p className="text-xs font-semibold tracking-[0.16em] text-[#5F81A3]">INFORMATIONS LÉGALES</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="legalContactName" className="mb-1 block text-sm font-medium text-[#2D4B68]">
                      Nom du médiateur ou avocat
                    </label>
                    <input
                      id="legalContactName"
                      type="text"
                      value={legalContactName}
                      onChange={(event) => setLegalContactName(event.target.value)}
                      className="w-full rounded-xl border border-[#D8E4F0] bg-white px-3 py-2.5 text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
                    />
                  </div>
                  <div>
                    <label htmlFor="legalCaseNumber" className="mb-1 block text-sm font-medium text-[#2D4B68]">
                      Numéro de dossier (optionnel)
                    </label>
                    <input
                      id="legalCaseNumber"
                      type="text"
                      value={legalCaseNumber}
                      onChange={(event) => setLegalCaseNumber(event.target.value)}
                      className="w-full rounded-xl border border-[#D8E4F0] bg-white px-3 py-2.5 text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="agreementDate" className="mb-1 block text-sm font-medium text-[#2D4B68]">
                      Date de l'entente
                    </label>
                    <input
                      id="agreementDate"
                      type="date"
                      value={agreementDate}
                      onChange={(event) => setAgreementDate(event.target.value)}
                      className="w-full rounded-xl border border-[#D8E4F0] bg-white px-3 py-2.5 text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="mediatorNotes" className="mb-1 block text-sm font-medium text-[#2D4B68]">
                      Notes du médiateur
                    </label>
                    <textarea
                      id="mediatorNotes"
                      value={mediatorNotes}
                      onChange={(event) => setMediatorNotes(event.target.value)}
                      rows={4}
                      className="w-full rounded-xl border border-[#D8E4F0] bg-white px-3 py-2.5 text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
                    />
                  </div>
                </div>
              </section>

              <button
                type="submit"
                disabled={isApplyingSchedule}
                className="w-full rounded-xl bg-[#4A90D9] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(74,144,217,0.35)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isApplyingSchedule ? "Application..." : "🔄 Appliquer au calendrier"}
              </button>
            </form>
          </div>
        </div>
      )}

      {specialDayFormOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0F223680] p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/70 bg-white p-6 shadow-[0_20px_60px_rgba(15,36,54,0.22)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[#17324D]">Ajouter un jour spécial</h2>
              <button
                type="button"
                onClick={() => setSpecialDayFormOpen(false)}
                className="rounded-lg border border-[#D0DFEE] px-2 py-1 text-sm text-[#365A7B] hover:bg-[#F1F7FD]"
              >
                ✕
              </button>
            </div>

            {specialDayError && (
              <p className="mb-4 rounded-xl border border-[#E3B4B8] bg-[#FFF4F5] px-3 py-2 text-sm text-[#8D3E45]">{specialDayError}</p>
            )}

            <form className="space-y-4" onSubmit={onCreateSpecialDay}>
              <div>
                <label htmlFor="specialDayTitle" className="mb-1 block text-sm font-medium text-[#2D4B68]">Titre</label>
                <input
                  id="specialDayTitle"
                  type="text"
                  value={specialDayTitle}
                  onChange={(event) => setSpecialDayTitle(event.target.value)}
                  className="w-full rounded-xl border border-[#D8E4F0] px-3 py-2.5 text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
                  placeholder="Ex: Congé pédagogique"
                />
              </div>

              <div>
                <label htmlFor="specialDayDate" className="mb-1 block text-sm font-medium text-[#2D4B68]">Date</label>
                <input
                  id="specialDayDate"
                  type="date"
                  value={specialDayDate}
                  onChange={(event) => setSpecialDayDate(event.target.value)}
                  className="w-full rounded-xl border border-[#D8E4F0] px-3 py-2.5 text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
                />
              </div>

              <div>
                <label htmlFor="specialDayType" className="mb-1 block text-sm font-medium text-[#2D4B68]">Type</label>
                <select
                  id="specialDayType"
                  value={specialDayType}
                  onChange={(event) => setSpecialDayType(event.target.value as SpecialDayType)}
                  className="w-full rounded-xl border border-[#D8E4F0] px-3 py-2.5 text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
                >
                  {SPECIAL_DAY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.emoji} {option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="specialDayNotes" className="mb-1 block text-sm font-medium text-[#2D4B68]">Notes (optionnel)</label>
                <textarea
                  id="specialDayNotes"
                  value={specialDayNotes}
                  onChange={(event) => setSpecialDayNotes(event.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-[#D8E4F0] px-3 py-2.5 text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
                />
              </div>

              <button
                type="submit"
                disabled={isCreatingSpecialDay}
                className="w-full rounded-xl bg-[#4A90D9] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(74,144,217,0.35)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isCreatingSpecialDay ? "Enregistrement..." : "Enregistrer le jour spécial"}
              </button>
            </form>
          </div>
        </div>
      )}

      {decisionOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0F223680] p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/70 bg-white p-6 shadow-[0_20px_60px_rgba(15,36,54,0.22)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[#17324D]">
                {decisionType === "accept" ? "Accepter la demande" : "Refuser la demande"}
              </h2>
              <button
                type="button"
                onClick={closeDecisionModal}
                className="rounded-lg border border-[#D0DFEE] px-2 py-1 text-sm text-[#365A7B] hover:bg-[#F1F7FD]"
              >
                ✕
              </button>
            </div>

            {decisionError && (
              <p className="mb-4 rounded-xl border border-[#E3B4B8] bg-[#FFF4F5] px-3 py-2 text-sm text-[#8D3E45]">
                {decisionError}
              </p>
            )}

            <form className="space-y-4" onSubmit={onSubmitDecision}>
              {decisionType === "refuse" && (
                <div>
                  <label htmlFor="decisionReason" className="mb-1 block text-sm font-medium text-[#2D4B68]">
                    Raison du refus
                  </label>
                  <textarea
                    id="decisionReason"
                    value={decisionReason}
                    onChange={(event) => setDecisionReason(event.target.value)}
                    rows={4}
                    className="w-full rounded-xl border border-[#D8E4F0] px-3 py-2.5 text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
                    placeholder="Expliquez la raison du refus..."
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmittingDecision}
                className="w-full rounded-xl bg-[#4A90D9] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(74,144,217,0.35)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmittingDecision
                  ? "Enregistrement..."
                  : decisionType === "accept"
                    ? "Confirmer l'acceptation"
                    : "Confirmer le refus"}
              </button>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed right-4 bottom-4 z-[60] max-w-sm rounded-xl border border-[#BDDCC5] bg-[#F2FAF4] px-4 py-3 text-sm font-medium text-[#2D6940] shadow-[0_14px_30px_rgba(45,105,64,0.2)]">
          {toast.message}
        </div>
      )}
    </div>
  );
}
