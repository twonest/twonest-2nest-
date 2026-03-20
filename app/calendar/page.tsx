"use client";

import Link from "next/link";
import jsPDF from "jspdf";
import moment from "moment";
import "moment/locale/fr";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
 ArrowLeft,
 ArrowLeftRight,
 BookOpen,
 Briefcase,
 Calendar as CalendarIcon,
 CheckCircle,
 ChevronLeft,
 ChevronRight,
 Clock,
 Download,
 Eye,
 GraduationCap,
 Leaf,
 Loader,
 Pencil,
 PlusCircle,
 RefreshCcw,
 RefreshCw,
 School,
 ShoppingCart,
 Stethoscope,
 Trash2,
 Trophy,
 UserCheck,
 X,
 XCircle,
 type LucideIcon,
} from "lucide-react";
import { Calendar, momentLocalizer, Views } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import type { User } from "@supabase/supabase-js";
import {
 createEvent,
 createSpecialDaysBulk,
 createSwapRequest,
 deleteEvent,
 fetchEvents,
 fetchProfileRole,
 fetchSpecialDays,
 fetchSwapRequests,
 updateEvent,
 updateSwapRequestDecision,
 type EventRow,
 type SpecialDayRow,
 type SwapRequestRow,
} from "@/lib/calendarApi";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import AccessDeniedCard from "@/components/AccessDeniedCard";
import { useFamily } from "@/components/FamilyProvider";
import { getFeatureAccess } from "@/lib/family";

type EventType =
 | "Garde"
 | "Médecin"
 | "École"
 | "Activité"
 | "Épicerie"
 | "Ordures"
 | "Recyclage"
 | "Compost"
 | "Shift travail"
 | "Changement shift"
 | "Autre"
 | "Poubelles/Recyclage"
 | "Planification des repas"
 | "Entretien maison"
 | "Formulaire à signer";
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
 childId: string | null;
 childName: string | null;
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

type CalendarTaskEventStatus = "done" | "pending" | "late";

type CalendarTaskEvent = {
 id: string;
 title: string;
 start: Date;
 end: Date;
 allDay: true;
 kind: "task";
 taskStatus: CalendarTaskEventStatus;
 taskTitle: string;
 dueDateIso: string;
};

type CalendarCollecteEvent = {
 id: string;
 title: string;
 start: Date;
 end: Date;
 allDay: true;
 kind: "collecte";
 collecteKind: "garbage" | "recycling" | "compost";
};

type WorkShiftType = "jour" | "soir" | "nuit" | "personnalise";
type WorkShiftFrequency = "weekly" | "biweekly" | "custom";
type WorkShiftScheduleMode = "once" | "weekly" | "cycle";
type WorkShiftRecurrence = "once" | "recurring";

type WorkShiftRow = {
 id?: string | number;
 family_id?: string;
 user_id?: string;
 title?: string;
 shift_type?: WorkShiftType;
 start_at?: string;
 end_at?: string;
 location?: string | null;
 color?: string | null;
 recurrence_mode?: WorkShiftRecurrence;
 recurrence_days?: number[] | null;
 recurrence_start?: string | null;
 recurrence_end?: string | null;
 frequency?: WorkShiftFrequency;
 is_override?: boolean | null;
 base_shift_id?: string | null;
 reason?: string | null;
 notify_coparent?: boolean | null;
 cycle_length_days?: number | null;
 created_at?: string;
 updated_at?: string;
};

type CalendarWorkShiftEvent = {
 id: string;
 title: string;
 start: Date;
 end: Date;
 allDay?: boolean;
 kind: "shift";
 shiftType: WorkShiftType;
 userId: string;
 userLabel: string;
 location: string | null;
 color: string;
 isOverride: boolean;
 reason: string | null;
 notifyCoparent: boolean;
 sourceShiftId: string;
 recurrenceMode: WorkShiftRecurrence;
 frequency: WorkShiftFrequency | null;
 recurrenceDays: number[];
 recurrenceStart: string | null;
 recurrenceEnd: string | null;
 cycleLengthDays: number | null;
};

type CalendarDisplayEvent =
 | CalendarEvent
 | CalendarSpecialDayEvent
 | CalendarTaskEvent
 | CalendarCollecteEvent
 | CalendarWorkShiftEvent;

type TaskCalendarItem = {
 id: string;
 title: string;
 dueDate: string;
 category: string;
 completedAt: string | null;
 status: "todo" | "in_progress" | "done";
};

type CollecteConfig = {
 familyId: string;
 garbageDay: number | null;
 recyclingDay: number | null;
 compostDay: number | null;
 reminderTime: string;
 assignmentMode: "parent1" | "parent2" | "alternate";
 garbageCycle: "weekly" | "A" | "B";
 recyclingCycle: "weekly" | "A" | "B";
 compostCycle: "weekly" | "A" | "B";
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

type SwapStatus = "en_attente" | "acceptee" | "refusee";

type SwapRequest = {
 id: string;
 requesterUserId: string | null;
 requestDate: string;
 originalDate: string;
 proposedDate: string;
 reason: string;
 status: SwapStatus;
 createdAt: string | null;
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

type ImportedSchoolDate = {
 id: string;
 date: string;
 description: string;
 type: SpecialDayType;
};

type DecisionType = "accept" | "refuse";
type GuardScheduleType = "weekly_alternating" | "biweekly_alternating" | "custom_shared";
type CustomDayRule = { enabled: boolean; parentRole: ParentRole };
type CustomScheduleMap = Record<number, CustomDayRule>;

const localizer = momentLocalizer(moment);
const EVENT_TYPES: EventType[] = [
 "Garde",
 "Médecin",
 "École",
 "Activité",
 "Ordures",
 "Recyclage",
 "Compost",
 "Shift travail",
 "Changement shift",
 "Épicerie",
 "Autre",
 "Poubelles/Recyclage",
 "Planification des repas",
 "Entretien maison",
 "Formulaire à signer",
];
const WEEKDAY_OPTIONS: Array<{ jsDay: number; label: string }> = [
 { jsDay: 1, label: "Lundi" },
 { jsDay: 2, label: "Mardi" },
 { jsDay: 3, label: "Mercredi" },
 { jsDay: 4, label: "Jeudi" },
 { jsDay: 5, label: "Vendredi" },
 { jsDay: 6, label: "Samedi" },
 { jsDay: 0, label: "Dimanche" },
];

const COLLECTE_STYLE: Record<"garbage" | "recycling" | "compost", { icon: string; label: string; color: string }> = {
 garbage: { icon: "🗑️", label: "Ordures", color: "#6F6F6F" },
 recycling: { icon: "♻️", label: "Recyclage", color: "#3D88CE" },
 compost: { icon: "🌱", label: "Compost", color: "#4C9B5C" },
};

const EVENT_VISUALS: Record<EventType, { icon: LucideIcon; color: string; shortLabel: string }> = {
 Garde: { icon: UserCheck, color: "#4A90D9", shortLabel: "Garde" },
 "Médecin": { icon: Stethoscope, color: "#E74C3C", shortLabel: "Médecin" },
 "École": { icon: GraduationCap, color: "#F39C12", shortLabel: "École" },
 "Activité": { icon: Trophy, color: "#9B59B6", shortLabel: "Activité" },
 Ordures: { icon: Trash2, color: "#7F8C8D", shortLabel: "Ordures" },
 Recyclage: { icon: RefreshCw, color: "#27AE60", shortLabel: "Recyclage" },
 Compost: { icon: Leaf, color: "#8B6914", shortLabel: "Compost" },
 "Shift travail": { icon: Briefcase, color: "#2C3E50", shortLabel: "Shift" },
 "Changement shift": { icon: ArrowLeftRight, color: "#E67E22", shortLabel: "Shift" },
 "Épicerie": { icon: ShoppingCart, color: "#16A085", shortLabel: "Épicerie" },
 Autre: { icon: CalendarIcon, color: "#BDC3C7", shortLabel: "Autre" },
 "Poubelles/Recyclage": { icon: Trash2, color: "#7F8C8D", shortLabel: "Collecte" },
 "Planification des repas": { icon: CalendarIcon, color: "#BDC3C7", shortLabel: "Repas" },
 "Entretien maison": { icon: CalendarIcon, color: "#BDC3C7", shortLabel: "Maison" },
 "Formulaire à signer": { icon: CalendarIcon, color: "#BDC3C7", shortLabel: "Formulaire" },
};

const SHIFT_PRESETS: Record<Exclude<WorkShiftType, "personnalise">, { start: string; end: string; label: string }> = {
 jour: { start: "07:00", end: "15:00", label: "Jour (7h-15h)" },
 soir: { start: "15:00", end: "23:00", label: "Soir (15h-23h)" },
 nuit: { start: "23:00", end: "07:00", label: "Nuit (23h-7h)" },
};
const SHARED_MONTH_KEY = "twonest.selectedMonth";
const SHARED_CHILD_KEY = "twonest.selectedChildId";
const SHARED_CHILD_NAME_KEY = "twonest.selectedChildName";
type SchoolBoardOption = "" | "cssp" | "other";

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

function formatDateTimeLabel(value: Date): string {
 const parsed = new Date(value);
 if (Number.isNaN(parsed.getTime())) {
  return "";
 }

 return parsed.toLocaleString("fr-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
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

function parseIsoDate(value: string | null | undefined): Date | null {
 if (!value) {
  return null;
 }
 const parsed = new Date(value);
 return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function shortEventTitle(value: string, maxLength = 18): string {
 const normalized = value.trim();
 if (normalized.length <= maxLength) {
  return normalized;
 }
 return `${normalized.slice(0, maxLength - 1)}…`;
}

function weekdayJsToIso(weekday: number): number {
 return weekday === 0 ? 7 : weekday;
}

function isWorkShiftSchemaMissing(message: string): boolean {
 const normalized = message.toLowerCase();
 const missingObject = normalized.includes("does not exist") || normalized.includes("could not find");
 return missingObject && normalized.includes("work_shifts");
}

function dateRangesOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
 return startA < endB && endA > startB;
}

function applyTimeFromTemplate(targetDate: Date, template: Date): Date {
 const next = new Date(targetDate);
 next.setHours(template.getHours(), template.getMinutes(), 0, 0);
 return next;
}

function hexToRgba(hex: string, alpha: number): string {
 const normalized = hex.replace("#", "");
 if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
  return `rgba(44, 36, 32, ${alpha})`;
 }

 const red = Number.parseInt(normalized.slice(0, 2), 16);
 const green = Number.parseInt(normalized.slice(2, 4), 16);
 const blue = Number.parseInt(normalized.slice(4, 6), 16);
 return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
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

function isJournalMissingColumnError(message: string, column: string): boolean {
 const normalized = message.toLowerCase();
 const missingColumnHint =
  normalized.includes("column") && normalized.includes("does not exist")
   ? true
   : normalized.includes("could not find") && normalized.includes("schema cache");

 return normalized.includes("journal_garde") && normalized.includes(column.toLowerCase()) && missingColumnHint;
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
 const { activeFamilyId, currentRole: familyRole, currentPermissions } = useFamily();
 const [user, setUser] = useState<User | null>(null);
 const [checkingSession, setCheckingSession] = useState(true);
 const [configError, setConfigError] = useState("");

 const [events, setEvents] = useState<CalendarEvent[]>([]);
 const [tasks, setTasks] = useState<TaskCalendarItem[]>([]);
 const [collectesConfig, setCollectesConfig] = useState<CollecteConfig | null>(null);
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
 const [journalEditOpen, setJournalEditOpen] = useState(false);
 const [scheduleFormOpen, setScheduleFormOpen] = useState(false);
 const [collectesFormOpen, setCollectesFormOpen] = useState(false);

 const [formError, setFormError] = useState("");
 const [editError, setEditError] = useState("");
 const [swapError, setSwapError] = useState("");
 const [decisionError, setDecisionError] = useState("");
 const [journalEditError, setJournalEditError] = useState("");
 const [scheduleError, setScheduleError] = useState("");
 const [collectesError, setCollectesError] = useState("");
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

 const [requestDate, setRequestDate] = useState(() => formatForDateInput(new Date()));
 const [originalDate, setOriginalDate] = useState(() => formatForDateInput(new Date()));
 const [proposedDate, setProposedDate] = useState(() => formatForDateInput(new Date(Date.now() + 24 * 60 * 60 * 1000)));
 const [swapReason, setSwapReason] = useState("");

 const [decisionType, setDecisionType] = useState<DecisionType>("accept");
 const [decisionRequestId, setDecisionRequestId] = useState("");
 const [decisionReason, setDecisionReason] = useState("");
 const [calendarDate, setCalendarDate] = useState(() => new Date());
 const [profileRole, setProfileRole] = useState<ParentRole>("parent1");
 const [selectedChildFilterId, setSelectedChildFilterId] = useState("all");
 const [selectedChildFilterName, setSelectedChildFilterName] = useState("");

 const [schoolImportOpen, setSchoolImportOpen] = useState(false);
 const [schoolImportError, setSchoolImportError] = useState("");
 const [selectedSchoolBoard, setSelectedSchoolBoard] = useState<SchoolBoardOption>("");
 const [isLoadingSchoolBoardDates, setIsLoadingSchoolBoardDates] = useState(false);
 const [csspAlreadyImported, setCsspAlreadyImported] = useState(false);
 const [isImportingSchoolDates, setIsImportingSchoolDates] = useState(false);
 const [detectedSchoolDates, setDetectedSchoolDates] = useState<ImportedSchoolDate[]>([]);
 const [selectedSchoolDateIds, setSelectedSchoolDateIds] = useState<Record<string, boolean>>({});
 const [currentFamilyId, setCurrentFamilyId] = useState<string | null>(null);
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
 const [guardDateMenu, setGuardDateMenu] = useState<{ dateKey: string; eventId: string; x: number; y: number } | null>(null);
 const [collectesGarbageDay, setCollectesGarbageDay] = useState("1");
 const [collectesRecyclingDay, setCollectesRecyclingDay] = useState("3");
 const [collectesCompostDay, setCollectesCompostDay] = useState("5");
 const [collectesReminderTime, setCollectesReminderTime] = useState("20:00");
 const [collectesAssignmentMode, setCollectesAssignmentMode] = useState<"parent1" | "parent2" | "alternate">("alternate");
 const [collectesGarbageCycle, setCollectesGarbageCycle] = useState<"weekly" | "A" | "B">("weekly");
 const [collectesRecyclingCycle, setCollectesRecyclingCycle] = useState<"weekly" | "A" | "B">("weekly");
 const [collectesCompostCycle, setCollectesCompostCycle] = useState<"weekly" | "A" | "B">("weekly");
 const [isSavingCollectes, setIsSavingCollectes] = useState(false);
 const [workShiftRows, setWorkShiftRows] = useState<WorkShiftRow[]>([]);
 const [workShiftNamesByUserId, setWorkShiftNamesByUserId] = useState<Record<string, string>>({});
 const [shiftFormOpen, setShiftFormOpen] = useState(false);
 const [shiftEditMode, setShiftEditMode] = useState<"create" | "edit" | "override">("create");
 const [shiftTargetId, setShiftTargetId] = useState("");
 const [shiftTitle, setShiftTitle] = useState("Shift travail");
 const [shiftType, setShiftType] = useState<WorkShiftType>("jour");
 const [shiftStartAt, setShiftStartAt] = useState(() => formatForDateTimeLocal(new Date()));
 const [shiftEndAt, setShiftEndAt] = useState(() => formatForDateTimeLocal(new Date(Date.now() + 8 * 60 * 60 * 1000)));
 const [shiftLocation, setShiftLocation] = useState("");
 const [shiftColor, setShiftColor] = useState("#2C3E50");
 const [shiftRecurrenceMode, setShiftRecurrenceMode] = useState<WorkShiftRecurrence>("once");
 const [shiftScheduleMode, setShiftScheduleMode] = useState<WorkShiftScheduleMode>("once");
 const [shiftRecurrenceDays, setShiftRecurrenceDays] = useState<Record<number, boolean>>({ 1: false, 2: false, 3: false, 4: false, 5: false, 6: false, 0: false });
 const [shiftRecurrenceStart, setShiftRecurrenceStart] = useState(() => formatForDateInput(new Date()));
 const [shiftRecurrenceEnd, setShiftRecurrenceEnd] = useState("");
 const [shiftFrequency, setShiftFrequency] = useState<WorkShiftFrequency>("weekly");
 const [shiftCycleLengthDays, setShiftCycleLengthDays] = useState("35");
 const [shiftReason, setShiftReason] = useState("");
 const [shiftNotifyCoparent, setShiftNotifyCoparent] = useState(true);
 const [shiftError, setShiftError] = useState("");
 const [isSavingShift, setIsSavingShift] = useState(false);
 const [isDeletingShift, setIsDeletingShift] = useState(false);
 const [activeShiftMenu, setActiveShiftMenu] = useState<CalendarWorkShiftEvent | null>(null);

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
  if (shiftType === "personnalise") {
   return;
  }

  const preset = SHIFT_PRESETS[shiftType];
  if (!preset) {
   return;
  }

  const baseDate = shiftStartAt ? new Date(shiftStartAt) : new Date();
  if (Number.isNaN(baseDate.getTime())) {
   return;
  }

  const [startHour, startMinute] = preset.start.split(":").map(Number);
  const [endHour, endMinute] = preset.end.split(":").map(Number);
  const nextStart = new Date(baseDate);
  nextStart.setHours(startHour, startMinute, 0, 0);
  const nextEnd = new Date(baseDate);
  nextEnd.setHours(endHour, endMinute, 0, 0);
  if (nextEnd <= nextStart) {
   nextEnd.setDate(nextEnd.getDate() + 1);
  }

  setShiftStartAt(formatForDateTimeLocal(nextStart));
  setShiftEndAt(formatForDateTimeLocal(nextEnd));
 }, [shiftType]);

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

 useEffect(() => {
  const selectedId = window.localStorage.getItem(SHARED_CHILD_KEY) ?? "all";
  const selectedName = window.localStorage.getItem(SHARED_CHILD_NAME_KEY) ?? "";
  setSelectedChildFilterId(selectedId);
  setSelectedChildFilterName(selectedName.trim());
 }, [activeFamilyId]);

 const refreshEvents = async (client = getSupabaseBrowserClient(), familyId?: string | null) => {
  if (!familyId) {
   setEvents([]);
   return;
  }

  try {
   const rows = await fetchEvents(client, familyId);

   setFormError("");

   const mapped = rows
   .map((row): CalendarEvent | null => {
    const rowStart = row.start_at;
    const rowEnd = row.end_at;

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
     ownerUserId: row.user_id ?? null,
     parent: row.parent ?? null,
     childId: (row as EventRow & { child_id?: string | null }).child_id ?? null,
     childName: (row as EventRow & { child_name?: string | null; enfant?: string | null }).child_name ?? (row as EventRow & { enfant?: string | null }).enfant ?? null,
    };
   })
   .filter((event): event is CalendarEvent => event !== null);

   setEvents(mapped);
  } catch (error) {
   setFormError(error instanceof Error ? error.message : "Impossible de charger les événements.");
  }
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
    const eventId = row.event_id ? String(row.event_id) : row.id ? `legacy-${String(row.id)}` : "";
    if (!row.id || !gardeDate) {
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

 const refreshSpecialDays = async (client = getSupabaseBrowserClient(), familyId?: string | null) => {
  if (!familyId) {
   setSpecialDays([]);
   return;
  }

  try {
   const rows = await fetchSpecialDays(client, familyId);

   const mapped = (rows as SpecialDayRow[])
   .map((row): SpecialDay | null => {
    const date = row.date;
    const title = row.title;
    if (!row.id || !date || !title) {
     return null;
    }

    return {
     id: String(row.id),
     title,
     date,
     type: normalizeSpecialDayType(row.type),
     notes: row.notes ?? null,
    };
   })
   .filter((item): item is SpecialDay => item !== null);

   setSpecialDays(mapped);
  } catch {
   return;
  }
 };

   const refreshTasks = async (client = getSupabaseBrowserClient(), familyId?: string | null) => {
    if (!familyId) {
    setTasks([]);
    return;
    }

    const response = await client
    .from("tasks")
    .select("id, title, due_date, category, completed_at, status")
    .eq("family_id", familyId)
    .not("due_date", "is", null);

    if (response.error) {
    setTasks([]);
    return;
    }

    const mapped = ((response.data ?? []) as Array<Record<string, unknown>>)
    .map((row): TaskCalendarItem | null => {
     const id = row.id ? String(row.id) : "";
     const titleValue = typeof row.title === "string" ? row.title.trim() : "";
     const dueDateValue = typeof row.due_date === "string" ? row.due_date : "";
     if (!id || !titleValue || !dueDateValue) {
      return null;
     }

     const statusRaw = typeof row.status === "string" ? row.status : "todo";
     const status: "todo" | "in_progress" | "done" =
      statusRaw === "done" || statusRaw === "in_progress" ? statusRaw : "todo";

     return {
      id,
      title: titleValue,
      dueDate: dueDateValue,
      category: typeof row.category === "string" ? row.category : "general",
      completedAt: typeof row.completed_at === "string" ? row.completed_at : null,
      status,
     };
    })
    .filter((item): item is TaskCalendarItem => item !== null);

    setTasks(mapped);
   };

   const refreshCollectes = async (client = getSupabaseBrowserClient(), familyId?: string | null) => {
    if (!familyId) {
    setCollectesConfig(null);
    return;
    }

    const response = await client.from("collectes").select("*").eq("family_id", familyId);

    if (response.error || !response.data || response.data.length === 0) {
    setCollectesConfig(null);
    return;
    }

    const rows = response.data as Array<Record<string, unknown>>;
    const first = rows[0] ?? {};

    const hasLegacyColumns =
    typeof first.garbage_day === "number" || typeof first.recycling_day === "number" || typeof first.compost_day === "number";

    if (hasLegacyColumns) {
    const nextConfig: CollecteConfig = {
     familyId,
     garbageDay: typeof first.garbage_day === "number" ? first.garbage_day : null,
     recyclingDay: typeof first.recycling_day === "number" ? first.recycling_day : null,
     compostDay: typeof first.compost_day === "number" ? first.compost_day : null,
     reminderTime: typeof first.reminder_time === "string" ? first.reminder_time.slice(0, 5) : "20:00",
     assignmentMode:
      first.assignment_mode === "parent1" || first.assignment_mode === "parent2" || first.assignment_mode === "alternate"
       ? first.assignment_mode
       : "alternate",
     garbageCycle:
      first.frequence === "biweekly" && (first.semaines_alternees === "A" || first.semaines_alternees === "B")
       ? first.semaines_alternees
       : "weekly",
     recyclingCycle:
      first.frequence === "biweekly" && (first.semaines_alternees === "A" || first.semaines_alternees === "B")
       ? first.semaines_alternees
       : "weekly",
     compostCycle:
      first.frequence === "biweekly" && (first.semaines_alternees === "A" || first.semaines_alternees === "B")
       ? first.semaines_alternees
       : "weekly",
    };

    setCollectesConfig(nextConfig);
    return;
    }

    const byType = rows.reduce<Record<string, Record<string, unknown>>>((accumulator, row) => {
    const type = typeof row.type === "string" ? row.type.toLowerCase() : "";
    if (type) {
     accumulator[type] = row;
    }
    return accumulator;
    }, {});

    const garbage = byType.ordures;
    const recycling = byType.recyclage;
    const compost = byType.compost;
    const reference = garbage ?? recycling ?? compost ?? {};

    const rowCycle = (row: Record<string, unknown> | undefined): "weekly" | "A" | "B" => {
    if (!row) {
     return "weekly";
    }
    if (row.frequence === "biweekly" && (row.semaines_alternees === "A" || row.semaines_alternees === "B")) {
     return row.semaines_alternees;
    }
    return "weekly";
    };

    const nextConfig: CollecteConfig = {
    familyId,
    garbageDay: typeof garbage?.jour_semaine === "number" ? garbage.jour_semaine : null,
    recyclingDay: typeof recycling?.jour_semaine === "number" ? recycling.jour_semaine : null,
    compostDay: typeof compost?.jour_semaine === "number" ? compost.jour_semaine : null,
    reminderTime: typeof reference.heure_rappel === "string" ? reference.heure_rappel.slice(0, 5) : "20:00",
    assignmentMode:
     reference.assignment_mode === "parent1" || reference.assignment_mode === "parent2" || reference.assignment_mode === "alternate"
      ? reference.assignment_mode
      : "alternate",
    garbageCycle: rowCycle(garbage),
    recyclingCycle: rowCycle(recycling),
    compostCycle: rowCycle(compost),
    };

    setCollectesConfig(nextConfig);
   };

   const refreshWorkShifts = async (client = getSupabaseBrowserClient(), familyId?: string | null) => {
    if (!familyId) {
      setWorkShiftRows([]);
      setWorkShiftNamesByUserId({});
    return;
    }

    const query = await client
    .from("work_shifts")
    .select("id, family_id, user_id, title, shift_type, start_at, end_at, location, color, recurrence_mode, recurrence_days, recurrence_start, recurrence_end, frequency, is_override, base_shift_id, reason, notify_coparent, cycle_length_days")
    .eq("family_id", familyId)
    .order("start_at", { ascending: true });

    let data: WorkShiftRow[] | null = (query.data as WorkShiftRow[] | null) ?? null;
    let error = query.error;

    if (error && error.message.toLowerCase().includes("cycle_length_days")) {
     const fallback = await client
      .from("work_shifts")
      .select("id, family_id, user_id, title, shift_type, start_at, end_at, location, color, recurrence_mode, recurrence_days, recurrence_start, recurrence_end, frequency, is_override, base_shift_id, reason, notify_coparent")
      .eq("family_id", familyId)
      .order("start_at", { ascending: true });
    data = (fallback.data as WorkShiftRow[] | null) ?? null;
     error = fallback.error;
    }

    if (error) {
    if (isWorkShiftSchemaMissing(error.message)) {
     return;
    }
    return;
    }

    const rows = (data ?? []) as WorkShiftRow[];
    const uniqueUserIds = Array.from(new Set(rows.map((row) => (typeof row.user_id === "string" ? row.user_id : "")).filter(Boolean)));

    const namesByUserId: Record<string, string> = {};
    if (uniqueUserIds.length > 0) {
    const profileResponse = await client.from("profiles").select("user_id, first_name, prenom").in("user_id", uniqueUserIds);
    const profileRows = (profileResponse.data ?? []) as Array<Record<string, unknown>>;
    for (const uid of uniqueUserIds) {
     const profile = profileRows.find((item) => item.user_id === uid);
     const firstName =
      typeof profile?.first_name === "string"
       ? profile.first_name.trim()
       : typeof profile?.prenom === "string"
        ? profile.prenom.trim()
        : "";
     namesByUserId[uid] = firstName || "Parent";
    }
    }

    setWorkShiftNamesByUserId(namesByUserId);
    setWorkShiftRows(rows);
   };

   const getISOWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
   };

  const shouldCollectOnDate = (date: Date, cycle: "weekly" | "A" | "B"): boolean => {
   if (cycle === "weekly") {
    return true;
   }

   const weekNumber = getISOWeekNumber(date);
   if (cycle === "A") {
    return weekNumber % 2 === 1;
   }
   return weekNumber % 2 === 0;
  };

   const clearCollecteReminderEvents = async (
    client = getSupabaseBrowserClient(),
    familyId?: string | null,
   ) => {
    if (!familyId || !user) {
     return false;
    }

    const deleteResponse = await client
     .from("events")
     .delete()
     .eq("family_id", familyId)
     .eq("type", "Poubelles/Recyclage");

    if (deleteResponse.error) {
     return false;
    }

      return true;
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
  const deleteResult = await client.from("journal_garde").delete().eq("event_id", eventId);
  if (deleteResult.error && !isJournalMissingColumnError(deleteResult.error.message, "event_id")) {
   return;
  }

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
   const fallbackWithEventId = await client.from("journal_garde").insert(
    gardeDays.map((day) => ({
     event_id: eventId,
     guard_day: day,
     parent: parentRole,
     title: eventTitle,
    })),
   );

   if (fallbackWithEventId.error && isJournalMissingColumnError(fallbackWithEventId.error.message, "event_id")) {
    await client.from("journal_garde").insert(
     gardeDays.map((day) => ({
      garde_date: day,
      parent_role: parentRole,
      title: eventTitle,
     })),
    );
   }
  }
 };

 const refreshSwapRequests = async (client = getSupabaseBrowserClient()) => {
  try {
   const rows = await fetchSwapRequests(client);

   const mapped = (rows as SwapRequestRow[])
   .map((row): SwapRequest | null => {
    const rowRequestDate = row.date_demande;
    const rowOriginalDate = row.date_originale;
    const rowProposedDate = row.date_proposee;

    if (!row.id || !rowRequestDate || !rowOriginalDate || !rowProposedDate) {
     return null;
    }

    const statusCandidateRaw = row.statut ?? "en_attente";
    const statusCandidate = statusCandidateRaw;
    const status: SwapStatus =
     statusCandidate === "acceptee" || statusCandidate === "refusee" ? statusCandidate : "en_attente";

    return {
     id: String(row.id),
     requesterUserId: row.demandeur_id ?? null,
     requestDate: rowRequestDate,
     originalDate: rowOriginalDate,
     proposedDate: rowProposedDate,
     reason: row.raison ?? "",
     status,
     createdAt: rowRequestDate,
    };
   })
   .filter((request): request is SwapRequest => request !== null);

   setSwapRequests(mapped);
  } catch (error) {
   setSwapError(error instanceof Error ? error.message : "Impossible de charger les demandes.");
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

   const profileRoleRaw = await fetchProfileRole(supabase, userData.user.id);
   setProfileRole(normalizeParentRole(profileRoleRaw));
  const familyId = activeFamilyId ?? null;
   setCurrentFamilyId(familyId);

   if (!familyId) {
    setFormError("Aucun espace actif sélectionné.");
    setIsLoadingEvents(false);
    setIsLoadingSwapRequests(false);
    return;
   }

   await Promise.all([
    refreshEvents(supabase, familyId),
    refreshTasks(supabase, familyId),
    refreshSwapRequests(supabase),
    refreshJournalEntries(supabase),
    refreshSpecialDays(supabase, familyId),
    refreshCollectes(supabase, familyId),
    refreshWorkShifts(supabase, familyId),
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
 }, [activeFamilyId, router]);

  useEffect(() => {
   if (!currentFamilyId || !user) {
    return;
   }

   let cancelled = false;

   const cleanup = async () => {
    try {
    const supabase = getSupabaseBrowserClient();
    const deleted = await clearCollecteReminderEvents(supabase, currentFamilyId);
    if (!cancelled && deleted) {
     await refreshEvents(supabase, currentFamilyId);
    }
    } catch {
    return;
    }
   };

   void cleanup();

   return () => {
    cancelled = true;
   };
  }, [currentFamilyId, user]);

 const calendarAccess = familyRole
  ? getFeatureAccess("calendar", familyRole, currentPermissions)
  : { allowed: true, readOnly: false, reason: "" };
 const isReadOnly = calendarAccess.readOnly;

 const openForm = () => {
  if (isReadOnly) {
   return;
  }
  setFormError("");
  setFormOpen(true);
 };

 const closeForm = () => {
  setFormOpen(false);
  setFormError("");
 };

 const openEditForm = (selectedEvent: CalendarEvent) => {
  if (isReadOnly) {
   return;
  }
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

 const openSwapFormForDate = (dateKey: string) => {
  setSwapError("");
  setRequestDate(dateKey);
  setOriginalDate(dateKey);

  const baseDate = new Date(`${dateKey}T00:00:00`);
  const nextDate = Number.isNaN(baseDate.getTime())
   ? new Date(Date.now() + 24 * 60 * 60 * 1000)
   : new Date(baseDate.getTime() + 24 * 60 * 60 * 1000);

  setProposedDate(formatForDateInput(nextDate));
  setSwapFormOpen(true);
 };

 const openScheduleForm = async () => {
  if (isReadOnly) {
   return;
  }
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

 const openCollectesForm = () => {
  if (isReadOnly) {
   return;
  }

  setCollectesError("");
  setCollectesFormOpen(true);

  const source = collectesConfig;
  setCollectesGarbageDay(`${source?.garbageDay ?? 1}`);
  setCollectesRecyclingDay(`${source?.recyclingDay ?? 3}`);
  setCollectesCompostDay(`${source?.compostDay ?? 5}`);
  setCollectesReminderTime(source?.reminderTime ?? "20:00");
  setCollectesAssignmentMode(source?.assignmentMode ?? "alternate");
  setCollectesGarbageCycle(source?.garbageCycle ?? "weekly");
  setCollectesRecyclingCycle(source?.recyclingCycle ?? "weekly");
  setCollectesCompostCycle(source?.compostCycle ?? "weekly");
 };

 const closeCollectesForm = () => {
  setCollectesFormOpen(false);
  setCollectesError("");
 };

 const resetShiftForm = () => {
  const now = new Date();
  const end = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  setShiftEditMode("create");
  setShiftTargetId("");
  setShiftTitle("Shift travail");
  setShiftType("jour");
  setShiftStartAt(formatForDateTimeLocal(now));
  setShiftEndAt(formatForDateTimeLocal(end));
  setShiftLocation("");
  setShiftColor("#2C3E50");
  setShiftRecurrenceMode("once");
    setShiftScheduleMode("once");
  setShiftRecurrenceDays({ 1: false, 2: false, 3: false, 4: false, 5: false, 6: false, 0: false });
  setShiftRecurrenceStart(formatForDateInput(now));
  setShiftRecurrenceEnd("");
  setShiftFrequency("weekly");
    setShiftCycleLengthDays("35");
  setShiftReason("");
  setShiftNotifyCoparent(true);
  setShiftError("");
 };

 const openShiftCreateForm = () => {
  if (isReadOnly) {
  return;
  }
  resetShiftForm();
  setShiftFormOpen(true);
 };

 const openShiftEditForm = (shift: CalendarWorkShiftEvent) => {
  if (isReadOnly) {
  return;
  }
  setShiftEditMode("edit");
  setShiftTargetId(shift.sourceShiftId);
    const rawShift = workShiftRows.find((item) => String(item.id ?? "") === shift.sourceShiftId);
  setShiftTitle(shift.title);
  setShiftType(shift.shiftType);
  setShiftStartAt(formatForDateTimeLocal(shift.start));
  setShiftEndAt(formatForDateTimeLocal(shift.end));
  setShiftLocation(shift.location ?? "");
  setShiftColor(shift.color);
    const recurrenceMode = rawShift?.recurrence_mode === "recurring" ? "recurring" : "once";
    const recurrenceDays = Array.isArray(rawShift?.recurrence_days)
     ? rawShift.recurrence_days.reduce<Record<number, boolean>>((accumulator, value) => {
        accumulator[Number(value) % 7] = true;
        return accumulator;
       }, { 1: false, 2: false, 3: false, 4: false, 5: false, 6: false, 0: false })
     : { 1: false, 2: false, 3: false, 4: false, 5: false, 6: false, 0: false };
    setShiftRecurrenceMode(recurrenceMode);
    setShiftScheduleMode(
     recurrenceMode !== "recurring"
      ? "once"
      : rawShift?.frequency === "custom"
       ? "cycle"
       : "weekly",
    );
    setShiftRecurrenceDays(recurrenceDays);
    setShiftRecurrenceStart(typeof rawShift?.recurrence_start === "string" ? rawShift.recurrence_start : formatForDateInput(shift.start));
    setShiftRecurrenceEnd(typeof rawShift?.recurrence_end === "string" ? rawShift.recurrence_end : "");
    setShiftFrequency(rawShift?.frequency === "biweekly" || rawShift?.frequency === "custom" ? rawShift.frequency : "weekly");
    setShiftCycleLengthDays(typeof rawShift?.cycle_length_days === "number" && rawShift.cycle_length_days > 0 ? String(rawShift.cycle_length_days) : "35");
  setShiftReason(shift.reason ?? "");
  setShiftNotifyCoparent(shift.notifyCoparent);
  setShiftError("");
  setShiftFormOpen(true);
 };

 const openShiftOverrideForm = (shift: CalendarWorkShiftEvent) => {
  if (isReadOnly) {
  return;
  }
  setShiftEditMode("override");
  setShiftTargetId(shift.sourceShiftId);
  setShiftTitle(`Changement - ${shift.title}`);
  setShiftType("personnalise");
  setShiftStartAt(formatForDateTimeLocal(shift.start));
  setShiftEndAt(formatForDateTimeLocal(shift.end));
  setShiftLocation(shift.location ?? "");
  setShiftColor("#E67E22");
  setShiftRecurrenceMode("once");
  setShiftScheduleMode("once");
  setShiftRecurrenceDays({ 1: false, 2: false, 3: false, 4: false, 5: false, 6: false, 0: false });
  setShiftRecurrenceStart(formatForDateInput(shift.start));
  setShiftRecurrenceEnd("");
  setShiftFrequency("weekly");
  setShiftCycleLengthDays("35");
  setShiftReason("");
  setShiftNotifyCoparent(true);
  setShiftError("");
  setShiftFormOpen(true);
 };

 const openShiftCreateForDay = (shift: CalendarWorkShiftEvent) => {
  if (isReadOnly) {
  return;
  }
  resetShiftForm();
  const base = new Date(shift.start.getFullYear(), shift.start.getMonth(), shift.start.getDate(), 9, 0, 0, 0);
  const end = new Date(base.getTime() + 8 * 60 * 60 * 1000);
  setShiftStartAt(formatForDateTimeLocal(base));
  setShiftEndAt(formatForDateTimeLocal(end));
  setShiftFormOpen(true);
 };

 const closeShiftForm = () => {
  setShiftFormOpen(false);
  setShiftError("");
 };

 const buildShiftNotificationMessage = (payload: {
  action: "modification" | "suppression" | "changement";
  title: string;
  start: Date;
  end: Date;
  location?: string | null;
  reason?: string | null;
 }) => {
  const actionLabel =
   payload.action === "suppression"
    ? "Suppression d'un shift"
    : payload.action === "changement"
     ? "Changement de shift"
     : "Modification d'un shift";

  const lines = [
   `${actionLabel}: ${payload.title}`,
   `Horaire: ${formatDateTimeLabel(payload.start)} à ${formatDateTimeLabel(payload.end)}`,
  ];

  if (payload.location && payload.location.trim().length > 0) {
   lines.push(`Lieu: ${payload.location.trim()}`);
  }

  if (payload.reason && payload.reason.trim().length > 0) {
   lines.push(`Raison: ${payload.reason.trim()}`);
  }

  return lines.join("\n");
 };

 const notifyCoparentAboutShift = async (
  client: ReturnType<typeof getSupabaseBrowserClient>,
  payload: {
   action: "modification" | "suppression" | "changement";
   title: string;
   start: Date;
   end: Date;
   location?: string | null;
   reason?: string | null;
   notifyCoparent: boolean;
  },
 ) => {
  if (!currentFamilyId || !user || !payload.notifyCoparent) {
   return null;
  }

  const content = buildShiftNotificationMessage(payload);
  const notification = await client.from("messages").insert({
   family_id: currentFamilyId,
   sender_id: user.id,
   content,
  });

  return notification.error ? notification.error.message : null;
 };

 const deleteShiftById = async (
  shiftId: string,
  options?: {
   title?: string;
   start?: Date;
   end?: Date;
   location?: string | null;
   reason?: string | null;
   notifyCoparent?: boolean;
   closeForm?: boolean;
  },
 ) => {
  if (!shiftId || !currentFamilyId || !user || isReadOnly) {
   return;
  }

  setIsDeletingShift(true);
  setShiftError("");

  try {
   const supabase = getSupabaseBrowserClient();
   const remove = await supabase.from("work_shifts").delete().eq("id", shiftId);
   if (remove.error) {
    throw new Error(remove.error.message);
   }

   const notificationError = await notifyCoparentAboutShift(supabase, {
    action: "suppression",
    title: options?.title ?? shiftTitle.trim() || "Shift travail",
    start: options?.start ?? new Date(shiftStartAt),
    end: options?.end ?? new Date(shiftEndAt),
    location: options?.location ?? shiftLocation,
    reason: options?.reason ?? shiftReason,
    notifyCoparent: options?.notifyCoparent ?? shiftNotifyCoparent,
   });

   await refreshWorkShifts(supabase, currentFamilyId);
   if (options?.closeForm !== false) {
    closeShiftForm();
   }
   setActiveShiftMenu(null);
   setToast({
    message: notificationError ? "Shift supprimé. Notification non envoyée." : "Shift supprimé.",
    variant: "success",
   });
  } catch (error) {
   setShiftError(error instanceof Error ? error.message : "Impossible de supprimer le shift.");
  } finally {
   setIsDeletingShift(false);
  }
 };

 const onDeleteShift = async () => {
  if (!shiftTargetId) {
   return;
  }

  await deleteShiftById(shiftTargetId, { closeForm: true });
 };

 const onSaveShift = async (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();

  if (!currentFamilyId || !user || isReadOnly) {
  return;
  }

  const startDate = new Date(shiftStartAt);
  const endDate = new Date(shiftEndAt);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
  setShiftError("Heures de shift invalides.");
  return;
  }

  setIsSavingShift(true);
  setShiftError("");

  try {
  const supabase = getSupabaseBrowserClient();
  const cycleLengthValue = Number(shiftCycleLengthDays);
  if (shiftScheduleMode === "cycle" && (!Number.isInteger(cycleLengthValue) || cycleLengthValue <= 0)) {
   setShiftError("Le cycle doit être un nombre de jours valide.");
   return;
  }

  const weeklyDays = Object.entries(shiftRecurrenceDays)
   .filter(([, checked]) => checked)
   .map(([day]) => weekdayJsToIso(Number(day)));

  if (shiftScheduleMode === "weekly" && weeklyDays.length === 0) {
   setShiftError("Choisis au moins un jour pour l'horaire normal.");
   return;
  }

  const basePayload: Record<string, unknown> = {
   family_id: currentFamilyId,
   user_id: user.id,
   title: shiftTitle.trim() || "Shift travail",
   shift_type: shiftType,
   start_at: startDate.toISOString(),
   end_at: endDate.toISOString(),
   location: shiftLocation.trim() || null,
   color: shiftColor,
   recurrence_mode: shiftScheduleMode === "once" ? "once" : "recurring",
   recurrence_days: shiftScheduleMode === "weekly" ? weeklyDays : null,
   recurrence_start: shiftScheduleMode === "once" ? null : shiftRecurrenceStart,
   recurrence_end: shiftScheduleMode !== "once" && shiftRecurrenceEnd ? shiftRecurrenceEnd : null,
   frequency: shiftScheduleMode === "weekly" ? "weekly" : shiftScheduleMode === "cycle" ? "custom" : null,
   cycle_length_days: shiftScheduleMode === "cycle" ? cycleLengthValue : null,
   is_override: shiftEditMode === "override",
   base_shift_id: shiftEditMode === "override" ? shiftTargetId : null,
   reason: shiftReason.trim() || null,
   notify_coparent: shiftNotifyCoparent,
  };

  const persistPayloadWithoutCycle = () => {
   const { cycle_length_days: _ignoredCycleLengthDays, ...rest } = basePayload;
   return rest;
  };

  let notificationError: string | null = null;

  if (shiftEditMode === "edit" && shiftTargetId) {
   let update = await supabase.from("work_shifts").update(basePayload).eq("id", shiftTargetId);
   if (update.error && update.error.message.toLowerCase().includes("cycle_length_days")) {
    update = await supabase.from("work_shifts").update(persistPayloadWithoutCycle()).eq("id", shiftTargetId);
   }
   if (update.error) {
    throw new Error(update.error.message);
   }
   notificationError = await notifyCoparentAboutShift(supabase, {
    action: "modification",
    title: String(basePayload.title ?? "Shift travail"),
    start: startDate,
    end: endDate,
    location: typeof basePayload.location === "string" ? basePayload.location : null,
    reason: typeof basePayload.reason === "string" ? basePayload.reason : null,
    notifyCoparent: Boolean(basePayload.notify_coparent),
   });
  } else {
   let insert = await supabase.from("work_shifts").insert(basePayload);
   if (insert.error && insert.error.message.toLowerCase().includes("cycle_length_days")) {
    insert = await supabase.from("work_shifts").insert(persistPayloadWithoutCycle());
   }
   if (insert.error) {
    throw new Error(insert.error.message);
   }

   if (shiftEditMode === "override") {
    notificationError = await notifyCoparentAboutShift(supabase, {
     action: "changement",
     title: String(basePayload.title ?? "Shift travail"),
     start: startDate,
     end: endDate,
     location: typeof basePayload.location === "string" ? basePayload.location : null,
     reason: typeof basePayload.reason === "string" ? basePayload.reason : null,
     notifyCoparent: Boolean(basePayload.notify_coparent),
    });
   }
  }

  await refreshWorkShifts(supabase, currentFamilyId);
  closeShiftForm();
  setActiveShiftMenu(null);
  setToast({
   message: notificationError ? "Shift sauvegardé. Notification non envoyée." : "Shift sauvegardé.",
   variant: "success",
  });
  } catch (error) {
  setShiftError(error instanceof Error ? error.message : "Impossible de sauvegarder le shift.");
  } finally {
  setIsSavingShift(false);
  }
 };

 const onSaveCollectes = async (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();

  if (!currentFamilyId || !user || isReadOnly) {
   return;
  }

  setIsSavingCollectes(true);
  setCollectesError("");

  try {
    const supabase = getSupabaseBrowserClient();
    const dateDebut = formatForDateInput(new Date());
    const sharedFields = {
     family_id: currentFamilyId,
     assignment_mode: collectesAssignmentMode,
     heure_rappel: collectesReminderTime,
     date_debut: dateDebut,
    };

    const toFreqPayload = (cycle: "weekly" | "A" | "B") => ({
     frequence: cycle === "weekly" ? "weekly" : "biweekly",
     semaines_alternees: cycle === "weekly" ? null : cycle,
    });

    const payloadByType = [
     {
      ...sharedFields,
      ...toFreqPayload(collectesGarbageCycle),
      type: "ordures",
      jour_semaine: Number(collectesGarbageDay),
      nom: "Collecte ordures",
      couleur: "#7F8C8D",
      icone: "Trash2",
     },
     {
      ...sharedFields,
      ...toFreqPayload(collectesRecyclingCycle),
      type: "recyclage",
      jour_semaine: Number(collectesRecyclingDay),
      nom: "Collecte recyclage",
      couleur: "#27AE60",
      icone: "RefreshCw",
     },
     {
      ...sharedFields,
      ...toFreqPayload(collectesCompostCycle),
      type: "compost",
      jour_semaine: Number(collectesCompostDay),
      nom: "Collecte compost",
      couleur: "#8B6914",
      icone: "Leaf",
     },
    ];

    const modernDelete = await supabase.from("collectes").delete().eq("family_id", currentFamilyId);
    if (modernDelete.error) {
     throw new Error(modernDelete.error.message);
    }

    const modernWrite = await supabase.from("collectes").insert(payloadByType);

    if (modernWrite.error) {
     const modernMissingColumn = /column|schema cache|does not exist|could not find/i.test(modernWrite.error.message);
     if (!modernMissingColumn) {
      throw new Error(modernWrite.error.message);
     }

     const legacyPayload = {
      family_id: currentFamilyId,
      garbage_day: Number(collectesGarbageDay),
      recycling_day: Number(collectesRecyclingDay),
      compost_day: Number(collectesCompostDay),
      reminder_time: collectesReminderTime,
      assignment_mode: collectesAssignmentMode,
      frequence: "weekly",
      semaines_alternees: null,
      created_by: user.id,
      updated_at: new Date().toISOString(),
     };

     const legacyWrite = await supabase.from("collectes").upsert(legacyPayload, { onConflict: "family_id" });
     if (legacyWrite.error) {
      throw new Error(legacyWrite.error.message);
     }
    }

    await refreshCollectes(supabase, currentFamilyId);
    await refreshEvents(supabase, currentFamilyId);
    setCollectesFormOpen(false);
    setToast({ message: "✅ Collecte sauvegardée !", variant: "success" });
  } catch (saveError) {
    setCollectesError(saveError instanceof Error ? saveError.message : "Impossible d'enregistrer les collectes.");
  } finally {
    setIsSavingCollectes(false);
  }
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
  if (isReadOnly) {
   setFormError("Votre rôle est en lecture seule dans cet espace.");
   return;
  }

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

  if (!currentFamilyId) {
   setFormError("Aucun espace actif sélectionné.");
   return;
  }

  const createdEventId = await createEvent(supabase, {
    ...basePayload,
   family_id: currentFamilyId,
    parent: profileRole,
    start_at: startDate.toISOString(),
    end_at: endDate.toISOString(),
   });

   if (createdEventId) {
    await syncJournalForEvent(createdEventId, eventType, startDate, endDate, profileRole, title.trim(), supabase);
    await refreshJournalEntries(supabase);
   }

  await refreshEvents(supabase, currentFamilyId);
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
  if (isReadOnly) {
   setEditError("Votre rôle est en lecture seule dans cet espace.");
   return;
  }

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

   await updateEvent(supabase, editingEventId, {
    ...basePayload,
    parent: profileRole,
    start_at: startDate.toISOString(),
    end_at: endDate.toISOString(),
   });

   await syncJournalForEvent(editingEventId, editEventType, startDate, endDate, profileRole, editTitle.trim(), supabase);
   await refreshJournalEntries(supabase);

  await refreshEvents(supabase, currentFamilyId);
   closeEditForm();
   setToast({ message: "Événement modifié avec succès.", variant: "success" });
  } catch (error) {
   setEditError(error instanceof Error ? error.message : "Erreur pendant la modification de l'événement.");
  } finally {
   setIsUpdating(false);
  }
 };

 const onDeleteEvent = async () => {
  if (isReadOnly) {
   return;
  }
  if (!editingEventId) {
   return;
  }

  setIsDeleting(true);
  setEditError("");

  try {
   const supabase = getSupabaseBrowserClient();
   await deleteEvent(supabase, editingEventId);

   const journalDelete = await supabase.from("journal_garde").delete().eq("event_id", editingEventId);
   if (journalDelete.error && !isJournalMissingColumnError(journalDelete.error.message, "event_id")) {
    setEditError(journalDelete.error.message);
    return;
   }
   await refreshJournalEntries(supabase);

  await refreshEvents(supabase, currentFamilyId);
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
  if (isReadOnly) {
   setSwapError("Votre rôle est en lecture seule dans cet espace.");
   return;
  }

  if (!user || requestDate.length === 0 || originalDate.length === 0 || proposedDate.length === 0 || swapReason.trim().length === 0) {
   setSwapError("Tous les champs sont obligatoires.");
   return;
  }

  setIsCreatingSwapRequest(true);
  setSwapError("");

  try {
   const supabase = getSupabaseBrowserClient();
   const payload = {
    demandeur_id: user.id,
    date_demande: requestDate,
    date_originale: originalDate,
    date_proposee: proposedDate,
    raison: swapReason.trim(),
    statut: "en_attente" as const,
   };

   await createSwapRequest(supabase, payload);

   await refreshSwapRequests();
   setRequestDate(formatForDateInput(new Date()));
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
  if (isReadOnly) {
   setJournalEditError("Votre rôle est en lecture seule dans cet espace.");
   return;
  }

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
    if (isJournalMissingColumnError(error.message, "event_id")) {
     const legacyWithoutEventId = await supabase
      .from("journal_garde")
      .update({
       garde_date: editingJournalStartDate,
       parent_role: editingJournalParentRole,
       title: editingJournalNotes.trim() || "Garde",
      })
      .eq("id", editingJournalId);

     if (!legacyWithoutEventId.error) {
      await refreshJournalEntries(supabase);
      closeJournalEditForm();
      setToast({ message: "Entrée du journal modifiée.", variant: "success" });
      return;
     }
    }

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
   const newStatus = decisionType === "accept" ? "acceptee" : "refusee";

   await updateSwapRequestDecision(supabase, decisionRequestId, {
    statut: newStatus,
   });

   await refreshSwapRequests();
   closeDecisionModal();
   setToast({
    message: decisionType === "accept" ? "Demande approuvée." : "Demande contestée.",
    variant: "success",
   });
  } catch (error) {
   setDecisionError(error instanceof Error ? error.message : "Erreur pendant la mise à jour de la demande.");
  } finally {
   setIsSubmittingDecision(false);
  }
 };

 const statusUi: Record<SwapStatus, { label: string; className: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  en_attente: {
    label: "En attente d'approbation",
   className: "border-[#D9D0C8] bg-[#F5F0EB] text-[#6B5D55]",
    icon: Clock,
  },
  acceptee: {
    label: "Approuvée",
   className: "border-[#D9D0C8] bg-[#EDE8E3] text-[#6B8F71]",
    icon: CheckCircle,
  },
  refusee: {
    label: "Contestée",
   className: "border-[#D9D0C8] bg-[#F5F0EB] text-[#A85C52]",
    icon: XCircle,
  },
 };

 const specialTypeConfig: Record<SpecialDayType, { label: string; color: string }> = {
  ferie: { label: "Jour férié", color: "#D94A4A" },
  pedagogique: { label: "Congé pédagogique", color: "#D9A74A" },
  vacances: { label: "Vacances scolaires", color: "#6B8F71" },
  scolaire: { label: "Événement scolaire", color: "#7C6B5D" },
 };

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

 const filteredEvents = useMemo(() => {
  if (selectedChildFilterId === "all") {
   return events;
  }

  const normalizedName = selectedChildFilterName.toLowerCase();
  return events.filter((item) => {
   const matchesId = item.childId === selectedChildFilterId;
   const matchesName = normalizedName.length > 0 && (item.childName ?? "").toLowerCase().includes(normalizedName);
   return matchesId || matchesName;
  });
 }, [events, selectedChildFilterId, selectedChildFilterName]);

   const taskCalendarEvents = useMemo<CalendarTaskEvent[]>(() => {
    const now = new Date();

    return tasks
     .map((task): CalendarTaskEvent | null => {
      const dueDate = new Date(task.dueDate);
      if (Number.isNaN(dueDate.getTime())) {
        return null;
      }

      const dayStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const status: CalendarTaskEventStatus =
        task.completedAt || task.status === "done"
          ? "done"
          : dueDate.getTime() < now.getTime()
            ? "late"
            : "pending";

      const prefix = status === "done" ? "✅" : status === "late" ? "❌" : "⏳";

      return {
        id: `task-${task.id}`,
        title: `${prefix} ${task.title}`,
        start: dayStart,
        end: dayEnd,
        allDay: true,
        kind: "task",
        taskStatus: status,
        taskTitle: task.title,
        dueDateIso: task.dueDate,
      };
     })
     .filter((item): item is CalendarTaskEvent => item !== null);
   }, [tasks]);

   const collecteCalendarEvents = useMemo<CalendarCollecteEvent[]>(() => {
    if (!collectesConfig) {
     return [];
    }

    const eventsList: CalendarCollecteEvent[] = [];
    const monthStart = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
    const monthEnd = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0);
    const cursor = new Date(monthStart);

    while (cursor <= monthEnd) {
     const dayStart = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
     const dayEnd = new Date(dayStart);
     dayEnd.setDate(dayEnd.getDate() + 1);

       if (
        collectesConfig.garbageDay !== null &&
        cursor.getDay() === collectesConfig.garbageDay &&
        shouldCollectOnDate(cursor, collectesConfig.garbageCycle)
       ) {
      eventsList.push({
       id: `collecte-garbage-${toDateOnlyKey(dayStart)}`,
       title: `${COLLECTE_STYLE.garbage.icon} Collecte ${COLLECTE_STYLE.garbage.label.toLowerCase()}`,
       start: dayStart,
       end: dayEnd,
       allDay: true,
       kind: "collecte",
       collecteKind: "garbage",
      });
     }

    if (
     collectesConfig.recyclingDay !== null &&
     cursor.getDay() === collectesConfig.recyclingDay &&
     shouldCollectOnDate(cursor, collectesConfig.recyclingCycle)
    ) {
      eventsList.push({
       id: `collecte-recycling-${toDateOnlyKey(dayStart)}`,
       title: `${COLLECTE_STYLE.recycling.icon} Collecte ${COLLECTE_STYLE.recycling.label.toLowerCase()}`,
       start: dayStart,
       end: dayEnd,
       allDay: true,
       kind: "collecte",
       collecteKind: "recycling",
      });
     }

    if (
     collectesConfig.compostDay !== null &&
     cursor.getDay() === collectesConfig.compostDay &&
     shouldCollectOnDate(cursor, collectesConfig.compostCycle)
    ) {
      eventsList.push({
       id: `collecte-compost-${toDateOnlyKey(dayStart)}`,
       title: `${COLLECTE_STYLE.compost.icon} Collecte ${COLLECTE_STYLE.compost.label.toLowerCase()}`,
       start: dayStart,
       end: dayEnd,
       allDay: true,
       kind: "collecte",
       collecteKind: "compost",
      });
     }

     cursor.setDate(cursor.getDate() + 1);
    }

    return eventsList;
   }, [calendarDate, collectesConfig]);

   const workShifts = useMemo<CalendarWorkShiftEvent[]>(() => {
    if (workShiftRows.length === 0) {
     return [];
    }

    const visibleStart = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1, 0, 0, 0, 0);
    const visibleEnd = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 2, 0, 23, 59, 59, 999);
    const eventsList: CalendarWorkShiftEvent[] = [];

    for (const row of workShiftRows) {
     const id = row.id ? String(row.id) : "";
     const userId = typeof row.user_id === "string" ? row.user_id : "";
     const templateStart = parseIsoDate(row.start_at);
     const templateEnd = parseIsoDate(row.end_at);
     if (!id || !userId || !templateStart || !templateEnd) {
      continue;
     }

     const title = typeof row.title === "string" && row.title.trim().length > 0 ? row.title.trim() : "Shift travail";
     const shiftTypeValue: WorkShiftType =
      row.shift_type === "soir" || row.shift_type === "nuit" || row.shift_type === "personnalise"
       ? row.shift_type
       : "jour";
     const recurrenceMode: WorkShiftRecurrence = row.recurrence_mode === "recurring" ? "recurring" : "once";
     const frequency: WorkShiftFrequency | null =
      row.frequency === "weekly" || row.frequency === "biweekly" || row.frequency === "custom" ? row.frequency : null;
     const recurrenceDays = Array.isArray(row.recurrence_days)
      ? row.recurrence_days.map((value) => Number(value)).filter((value) => Number.isInteger(value))
      : [];
     const recurrenceStart = typeof row.recurrence_start === "string" ? row.recurrence_start : null;
     const recurrenceEnd = typeof row.recurrence_end === "string" ? row.recurrence_end : null;
     const cycleLengthDays = typeof row.cycle_length_days === "number" ? row.cycle_length_days : null;
     const durationMs = templateEnd.getTime() - templateStart.getTime();

     const pushOccurrence = (occurrenceStart: Date, suffix: string) => {
      const occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs);
      if (!dateRangesOverlap(occurrenceStart, occurrenceEnd, visibleStart, visibleEnd)) {
       return;
      }

      eventsList.push({
       id: `shift-${id}-${suffix}`,
       sourceShiftId: id,
       title,
       start: occurrenceStart,
       end: occurrenceEnd,
       kind: "shift",
       shiftType: shiftTypeValue,
       userId,
       userLabel: workShiftNamesByUserId[userId] ?? "Parent",
       location: typeof row.location === "string" ? row.location : null,
       color: typeof row.color === "string" && row.color.trim().length > 0 ? row.color : "#2C3E50",
       isOverride: Boolean(row.is_override),
       reason: typeof row.reason === "string" ? row.reason : null,
       notifyCoparent: Boolean(row.notify_coparent),
       recurrenceMode,
       frequency,
       recurrenceDays,
       recurrenceStart,
       recurrenceEnd,
       cycleLengthDays,
      });
     };

     if (recurrenceMode !== "recurring") {
      pushOccurrence(templateStart, toDateOnlyKey(templateStart));
      continue;
     }

     const anchorDate = recurrenceStart ? new Date(`${recurrenceStart}T00:00:00`) : new Date(templateStart.getFullYear(), templateStart.getMonth(), templateStart.getDate());
     const recurrenceEndDate = recurrenceEnd ? new Date(`${recurrenceEnd}T23:59:59`) : visibleEnd;

     if (frequency === "custom" && cycleLengthDays && cycleLengthDays > 0) {
      const cursor = new Date(anchorDate);
      while (cursor <= recurrenceEndDate && cursor <= visibleEnd) {
       const occurrenceStart = applyTimeFromTemplate(cursor, templateStart);
       pushOccurrence(occurrenceStart, toDateOnlyKey(occurrenceStart));
       cursor.setDate(cursor.getDate() + cycleLengthDays);
      }
      continue;
     }

     const cursor = new Date(Math.max(anchorDate.getTime(), visibleStart.getTime()));
     cursor.setHours(0, 0, 0, 0);
     while (cursor <= recurrenceEndDate && cursor <= visibleEnd) {
      const isoWeekday = weekdayJsToIso(cursor.getDay());
      const matchesDay = recurrenceDays.length === 0 ? isoWeekday === weekdayJsToIso(templateStart.getDay()) : recurrenceDays.includes(isoWeekday);
      const weekDelta = Math.floor((toUtcDayMs(cursor) - toUtcDayMs(anchorDate)) / (7 * 24 * 60 * 60 * 1000));
      const matchesFrequency = frequency === "biweekly" ? weekDelta % 2 === 0 : true;
      if (matchesDay && matchesFrequency) {
       const occurrenceStart = applyTimeFromTemplate(cursor, templateStart);
       pushOccurrence(occurrenceStart, toDateOnlyKey(occurrenceStart));
      }
      cursor.setDate(cursor.getDate() + 1);
     }
    }

    return eventsList.sort((left, right) => left.start.getTime() - right.start.getTime());
   }, [calendarDate, workShiftNamesByUserId, workShiftRows]);

 const calendarDisplayEvents = useMemo<CalendarDisplayEvent[]>(() => {
    return [...filteredEvents, ...calendarSpecialEvents, ...collecteCalendarEvents, ...taskCalendarEvents, ...workShifts];
   }, [calendarSpecialEvents, collecteCalendarEvents, filteredEvents, taskCalendarEvents, workShifts]);

   const shiftSuggestion = useMemo(() => {
    const now = new Date();
    const activeShift = workShifts.find((item) => now >= item.start && now <= item.end);
    if (!activeShift) {
     return null;
    }

    const timeLabel = `${activeShift.start.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })} - ${activeShift.end.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}`;
    return `${activeShift.userLabel} travaille de ${timeLabel} -> l'autre parent est suggéré pour la récupération.`;
   }, [workShifts]);

   const collectesSummary = useMemo(() => {
    if (!collectesConfig) {
     return null;
    }

    const now = new Date();
    const resolveNextDate = (day: number | null, cycle: "weekly" | "A" | "B"): string => {
      if (day === null) {
        return "Non configuré";
      }

      const cursor = new Date(now);
      for (let step = 0; step < 21; step += 1) {
        if (cursor.getDay() === day && shouldCollectOnDate(cursor, cycle)) {
          return cursor.toLocaleDateString("fr-CA", { weekday: "long", day: "2-digit", month: "2-digit" });
        }
        cursor.setDate(cursor.getDate() + 1);
      }
      return "Non configuré";
    };

    const cycleLabel = (cycle: "weekly" | "A" | "B"): string => {
      if (cycle === "A") {
        return "Semaine A";
      }
      if (cycle === "B") {
        return "Semaine B";
      }
      return "Chaque semaine";
    };

    const dayLabel = (day: number | null): string => WEEKDAY_OPTIONS.find((item) => item.jsDay === day)?.label ?? "Non défini";

    return {
      garbage: {
        day: dayLabel(collectesConfig.garbageDay),
        cycle: cycleLabel(collectesConfig.garbageCycle),
        next: resolveNextDate(collectesConfig.garbageDay, collectesConfig.garbageCycle),
      },
      recycling: {
        day: dayLabel(collectesConfig.recyclingDay),
        cycle: cycleLabel(collectesConfig.recyclingCycle),
        next: resolveNextDate(collectesConfig.recyclingDay, collectesConfig.recyclingCycle),
      },
      compost: {
        day: dayLabel(collectesConfig.compostDay),
        cycle: cycleLabel(collectesConfig.compostCycle),
        next: resolveNextDate(collectesConfig.compostDay, collectesConfig.compostCycle),
      },
      reminder: collectesConfig.reminderTime,
    };
   }, [collectesConfig]);

   const todayTaskEvents = useMemo(() => {
    const today = new Date();
    const todayKey = toDateOnlyKey(today);
    return taskCalendarEvents.filter((item) => toDateOnlyKey(item.start) === todayKey);
   }, [taskCalendarEvents]);

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
 const selectedSchoolDatesCount = useMemo(
  () => detectedSchoolDates.filter((item) => selectedSchoolDateIds[item.id]).length,
  [detectedSchoolDates, selectedSchoolDateIds],
 );

 const collecteIconsByDate = useMemo(() => {
  const map = new Map<string, Array<{ icon: string; color: string }>>();
  if (!collectesConfig) {
   return map;
  }

  const monthStart = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
  const monthEnd = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0);
  const cursor = new Date(monthStart);

  while (cursor <= monthEnd) {
   const dateKey = toDateOnlyKey(cursor);
   const iconList: Array<{ icon: string; color: string }> = [];

   if (collectesConfig.garbageDay !== null && cursor.getDay() === collectesConfig.garbageDay && shouldCollectOnDate(cursor, collectesConfig.garbageCycle)) {
    iconList.push({ icon: "🗑️", color: "#6F6F6F" });
   }
   if (collectesConfig.recyclingDay !== null && cursor.getDay() === collectesConfig.recyclingDay && shouldCollectOnDate(cursor, collectesConfig.recyclingCycle)) {
    iconList.push({ icon: "♻️", color: "#3D88CE" });
   }
   if (collectesConfig.compostDay !== null && cursor.getDay() === collectesConfig.compostDay && shouldCollectOnDate(cursor, collectesConfig.compostCycle)) {
    iconList.push({ icon: "🌱", color: "#4C9B5C" });
   }

   if (iconList.length > 0) {
    map.set(dateKey, iconList);
   }

   cursor.setDate(cursor.getDate() + 1);
  }

  return map;
 }, [calendarDate, collectesConfig]);

 const getGuardEventForDate = (date: Date): CalendarEvent | null => {
  const selectedDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const found = filteredEvents.find((eventItem) => {
   if (eventItem.type !== "Garde") {
    return false;
   }

   const eventStart = new Date(eventItem.start.getFullYear(), eventItem.start.getMonth(), eventItem.start.getDate());
   const eventEnd = new Date(eventItem.end.getFullYear(), eventItem.end.getMonth(), eventItem.end.getDate());
   return selectedDay >= eventStart && selectedDay <= eventEnd;
  });

  return found ?? null;
 };

 const openSchoolImportModal = () => {
  setSchoolImportError("");
  setSelectedSchoolBoard("");
  setDetectedSchoolDates([]);
  setSelectedSchoolDateIds({});
  setCsspAlreadyImported(false);
  setSchoolImportOpen(true);
 };

 const closeSchoolImportModal = () => {
  if (isLoadingSchoolBoardDates || isImportingSchoolDates) {
   return;
  }
  setSchoolImportOpen(false);
  setSchoolImportError("");
  setSelectedSchoolBoard("");
  setDetectedSchoolDates([]);
  setSelectedSchoolDateIds({});
  setCsspAlreadyImported(false);
 };

 const loadCsspSchoolCalendar = async () => {
  if (!user) {
   setSchoolImportError("Session invalide.");
   return;
  }

  setIsLoadingSchoolBoardDates(true);
  setSchoolImportError("");
  setDetectedSchoolDates([]);
  setSelectedSchoolDateIds({});
  setCsspAlreadyImported(false);

  try {
   const supabase = getSupabaseBrowserClient();
   const { data, error } = await supabase
    .from("jours_speciaux")
    .select("id, title, date, type")
    .ilike("title", "%CSSP%")
    .order("date", { ascending: true });

   if (error) {
    setSchoolImportError(error.message);
    return;
   }

   const sourceRows = (data as SpecialDayRow[])
    .map((row, index): ImportedSchoolDate | null => {
     if (!row.date || !row.title) {
      return null;
     }

     const type = normalizeSpecialDayType(row.type);
     return {
      id: `${row.date}|${row.title}|${type}|${index}`,
      date: row.date,
      description: row.title,
      type,
     };
    })
    .filter((item): item is ImportedSchoolDate => item !== null);

   if (sourceRows.length === 0) {
    setSchoolImportError("Aucune date CSSP disponible.");
    return;
   }

   const selectedMap = sourceRows.reduce<Record<string, boolean>>((accumulator, item) => {
    accumulator[item.id] = true;
    return accumulator;
   }, {});

   const familyId = currentFamilyId ?? user.id;
   let existingForFamilyCount = 0;
   const existingForFamily = await supabase
    .from("jours_speciaux")
    .select("id", { count: "exact", head: true })
    .eq("family_id", familyId)
    .ilike("title", "%CSSP%");

   if (existingForFamily.error) {
    const fallback = await supabase
     .from("jours_speciaux")
     .select("id", { count: "exact", head: true })
     .eq("user_id", user.id)
     .ilike("title", "%CSSP%");
    if (!fallback.error) {
     existingForFamilyCount = fallback.count ?? 0;
    }
   } else {
    existingForFamilyCount = existingForFamily.count ?? 0;
   }

   setCsspAlreadyImported(existingForFamilyCount > 0);
   setDetectedSchoolDates(sourceRows);
   setSelectedSchoolDateIds(selectedMap);
  } catch (error) {
   setSchoolImportError(error instanceof Error ? error.message : "Erreur pendant le chargement CSSP.");
  } finally {
   setIsLoadingSchoolBoardDates(false);
  }
 };

 const onSchoolBoardChange = async (value: SchoolBoardOption) => {
  setSelectedSchoolBoard(value);
  setSchoolImportError("");
  setDetectedSchoolDates([]);
  setSelectedSchoolDateIds({});
  setCsspAlreadyImported(false);

  if (value === "cssp") {
   await loadCsspSchoolCalendar();
  }
 };

 const toggleSchoolDateSelection = (id: string) => {
  setSelectedSchoolDateIds((current) => ({
   ...current,
   [id]: !current[id],
  }));
 };

 const onImportSelectedSchoolDates = async () => {
  if (!user) {
   setSchoolImportError("Session invalide.");
   return;
  }

  const selectedRows = detectedSchoolDates.filter((item) => selectedSchoolDateIds[item.id]);
  if (selectedRows.length === 0) {
   setSchoolImportError("Sélectionnez au moins une date à importer.");
   return;
  }

  setIsImportingSchoolDates(true);
  setSchoolImportError("");

  try {
   const supabase = getSupabaseBrowserClient();
   const familyId = currentFamilyId ?? user.id;
   const existingRowsResult = await supabase
    .from("jours_speciaux")
    .select("date, title, type")
    .eq("family_id", familyId);

   let existingRows = existingRowsResult.data as Array<{ date?: string; title?: string; type?: string }> | null;
   if (existingRowsResult.error) {
    const fallback = await supabase
     .from("jours_speciaux")
     .select("date, title, type")
     .eq("user_id", user.id);
    if (fallback.error) {
     throw new Error(fallback.error.message);
    }
    existingRows = fallback.data as Array<{ date?: string; title?: string; type?: string }> | null;
   }

   const existingKeySet = new Set(
    (existingRows ?? []).map((row) => {
     const rowDate = row.date ?? "";
     const rowTitle = (row.title ?? "").trim().toLowerCase();
     const rowType = normalizeSpecialDayType(row.type);
     return `${rowDate}|${rowTitle}|${rowType}`;
    }),
   );

   const rows = selectedRows
   .map((item) => ({
    title: item.description,
    date: item.date,
    type: item.type,
    notes: "Importé depuis CSSP",
    user_id: user.id,
    family_id: familyId,
   }))
   .filter((item) => {
    const key = `${item.date}|${item.title.trim().toLowerCase()}|${item.type}`;
    return !existingKeySet.has(key);
   });

   const importedCount = await createSpecialDaysBulk(supabase, rows);
   await refreshSpecialDays(supabase);
   setSchoolImportOpen(false);
   setSelectedSchoolBoard("");
   setDetectedSchoolDates([]);
   setSelectedSchoolDateIds({});
   setCsspAlreadyImported(false);
   setToast({ message: ` ${importedCount} dates scolaires ajoutées !`, variant: "success" });
  } catch (error) {
   setSchoolImportError(error instanceof Error ? error.message : "Erreur pendant l'import des dates.");
  } finally {
   setIsImportingSchoolDates(false);
  }
 };

 const onApplyGuardSchedule = async (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  if (isReadOnly) {
   setScheduleError("Votre rôle est en lecture seule dans cet espace.");
   return;
  }

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

   const { data: existingEventsData, error: existingEventsError } = await supabase
    .from("events")
    .select("id")
      .eq("family_id", currentFamilyId)
    .eq("type", "Garde")
    .eq("title", "Horaire de garde (auto)")
    .gte("start_at", startIso)
    .lt("start_at", endIso);

   if (existingEventsError) {
    setScheduleError(existingEventsError.message);
    return;
   }

   const existingEventIds = (existingEventsData ?? [])
    .map((row) => (row.id ? String(row.id) : ""))
    .filter((value) => value.length > 0);

   if (existingEventIds.length > 0) {
    const cleanupByEvent = await supabase.from("journal_garde").delete().in("event_id", existingEventIds);
    if (cleanupByEvent.error && !isJournalMissingColumnError(cleanupByEvent.error.message, "event_id")) {
     setScheduleError(cleanupByEvent.error.message);
     return;
    }
    await supabase.from("events").delete().in("id", existingEventIds);
   }

   const generatedEvents: Array<{
    title: string;
    type: EventType;
      family_id: string | null;
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
        family_id: currentFamilyId,
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

   const { data: insertedRows, error: insertedError } = await supabase
    .from("events")
    .insert(generatedEvents)
    .select("*");

   if (insertedError) {
    setScheduleError(insertedError.message);
    return;
   }

   const journalRows = (insertedRows ?? [])
    .map((row) => {
     const id = row.id ? String(row.id) : "";
     const startValue = row.start_at;
     if (!id || !startValue) {
      return null;
     }

     const gardeDate = startValue.slice(0, 10);
     return {
      event_id: id,
      garde_date: gardeDate,
      parent_role: normalizeParentRole(row.parent),
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
      if (isJournalMissingColumnError(fallbackJournalInsert.error.message, "event_id")) {
       const legacyRowsNoEventId = journalRows.map((row) => ({
        garde_date: row.garde_date,
        parent_role: row.parent_role,
        title: row.title,
       }));

       const legacyInsert = await supabase.from("journal_garde").insert(legacyRowsNoEventId);
       if (legacyInsert.error) {
        setScheduleError(legacyInsert.error.message);
        return;
       }
      } else {
       setScheduleError(fallbackJournalInsert.error.message);
       return;
      }
     }
    }
   }

  await refreshEvents(supabase, currentFamilyId);
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
   <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#F5F0EB] to-[#EDE8E3] px-6">
    <p className="text-sm font-medium text-[#6B5D55]">Chargement du calendrier...</p>
   </div>
  );
 }

 if (configError) {
  return (
   <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#F5F0EB] to-[#EDE8E3] px-6">
    <p className="max-w-xl text-center text-sm font-medium text-[#A85C52]">{configError}</p>
   </div>
  );
 }

 if (!calendarAccess.allowed) {
  return <AccessDeniedCard title="Calendrier" message={calendarAccess.reason} />;
 }

 return (
  <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#F5F0EB] via-[#EDE8E3] to-[#EDE8E3] px-4 py-8 sm:px-6 sm:py-10">
   <div className="pointer-events-none absolute -top-32 -left-24 h-80 w-80 rounded-full bg-[#7C6B5D]/20 blur-3xl" />
   <div className="pointer-events-none absolute right-0 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-[#A89080]/20 blur-3xl" />

   <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-6 rounded-3xl border border-white/70 bg-white/90 p-6 shadow-[0_2px_8px_rgba(44,36,32,0.08)] backdrop-blur-sm sm:p-8">
    <header className="flex flex-wrap items-center justify-between gap-3">
     <div>
      <p className="text-xs font-semibold tracking-[0.2em] text-[#A89080]">PLANNING</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#2C2420]"> Calendrier</h1>
     </div>

     <div className="flex items-center gap-2">
      <Link
       href="/dashboard"
       className="inline-flex items-center justify-center rounded-xl border border-[#D9D0C8] px-4 py-2 text-sm font-semibold text-[#6B5D55] transition hover:bg-[#EDE8E3]"
      >
        <ArrowLeft size={16} className="mr-2" />
        Retour
      </Link>
      <button
       type="button"
       onClick={openForm}
        disabled={isReadOnly}
        className="inline-flex items-center justify-center rounded-xl bg-[#7C6B5D] px-4 py-2 text-sm font-semibold text-white shadow-[0_1px_4px_rgba(44,36,32,0.12)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
      >
      <PlusCircle size={16} className="mr-2 text-white" />
      Ajouter
      </button>
     </div>
    </header>

    <section className="rounded-2xl border border-[#D9D0C8] bg-white p-4 shadow-[0_1px_4px_rgba(44,36,32,0.06)] sm:p-5">
      {isReadOnly && (
       <p className="mb-4 rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] px-4 py-3 text-sm text-[#6B5D55]">
        Consultation seule dans cet espace pour votre rôle.
       </p>
      )}
     <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-semibold text-[#2C2420]">CALENDRIER</h2>
      <div className="flex flex-wrap items-center gap-2">
       <button
        type="button"
        onClick={() => setJournalOpen((current) => !current)}
        className="inline-flex items-center justify-center rounded-xl border border-[#D9D0C8] bg-white px-4 py-2 text-sm font-semibold text-[#6B5D55] transition hover:bg-[#EDE8E3]"
       >
          <BookOpen size={15} className="mr-2" />
          Journal de garde
       </button>
       <button
        type="button"
        onClick={openSchoolImportModal}
        className="inline-flex items-center justify-center rounded-xl border border-[#D9D0C8] bg-white px-4 py-2 text-sm font-semibold text-[#6B5D55] transition hover:bg-[#EDE8E3]"
       >
          <School size={15} className="mr-2" />
          Calendrier scolaire
       </button>
       <button
        type="button"
        onClick={openScheduleForm}
        disabled={isReadOnly}
        className="inline-flex items-center justify-center rounded-xl border border-[#D9D0C8] bg-white px-4 py-2 text-sm font-semibold text-[#6B5D55] transition hover:bg-[#EDE8E3] disabled:cursor-not-allowed disabled:opacity-60"
       >
         Horaire de garde
       </button>
       <button
        type="button"
        onClick={openCollectesForm}
        disabled={isReadOnly}
        className="inline-flex items-center justify-center rounded-xl border border-[#D9D0C8] bg-white px-4 py-2 text-sm font-semibold text-[#6B5D55] transition hover:bg-[#EDE8E3] disabled:cursor-not-allowed disabled:opacity-60"
       >
         🗑️ Collectes
       </button>
       <button
        type="button"
        onClick={openShiftCreateForm}
        disabled={isReadOnly}
        className="inline-flex items-center justify-center rounded-xl border border-[#D9D0C8] bg-white px-4 py-2 text-sm font-semibold text-[#6B5D55] transition hover:bg-[#EDE8E3] disabled:cursor-not-allowed disabled:opacity-60"
       >
         💼 Mon horaire de travail
       </button>
       <button
        type="button"
        onClick={onExportCalendarPdf}
        className="inline-flex items-center justify-center rounded-xl border border-[#D9D0C8] bg-white px-4 py-2 text-sm font-semibold text-[#6B5D55] transition hover:bg-[#EDE8E3]"
       >
          <Download size={15} className="mr-2" />
          Export PDF du calendrier
       </button>
      </div>
     </div>

     {journalOpen && (
      <div className="mb-4 rounded-2xl border border-[#D9D0C8] bg-[#F5F0EB] p-4">
       <p className="text-xs font-semibold tracking-[0.18em] text-[#A89080]">JOURNAL DE GARDE</p>
       <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[#D9D0C8] bg-white p-3 text-sm text-[#6B5D55]">
         <p className="font-semibold text-[#2C2420]">{formatMonthLabel(calendarDate)}</p>
         <p className="mt-1">Parent 1 : <span className="font-semibold">{monthCounts.parent1} jours</span></p>
         <p>Parent 2 : <span className="font-semibold">{monthCounts.parent2} jours</span></p>
        </div>
        <div className="rounded-xl border border-[#D9D0C8] bg-white p-3 text-sm text-[#6B5D55]">
         <p className="font-semibold text-[#2C2420]">Année {calendarDate.getFullYear()}</p>
         <p className="mt-1">Parent 1 : <span className="font-semibold">{yearCounts.parent1} jours</span></p>
         <p>Parent 2 : <span className="font-semibold">{yearCounts.parent2} jours</span></p>
        </div>
       </div>

       <div className="mt-3 rounded-xl border border-[#D9D0C8] bg-white p-3">
        <p className="text-xs font-semibold tracking-[0.16em] text-[#A89080]">GRAPHIQUE SIMPLE</p>
        <div className="mt-2 space-y-2 text-sm">
         <div>
          <p className="mb-1 font-medium text-[#6B5D55]">Parent 1 ({monthCounts.parent1})</p>
          <div className="h-3 rounded-full bg-[#EDE8E3]">
           <div className="h-3 rounded-full bg-[#7C6B5D]" style={{ width: `${(monthCounts.parent1 / maxMonthCount) * 100}%` }} />
          </div>
         </div>
         <div>
          <p className="mb-1 font-medium text-[#6B5D55]">Parent 2 ({monthCounts.parent2})</p>
          <div className="h-3 rounded-full bg-[#E9F8EE]">
           <div className="h-3 rounded-full bg-[#6B8F71]" style={{ width: `${(monthCounts.parent2 / maxMonthCount) * 100}%` }} />
          </div>
         </div>
        </div>
       </div>

       <div className="mt-3 rounded-xl border border-[#D9D0C8] bg-white p-3">
        <p className="text-xs font-semibold tracking-[0.16em] text-[#A89080]">LISTE DES JOURS DE GARDE DU MOIS</p>
        <div className="mt-2 space-y-2 text-sm text-[#6B5D55]">
         {journalMonthEntries.length === 0 ? (
          <p>Aucune garde ce mois-ci.</p>
         ) : (
          journalMonthEntries
           .sort((a, b) => a.gardeDate.localeCompare(b.gardeDate))
           .map((entry) => (
            <article
             key={entry.id}
             className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#E0EBF6] bg-[#F5F0EB] px-3 py-2"
            >
             <p>
              {formatDateLabel(entry.gardeDate)} · {entry.parentRole === "parent1" ? "Parent 1" : "Parent 2"}
              {entry.title ? ` · ${entry.title}` : ""}
             </p>
             <button
              type="button"
              onClick={() => openJournalEditForm(entry)}
              className="rounded-lg border border-[#D9D0C8] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B5D55] transition hover:bg-[#EDE8E3]"
             >
                <Pencil size={12} className="mr-1 inline-flex" />
                Modifier
             </button>
            </article>
           ))
         )}
        </div>
       </div>
      </div>
     )}

     <div className="mb-4 flex items-center justify-between gap-2 rounded-2xl border border-[#D9D0C8] bg-[#F5F0EB] px-3 py-3 sm:px-4">
      <button
       type="button"
       onClick={() => setCalendarDate((current) => shiftMonth(current, -1))}
       className="rounded-xl border border-[#D9D0C8] bg-white px-3 py-2 text-sm font-semibold text-[#6B5D55] transition hover:bg-[#EDE8E3]"
      >
       <ChevronLeft size={16} />
      </button>

      <p className="text-center text-base font-semibold text-[#6B5D55] sm:text-lg">
       {formatMonthLabel(shiftMonth(calendarDate, -1))} | {formatMonthLabel(calendarDate)} | {formatMonthLabel(shiftMonth(calendarDate, 1))}
      </p>

      <button
       type="button"
       onClick={() => setCalendarDate((current) => shiftMonth(current, 1))}
       className="rounded-xl border border-[#D9D0C8] bg-white px-3 py-2 text-sm font-semibold text-[#6B5D55] transition hover:bg-[#EDE8E3]"
      >
       <ChevronRight size={16} />
      </button>
     </div>

     {formError && (
      <p className="mb-4 rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] px-4 py-3 text-sm text-[#A85C52]">{formError}</p>
     )}

    <div className="mb-4 rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] p-3">
     <p className="text-xs font-semibold tracking-[0.14em] text-[#A89080]">POUBELLES ET COLLECTES</p>
     {!collectesSummary ? (
      <p className="mt-2 text-sm text-[#6B5D55]">
       Aucune configuration pour le moment. Clique sur <span className="font-semibold">🗑️ Collectes</span> pour configurer les jours.
      </p>
     ) : (
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
       <div className="rounded-lg border border-[#D9D0C8] bg-white px-3 py-2 text-sm text-[#2C2420]">
        <p className="font-semibold">🗑️ Ordures</p>
        <p>{collectesSummary.garbage.day}</p>
          <p className="text-xs text-[#6B5D55]">{collectesSummary.garbage.cycle}</p>
        <p className="text-xs text-[#6B5D55]">Prochaine: {collectesSummary.garbage.next}</p>
       </div>
       <div className="rounded-lg border border-[#D9D0C8] bg-white px-3 py-2 text-sm text-[#2C2420]">
        <p className="font-semibold">♻️ Recyclage</p>
        <p>{collectesSummary.recycling.day}</p>
          <p className="text-xs text-[#6B5D55]">{collectesSummary.recycling.cycle}</p>
        <p className="text-xs text-[#6B5D55]">Prochaine: {collectesSummary.recycling.next}</p>
       </div>
       <div className="rounded-lg border border-[#D9D0C8] bg-white px-3 py-2 text-sm text-[#2C2420]">
        <p className="font-semibold">🌱 Compost</p>
        <p>{collectesSummary.compost.day}</p>
          <p className="text-xs text-[#6B5D55]">{collectesSummary.compost.cycle}</p>
        <p className="text-xs text-[#6B5D55]">Prochaine: {collectesSummary.compost.next}</p>
       </div>
      </div>
     )}
    </div>

    <div className="mb-4 rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] p-3">
     <p className="text-xs font-semibold tracking-[0.14em] text-[#A89080]">TÂCHES DU JOUR</p>
     <div className="mt-2 space-y-2">
      {todayTaskEvents.length === 0 ? (
       <p className="text-sm text-[#6B5D55]">Aucune tâche prévue aujourd'hui.</p>
      ) : (
       todayTaskEvents.map((taskEvent) => (
        <div key={taskEvent.id} className="rounded-lg border border-[#D9D0C8] bg-white px-3 py-2 text-sm text-[#2C2420]">
      <span className="font-semibold">
       {taskEvent.taskStatus === "done" ? "✅ Fait" : taskEvent.taskStatus === "late" ? "❌ En retard" : "⏳ En attente"}
      </span>
      <span className="ml-2">{taskEvent.taskTitle}</span>
        </div>
       ))
      )}

      {shiftSuggestion && (
       <div className="mb-4 rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] p-3 text-sm text-[#2C2420]">
        <p className="text-xs font-semibold tracking-[0.14em] text-[#A89080]">SUGGESTION DISPONIBILITÉ ENFANT</p>
        <p className="mt-2">{shiftSuggestion}</p>
       </div>
      )}
     </div>
    </div>

     <p className="mb-3 text-sm font-medium text-[#6B5D55]">Clique sur un événement pour le modifier ou le supprimer.</p>

    <div className="mb-3 rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] p-3">
     <p className="text-xs font-semibold tracking-[0.14em] text-[#A89080]">TOUT EST FUSIONNÉ DANS LE CALENDRIER</p>
     <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium">
      <span className="rounded-full border border-[#B8DEC5] bg-[#EAF6EE] px-3 py-1 text-[#2F5E43]">Tâche faite</span>
      <span className="rounded-full border border-[#F3D6A7] bg-[#FFF5E8] px-3 py-1 text-[#9B6A22]">Tâche à faire</span>
      <span className="rounded-full border border-[#F2C4BE] bg-[#FDEDEC] px-3 py-1 text-[#9A3C34]">Tâche en retard</span>
      <span className="rounded-full border border-[#CED6DB] bg-[#EEF1F3] px-3 py-1 text-[#51606A]">Collecte ordures</span>
      <span className="rounded-full border border-[#B8E3CB] bg-[#EAF7F1] px-3 py-1 text-[#1F7A52]">Collecte recyclage</span>
      <span className="rounded-full border border-[#E6D7AE] bg-[#F5F0E3] px-3 py-1 text-[#7A5D16]">Collecte compost</span>
      <span className="rounded-full border border-[#D9D0C8] bg-[#EEF3F7] px-3 py-1 text-[#2C2420]">Shift travail</span>
     </div>
    </div>

     <div className="overflow-hidden rounded-2xl border border-[#D9D0C8] bg-white p-2 sm:p-4">
      <Calendar
       localizer={localizer}
       events={calendarDisplayEvents}
       selectable
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
         ? event.title
        : event.kind === "task"
          ? `${event.title} · Tâche`
         : event.kind === "collecte"
          ? `${event.title} · Collecte`
         : event.kind === "shift"
          ? `Shift de ${event.userLabel} : ${event.start.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}-${event.end.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}`
          : `${event.title} · ${event.type}`
       }
       onSelectEvent={(event: CalendarDisplayEvent) => {
        setGuardDateMenu(null);
        if (event.kind === "shift") {
         setActiveShiftMenu(event);
         return;
        }
        if (event.kind === "special") {
         return;
        }
        if (event.kind === "task") {
         router.push("/tasks");
         return;
        }
        if (event.kind === "collecte") {
        return;
        }
        openEditForm(event);
       }}
       onSelectSlot={(slotInfo) => {
        const selectedDate = slotInfo.start;

        if (!(selectedDate instanceof Date) || Number.isNaN(selectedDate.getTime())) {
         setGuardDateMenu(null);
         return;
        }

        const guardEvent = getGuardEventForDate(selectedDate);
        if (!guardEvent) {
         setGuardDateMenu(null);
         return;
        }

        const box = (slotInfo as { box?: { x?: number; y?: number; left?: number; top?: number } }).box;
        const x = typeof box?.x === "number" ? box.x : typeof box?.left === "number" ? box.left : 24;
        const y = typeof box?.y === "number" ? box.y : typeof box?.top === "number" ? box.top : 24;

        setGuardDateMenu({
         dateKey: toDateOnlyKey(selectedDate),
         eventId: guardEvent.id,
         x,
         y,
        });
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
        if (event.kind === "task") {
           const palette =
            event.taskStatus === "done"
             ? { backgroundColor: "#EAF6EE", textColor: "#2F5E43", borderColor: "#B8DEC5" }
             : event.taskStatus === "late"
              ? { backgroundColor: "#FDEDEC", textColor: "#9A3C34", borderColor: "#F2C4BE" }
              : { backgroundColor: "#FFF5E8", textColor: "#9B6A22", borderColor: "#F3D6A7" };

         return {
          style: {
             backgroundColor: palette.backgroundColor,
           borderRadius: "10px",
             border: `1px solid ${palette.borderColor}`,
             color: palette.textColor,
           padding: "2px 6px",
           fontWeight: 600,
          },
         };
        }
        if (event.kind === "collecte") {
           const paletteByKind = {
            garbage: { backgroundColor: "#EEF1F3", textColor: "#51606A", borderColor: "#CED6DB" },
            recycling: { backgroundColor: "#EAF7F1", textColor: "#1F7A52", borderColor: "#B8E3CB" },
            compost: { backgroundColor: "#F5F0E3", textColor: "#7A5D16", borderColor: "#E6D7AE" },
           } as const;
           const palette = paletteByKind[event.collecteKind];
         return {
          style: {
             backgroundColor: palette.backgroundColor,
           borderRadius: "10px",
             border: `1px solid ${palette.borderColor}`,
             color: palette.textColor,
           padding: "2px 6px",
           fontWeight: 600,
             opacity: 1,
          },
         };
        }

        if (event.kind === "shift") {
         return {
          style: {
             backgroundColor: hexToRgba(event.color, 0.16),
           borderRadius: "10px",
             border: `1px solid ${hexToRgba(event.color, 0.38)}`,
             color: "#2C2420",
           padding: "2px 6px",
           fontWeight: 600,
             opacity: 1,
          },
         };
        }

        const visual = EVENT_VISUALS[event.type] ?? EVENT_VISUALS.Autre;
        return {
         style: {
          backgroundColor: visual.color,
          borderRadius: "10px",
          border: "none",
          color: "#ffffff",
          padding: "2px 6px",
          fontWeight: 600,
         },
        };
       }}
         components={{
           event: ({ event }: { event: CalendarDisplayEvent }) => {
            if (event.kind === "task" || event.kind === "special") {
             return <span>{shortEventTitle(event.title)}</span>;
            }

            if (event.kind === "collecte") {
             const iconByKind: Record<CalendarCollecteEvent["collecteKind"], LucideIcon> = {
              garbage: Trash2,
              recycling: RefreshCw,
              compost: Leaf,
             };
             const Icon = iconByKind[event.collecteKind];
             return (
              <span className="inline-flex items-center gap-1">
               <Icon size={12} />
               <span>{shortEventTitle(event.title)}</span>
              </span>
             );
            }

            if (event.kind === "shift") {
             return (
              <span className="inline-flex items-center gap-1">
               <Briefcase size={12} />
               <span>{shortEventTitle(event.title)}</span>
              </span>
             );
            }

            const Icon = (EVENT_VISUALS[event.type] ?? EVENT_VISUALS.Autre).icon;
            return (
             <span className="inline-flex items-center gap-1">
              <Icon size={12} />
              <span>{shortEventTitle(event.title)}</span>
             </span>
            );
           },
          dateCellWrapper: ({ children, value }) => {
          const dayIcons = collecteIconsByDate.get(toDateOnlyKey(value));

          return (
           <div className="relative h-full">
            {children}
            {dayIcons && dayIcons.length > 0 ? (
            <div className="pointer-events-none absolute bottom-0.5 right-0.5 flex items-center gap-0.5">
             {dayIcons.map((item, index) => (
              <span key={`${item.icon}-${index}`} className="text-[11px]" style={{ color: item.color }}>
              {item.icon}
              </span>
             ))}
            </div>
            ) : null}
           </div>
          );
          },
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

    <section className="rounded-2xl border border-[#D9D0C8] bg-white p-4 shadow-[0_1px_4px_rgba(44,36,32,0.06)] sm:p-5">
     <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-semibold text-[#2C2420]">DEMANDES DE CHANGEMENT</h2>
      <button
       type="button"
       onClick={openSwapForm}
       className="inline-flex items-center justify-center rounded-xl bg-[#7C6B5D] px-4 py-2 text-sm font-semibold text-white shadow-[0_1px_4px_rgba(44,36,32,0.12)] transition hover:brightness-105"
      >
       Demander un changement de garde
      </button>
     </div>

     {swapError && (
      <p className="mb-4 rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] px-4 py-3 text-sm text-[#A85C52]">{swapError}</p>
     )}

     <div className="space-y-3">
      {swapRequests.length === 0 ? (
       <p className="rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] px-4 py-3 text-sm text-[#6B5D55]">
        Aucune demande pour le moment.
       </p>
      ) : (
       swapRequests.map((request) => {
        const isMine = request.requesterUserId === user?.id;
        const canModerate = !isMine && request.status === "en_attente";
        const statusInfo = statusUi[request.status];
      const StatusIcon = statusInfo.icon;

        return (
         <article key={request.id} className="rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
           <div>
            <p className="text-sm font-semibold text-[#2C2420]">
             {formatDateLabel(request.originalDate)} → {formatDateLabel(request.proposedDate)}
            </p>
            <p className="mt-1 text-sm text-[#6B5D55]">{request.reason || "Aucune raison précisée."}</p>
            <p className="mt-1 text-xs text-[#6B86A1]">
             {isMine ? "Demande envoyée par vous" : "Demande du co-parent"}
             {request.createdAt ? ` · ${new Date(request.createdAt).toLocaleString("fr-CA")}` : ""}
            </p>
           </div>

           <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${statusInfo.className}`}>
                  <StatusIcon size={12} />
            <span>{statusInfo.label}</span>
           </span>
          </div>

          {canModerate && (
           <div className="mt-3 flex flex-wrap gap-2">
            <button
             type="button"
             onClick={() => openDecisionModal(request, "accept")}
             className="rounded-xl bg-[#6B8F71] px-3 py-2 text-sm font-semibold text-white transition hover:brightness-105"
            >
             Accepter
            </button>
            <button
             type="button"
             onClick={() => openDecisionModal(request, "refuse")}
             className="rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] px-3 py-2 text-sm font-semibold text-[#A85C52] transition hover:bg-[#FFECEF]"
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

   {guardDateMenu && (
    <div className="fixed inset-0 z-[55]" onClick={() => setGuardDateMenu(null)}>
     <div
      className="absolute w-[280px] max-w-[calc(100vw-24px)] rounded-xl border border-[#D9D0C8] bg-white p-3 shadow-[0_14px_30px_rgba(38,78,120,0.24)]"
      style={{ left: guardDateMenu.x, top: guardDateMenu.y }}
      onClick={(event) => event.stopPropagation()}
     >
      <p className="text-xs font-semibold tracking-[0.14em] text-[#A89080]">GARDE · {formatDateLabel(guardDateMenu.dateKey)}</p>
      <div className="mt-2 flex flex-col gap-2">
       <button
        type="button"
        onClick={() => {
         const eventToView = events.find((item) => item.id === guardDateMenu.eventId);
         setGuardDateMenu(null);
         if (eventToView) {
          openEditForm(eventToView);
         }
        }}
        className="rounded-lg border border-[#D9D0C8] bg-white px-3 py-2 text-left text-sm font-semibold text-[#6B5D55] transition hover:bg-[#EDE8E3]"
       >
          <Eye size={14} className="mr-2 inline-flex" />
          Voir l'événement
       </button>
       <button
        type="button"
        onClick={() => {
         const selectedDate = guardDateMenu.dateKey;
         setGuardDateMenu(null);
         openSwapFormForDate(selectedDate);
        }}
        className="rounded-lg border border-[#D9D0C8] bg-white px-3 py-2 text-left text-sm font-semibold text-[#6B5D55] transition hover:bg-[#EDE8E3]"
       >
          <RefreshCcw size={14} className="mr-2 inline-flex" />
          Demander un échange pour ce jour
       </button>
      </div>
     </div>
    </div>
   )}

    {activeShiftMenu && (
     <div className="fixed inset-0 z-[56]" onClick={() => setActiveShiftMenu(null)}>
      <div
      className="absolute left-1/2 top-1/3 w-[320px] max-w-[calc(100vw-24px)] -translate-x-1/2 rounded-xl border border-[#D9D0C8] bg-white p-3 shadow-[0_14px_30px_rgba(38,78,120,0.24)]"
      onClick={(event) => event.stopPropagation()}
      >
      <p className="text-xs font-semibold tracking-[0.14em] text-[#A89080]">SHIFT · {activeShiftMenu.userLabel}</p>
      <p className="mt-1 text-sm text-[#2C2420]">{activeShiftMenu.title}</p>
      <div className="mt-2 flex flex-col gap-2">
       <button
        type="button"
        onClick={() => {
        const current = activeShiftMenu;
        setActiveShiftMenu(null);
        openShiftEditForm(current);
        }}
        className="rounded-lg border border-[#D9D0C8] bg-white px-3 py-2 text-left text-sm font-semibold text-[#6B5D55] transition hover:bg-[#EDE8E3]"
       >
        ✏️ Modifier ce shift
       </button>
       <button
        type="button"
        onClick={() => {
        const current = activeShiftMenu;
        setActiveShiftMenu(null);
        openShiftOverrideForm(current);
        }}
        className="rounded-lg border border-[#D9D0C8] bg-white px-3 py-2 text-left text-sm font-semibold text-[#6B5D55] transition hover:bg-[#EDE8E3]"
       >
        🔄 Changer ce shift
       </button>
       <button
        type="button"
        onClick={() => {
        const current = activeShiftMenu;
        setActiveShiftMenu(null);
        openShiftCreateForDay(current);
        }}
        className="rounded-lg border border-[#D9D0C8] bg-white px-3 py-2 text-left text-sm font-semibold text-[#6B5D55] transition hover:bg-[#EDE8E3]"
       >
        ➕ Ajouter un shift ce jour
       </button>
       <button
        type="button"
        onClick={() => {
        const current = activeShiftMenu;
        setActiveShiftMenu(null);
        const confirmed = window.confirm(
         current.recurrenceMode === "recurring"
          ? "Supprimer cet horaire de travail récurrent ?"
          : "Supprimer ce shift ?",
        );
        if (!confirmed) {
         return;
        }
        void deleteShiftById(current.sourceShiftId, {
         title: current.title,
         start: current.start,
         end: current.end,
         location: current.location,
         reason: current.reason,
         notifyCoparent: current.notifyCoparent,
         closeForm: false,
        });
        }}
        className="rounded-lg border border-[#D9D0C8] bg-[#F5F0EB] px-3 py-2 text-left text-sm font-semibold text-[#A85C52] transition hover:bg-[#FFECEF]"
       >
        🗑️ Supprimer
       </button>
      </div>
      </div>
     </div>
    )}

   {formOpen && (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0F223680] p-4 sm:items-center">
     <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/70 bg-white p-6 shadow-[0_20px_60px_rgba(15,36,54,0.22)]">
      <div className="mb-4 flex items-center justify-between">
       <h2 className="text-xl font-semibold text-[#2C2420]">Nouvel événement</h2>
       <button
        type="button"
        onClick={closeForm}
        className="rounded-lg border border-[#D9D0C8] px-2 py-1 text-sm text-[#6B5D55] hover:bg-[#EDE8E3]"
       >
        <X size={14} />
       </button>
      </div>

      <form className="space-y-4" onSubmit={onCreateEvent}>
       <div>
        <label htmlFor="title" className="mb-1 block text-sm font-medium text-[#6B5D55]">
         Titre de l'événement
        </label>
        <input
         id="title"
         type="text"
         value={title}
         onChange={(event) => setTitle(event.target.value)}
         className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
         placeholder="Ex: Rendez-vous pédiatre"
        />
       </div>

       <div>
        <label htmlFor="type" className="mb-1 block text-sm font-medium text-[#6B5D55]">
         Type
        </label>
        <select
         id="type"
         value={eventType}
         onChange={(event) => setEventType(event.target.value as EventType)}
         className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
        >
         {EVENT_TYPES.map((type) => (
          <option key={type} value={type}>
           {type}
          </option>
         ))}
        </select>
       </div>

        <div>
         <label htmlFor="garbageCycle" className="mb-1 block text-sm font-medium text-[#6B5D55]">
         Ordures : cycle
         </label>
         <select
         id="garbageCycle"
         value={collectesGarbageCycle}
         onChange={(event) => setCollectesGarbageCycle(event.target.value as "weekly" | "A" | "B")}
         className="w-full rounded-xl border border-[#D9D0C8] bg-white px-3 py-2.5 text-[#2C2420]"
         >
         <option value="weekly">Chaque semaine</option>
         <option value="A">Semaine A</option>
         <option value="B">Semaine B</option>
         </select>
        </div>

       <div>
        <label htmlFor="startAt" className="mb-1 block text-sm font-medium text-[#6B5D55]">
         Date début
        </label>
        <input
         id="startAt"
         type="datetime-local"
         value={startAt}
         onChange={(event) => setStartAt(event.target.value)}
         className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
        />
       </div>

       <div>
        <label htmlFor="endAt" className="mb-1 block text-sm font-medium text-[#6B5D55]">
         Date fin
        </label>
        <input
         id="endAt"
         type="datetime-local"
         value={endAt}
         onChange={(event) => setEndAt(event.target.value)}
         className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
        />
       </div>

       <button
        type="submit"
        disabled={isCreating}
        className="mt-2 w-full rounded-xl bg-[#7C6B5D] px-4 py-3 text-sm font-semibold text-white shadow-[0_1px_4px_rgba(44,36,32,0.12)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
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
       <h2 className="text-xl font-semibold text-[#2C2420]">Modifier l'événement</h2>
       <button
        type="button"
        onClick={closeEditForm}
        className="rounded-lg border border-[#D9D0C8] px-2 py-1 text-sm text-[#6B5D55] hover:bg-[#EDE8E3]"
       >
        <X size={14} />
       </button>
      </div>

      {editError && (
       <p className="mb-4 rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] px-3 py-2 text-sm text-[#A85C52]">
        {editError}
       </p>
      )}

      <form className="space-y-4" onSubmit={onUpdateEvent}>
       <div>
        <label htmlFor="editTitle" className="mb-1 block text-sm font-medium text-[#6B5D55]">
         Titre de l'événement
        </label>
        <input
         id="editTitle"
         type="text"
         value={editTitle}
         onChange={(event) => setEditTitle(event.target.value)}
         className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
        />
       </div>

       <div>
        <label htmlFor="editType" className="mb-1 block text-sm font-medium text-[#6B5D55]">
         Type
        </label>
        <select
         id="editType"
         value={editEventType}
         onChange={(event) => setEditEventType(event.target.value as EventType)}
         className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
        >
         {EVENT_TYPES.map((type) => (
          <option key={type} value={type}>
           {type}
          </option>
         ))}
        </select>
       </div>

        <div>
         <label htmlFor="recyclingCycle" className="mb-1 block text-sm font-medium text-[#6B5D55]">
         Recyclage : cycle
         </label>
         <select
         id="recyclingCycle"
         value={collectesRecyclingCycle}
         onChange={(event) => setCollectesRecyclingCycle(event.target.value as "weekly" | "A" | "B")}
         className="w-full rounded-xl border border-[#D9D0C8] bg-white px-3 py-2.5 text-[#2C2420]"
         >
         <option value="weekly">Chaque semaine</option>
         <option value="A">Semaine A</option>
         <option value="B">Semaine B</option>
         </select>
        </div>

       <div>
        <label htmlFor="editStartAt" className="mb-1 block text-sm font-medium text-[#6B5D55]">
         Date début
        </label>
        <input
         id="editStartAt"
         type="datetime-local"
         value={editStartAt}
         onChange={(event) => setEditStartAt(event.target.value)}
         className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
        />
       </div>

       <div>
        <label htmlFor="editEndAt" className="mb-1 block text-sm font-medium text-[#6B5D55]">
         Date fin
        </label>
        <input
         id="editEndAt"
         type="datetime-local"
         value={editEndAt}
         onChange={(event) => setEditEndAt(event.target.value)}
         className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
        />
       </div>

       <div className="mt-2 flex gap-2">
        <button
         type="submit"
         disabled={isUpdating || isDeleting}
         className="flex-1 rounded-xl bg-[#7C6B5D] px-4 py-3 text-sm font-semibold text-white shadow-[0_1px_4px_rgba(44,36,32,0.12)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
        >
         {isUpdating ? "Mise à jour..." : "Enregistrer"}
        </button>
        <button
         type="button"
         onClick={onDeleteEvent}
         disabled={isUpdating || isDeleting}
         className="flex-1 rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] px-4 py-3 text-sm font-semibold text-[#A85C52] transition hover:bg-[#FFECEF] disabled:cursor-not-allowed disabled:opacity-70"
        >
         <Trash2 size={14} className="mr-2 inline-flex" />
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
       <h2 className="text-xl font-semibold text-[#2C2420]">Nouvelle demande de garde</h2>
       <button
        type="button"
        onClick={closeSwapForm}
        className="rounded-lg border border-[#D9D0C8] px-2 py-1 text-sm text-[#6B5D55] hover:bg-[#EDE8E3]"
       >
        <X size={14} />
       </button>
      </div>

      {swapError && (
       <p className="mb-4 rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] px-3 py-2 text-sm text-[#A85C52]">
        {swapError}
       </p>
      )}

      <form className="space-y-4" onSubmit={onCreateSwapRequest}>
       <div>
        <label htmlFor="requestDate" className="mb-1 block text-sm font-medium text-[#6B5D55]">
         Date de demande
        </label>
        <input
         id="requestDate"
         type="date"
         value={requestDate}
         onChange={(event) => setRequestDate(event.target.value)}
         className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
        />
       </div>

       <div>
        <label htmlFor="originalDate" className="mb-1 block text-sm font-medium text-[#6B5D55]">
         Date originale
        </label>
        <input
         id="originalDate"
         type="date"
         value={originalDate}
         onChange={(event) => setOriginalDate(event.target.value)}
         className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
        />
       </div>

       <div>
        <label htmlFor="proposedDate" className="mb-1 block text-sm font-medium text-[#6B5D55]">
         Date proposée
        </label>
        <input
         id="proposedDate"
         type="date"
         value={proposedDate}
         onChange={(event) => setProposedDate(event.target.value)}
         className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
        />
       </div>

       <div>
        <label htmlFor="swapReason" className="mb-1 block text-sm font-medium text-[#6B5D55]">
         Raison
        </label>
        <textarea
         id="swapReason"
         value={swapReason}
         onChange={(event) => setSwapReason(event.target.value)}
         rows={4}
         className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
         placeholder="Expliquez brièvement la demande..."
        />
       </div>

       <button
        type="submit"
        disabled={isCreatingSwapRequest}
        className="mt-2 w-full rounded-xl bg-[#7C6B5D] px-4 py-3 text-sm font-semibold text-white shadow-[0_1px_4px_rgba(44,36,32,0.12)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
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
       <h2 className="text-xl font-semibold text-[#2C2420]">Modifier une entrée du journal</h2>
       <button
        type="button"
        onClick={closeJournalEditForm}
        className="rounded-lg border border-[#D9D0C8] px-2 py-1 text-sm text-[#6B5D55] hover:bg-[#EDE8E3]"
       >
            <X size={14} />
       </button>
      </div>

      {journalEditError && (
       <p className="mb-4 rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] px-3 py-2 text-sm text-[#A85C52]">
        {journalEditError}
       </p>
      )}

      <form className="space-y-4" onSubmit={onSaveJournalEntry}>
       <div>
        <label htmlFor="journalEditStartDate" className="mb-1 block text-sm font-medium text-[#6B5D55]">
         Date début
        </label>
        <input
         id="journalEditStartDate"
         type="date"
         value={editingJournalStartDate}
         onChange={(event) => setEditingJournalStartDate(event.target.value)}
         className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
        />
       </div>

       <div>
        <label htmlFor="journalEditEndDate" className="mb-1 block text-sm font-medium text-[#6B5D55]">
         Date fin
        </label>
        <input
         id="journalEditEndDate"
         type="date"
         value={editingJournalEndDate}
         onChange={(event) => setEditingJournalEndDate(event.target.value)}
         className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
        />
       </div>

       <div>
        <label htmlFor="journalEditParentRole" className="mb-1 block text-sm font-medium text-[#6B5D55]">
         Parent responsable
        </label>
        <select
         id="journalEditParentRole"
         value={editingJournalParentRole}
         onChange={(event) => setEditingJournalParentRole(event.target.value as ParentRole)}
         className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
        >
         <option value="parent1">Parent 1</option>
         <option value="parent2">Parent 2</option>
        </select>
       </div>

       <div>
        <label htmlFor="journalEditNotes" className="mb-1 block text-sm font-medium text-[#6B5D55]">
         Notes
        </label>
        <textarea
         id="journalEditNotes"
         value={editingJournalNotes}
         onChange={(event) => setEditingJournalNotes(event.target.value)}
         rows={3}
         className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
         placeholder="Notes sur la garde"
        />
       </div>

       <div className="mt-2 flex gap-2">
        <button
         type="submit"
         disabled={isSavingJournalEdit || isDeletingJournalEntry}
         className="flex-1 rounded-xl bg-[#7C6B5D] px-4 py-3 text-sm font-semibold text-white shadow-[0_1px_4px_rgba(44,36,32,0.12)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
        >
         {isSavingJournalEdit ? "Sauvegarde..." : "Sauvegarder"}
        </button>
        <button
         type="button"
         onClick={onDeleteJournalEntry}
         disabled={isSavingJournalEdit || isDeletingJournalEntry}
         className="flex-1 rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] px-4 py-3 text-sm font-semibold text-[#A85C52] transition hover:bg-[#FFECEF] disabled:cursor-not-allowed disabled:opacity-70"
        >
         <Trash2 size={14} className="mr-2 inline-flex" />
         {isDeletingJournalEntry ? "Suppression..." : "Supprimer"}
        </button>
       </div>
      </form>
     </div>
    </div>
   )}

    {shiftFormOpen && (
     <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0F223680] p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/70 bg-white p-6 shadow-[0_20px_60px_rgba(15,36,54,0.22)]">
      <div className="mb-4 flex items-center justify-between">
       <h2 className="text-xl font-semibold text-[#2C2420]">💼 Mon horaire de travail</h2>
       <button
        type="button"
        onClick={closeShiftForm}
        className="rounded-lg border border-[#D9D0C8] px-2 py-1 text-sm text-[#6B5D55] hover:bg-[#EDE8E3]"
       >
        <X size={14} />
       </button>
      </div>

      {shiftError && (
       <p className="mb-4 rounded-xl border border-[#D9D0C8] bg-[#FDF0EE] px-3 py-2 text-sm text-[#A85C52]">
        {shiftError}
       </p>
      )}

      <form className="space-y-4" onSubmit={onSaveShift}>
       <div>
        <label htmlFor="shiftTitle" className="mb-1 block text-sm font-medium text-[#6B5D55]">Titre</label>
        <input
        id="shiftTitle"
        type="text"
        value={shiftTitle}
        onChange={(event) => setShiftTitle(event.target.value)}
        className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420]"
        placeholder="Ex: Police, Hôpital, Bureau"
        />
       </div>

       <div className="grid gap-3 sm:grid-cols-2">
        <div>
        <label htmlFor="shiftType" className="mb-1 block text-sm font-medium text-[#6B5D55]">Type de shift</label>
        <select
         id="shiftType"
         value={shiftType}
         onChange={(event) => setShiftType(event.target.value as WorkShiftType)}
         className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420]"
        >
         <option value="jour">{SHIFT_PRESETS.jour.label}</option>
         <option value="soir">{SHIFT_PRESETS.soir.label}</option>
         <option value="nuit">{SHIFT_PRESETS.nuit.label}</option>
         <option value="personnalise">Personnalisé</option>
        </select>
        </div>
        <div>
        <label htmlFor="shiftColor" className="mb-1 block text-sm font-medium text-[#6B5D55]">Couleur</label>
        <input
         id="shiftColor"
         type="color"
         value={shiftColor}
         onChange={(event) => setShiftColor(event.target.value)}
         className="h-[44px] w-full rounded-xl border border-[#D9D0C8] px-2 py-1"
        />
        </div>
       </div>

       <div className="grid gap-3 sm:grid-cols-2">
        <div>
        <label htmlFor="shiftStartAt" className="mb-1 block text-sm font-medium text-[#6B5D55]">Début</label>
        <input
         id="shiftStartAt"
         type="datetime-local"
         value={shiftStartAt}
         onChange={(event) => setShiftStartAt(event.target.value)}
         className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420]"
        />
        </div>
        <div>
        <label htmlFor="shiftEndAt" className="mb-1 block text-sm font-medium text-[#6B5D55]">Fin</label>
        <input
         id="shiftEndAt"
         type="datetime-local"
         value={shiftEndAt}
         onChange={(event) => setShiftEndAt(event.target.value)}
         className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420]"
        />
        </div>
       </div>

       <div>
        <label htmlFor="shiftLocation" className="mb-1 block text-sm font-medium text-[#6B5D55]">Lieu (optionnel)</label>
        <input
        id="shiftLocation"
        type="text"
        value={shiftLocation}
        onChange={(event) => setShiftLocation(event.target.value)}
        className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420]"
        placeholder="Ex: Poste, Hôpital, Bureau"
        />
       </div>

       <section className="rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] p-4">
        <p className="text-xs font-semibold tracking-[0.14em] text-[#A89080]">RÉCURRENCE DU TRAVAIL</p>
        <div className="mt-3 grid gap-2">
        <label className="inline-flex items-center gap-2 text-sm text-[#6B5D55]">
         <input type="radio" checked={shiftScheduleMode === "once"} onChange={() => setShiftScheduleMode("once")} />
         Une seule fois
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-[#6B5D55]">
         <input type="radio" checked={shiftScheduleMode === "weekly"} onChange={() => setShiftScheduleMode("weekly")} />
         Horaire normal chaque semaine
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-[#6B5D55]">
         <input type="radio" checked={shiftScheduleMode === "cycle"} onChange={() => setShiftScheduleMode("cycle")} />
         Horaire atypique sur un cycle de X jours
        </label>
        </div>

        {shiftScheduleMode === "weekly" && (
        <div className="mt-4 space-y-3">
         <p className="text-sm text-[#6B5D55]">Choisis les jours travaillés. Exemple: lundi, mardi, jeudi, vendredi.</p>
         <div className="flex flex-wrap gap-2">
          {WEEKDAY_OPTIONS.map((day) => (
          <label key={`shift-day-${day.jsDay}`} className="inline-flex items-center gap-2 rounded-lg border border-[#D9D0C8] bg-white px-3 py-2 text-xs text-[#6B5D55]">
           <input
            type="checkbox"
            checked={Boolean(shiftRecurrenceDays[day.jsDay])}
            onChange={(event) =>
            setShiftRecurrenceDays((current) => ({
             ...current,
             [day.jsDay]: event.target.checked,
            }))
            }
           />
           {day.label}
          </label>
          ))}
         </div>
         <div className="grid gap-3 sm:grid-cols-2">
          <div>
          <label htmlFor="shiftRecurrenceStart-weekly" className="mb-1 block text-sm font-medium text-[#6B5D55]">Commence le</label>
          <input
           id="shiftRecurrenceStart-weekly"
           type="date"
           value={shiftRecurrenceStart}
           onChange={(event) => setShiftRecurrenceStart(event.target.value)}
           className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420]"
          />
          </div>
          <div>
          <label htmlFor="shiftRecurrenceEnd-weekly" className="mb-1 block text-sm font-medium text-[#6B5D55]">Se termine le (optionnel)</label>
          <input
           id="shiftRecurrenceEnd-weekly"
           type="date"
           value={shiftRecurrenceEnd}
           onChange={(event) => setShiftRecurrenceEnd(event.target.value)}
           className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420]"
          />
          </div>
         </div>
        </div>
        )}

        {shiftScheduleMode === "cycle" && (
        <div className="mt-4 space-y-3">
         <p className="text-sm text-[#6B5D55]">Exemple simple: si ton horaire recommence tous les 35 jours, entre 35 et la première journée de ce cycle.</p>
         <div className="grid gap-3 sm:grid-cols-2">
          <div>
          <label htmlFor="shiftCycleLengthDays" className="mb-1 block text-sm font-medium text-[#6B5D55]">Nombre de jours du cycle</label>
          <input
           id="shiftCycleLengthDays"
           type="number"
           min={1}
           value={shiftCycleLengthDays}
           onChange={(event) => setShiftCycleLengthDays(event.target.value)}
           className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420]"
           placeholder="35"
          />
          </div>
          <div>
          <label htmlFor="shiftRecurrenceStart-cycle" className="mb-1 block text-sm font-medium text-[#6B5D55]">Premier jour de ce cycle</label>
          <input
           id="shiftRecurrenceStart-cycle"
           type="date"
           value={shiftRecurrenceStart}
           onChange={(event) => setShiftRecurrenceStart(event.target.value)}
           className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420]"
          />
          </div>
         </div>
         <div>
          <label htmlFor="shiftRecurrenceEnd-cycle" className="mb-1 block text-sm font-medium text-[#6B5D55]">Fin du cycle (optionnel)</label>
          <input
          id="shiftRecurrenceEnd-cycle"
          type="date"
          value={shiftRecurrenceEnd}
          onChange={(event) => setShiftRecurrenceEnd(event.target.value)}
          className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420]"
          />
         </div>
        </div>
        )}
       </section>

       {(shiftEditMode === "override" || shiftEditMode === "edit") && (
        <section className="rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] p-3">
        <p className="text-xs font-semibold tracking-[0.14em] text-[#A89080]">CHANGEMENT DE SHIFT</p>
        <div className="mt-2 space-y-3">
         <div>
          <label htmlFor="shiftReason" className="mb-1 block text-sm font-medium text-[#6B5D55]">Raison du changement (optionnel)</label>
          <input
          id="shiftReason"
          type="text"
          value={shiftReason}
          onChange={(event) => setShiftReason(event.target.value)}
          className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420]"
          placeholder="Ex: échange avec collègue"
          />
         </div>
         <label className="inline-flex items-center gap-2 text-sm text-[#6B5D55]">
          <input
          type="checkbox"
          checked={shiftNotifyCoparent}
          onChange={(event) => setShiftNotifyCoparent(event.target.checked)}
          />
          Notifier le co-parent
         </label>
        </div>
        </section>
       )}

       <div className="mt-2 flex gap-2">
        <button
        type="submit"
        disabled={isSavingShift || isDeletingShift}
        className="flex-1 rounded-xl bg-[#2C3E50] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
        >
        {isSavingShift ? "Sauvegarde..." : "Sauvegarder le shift"}
        </button>
        {shiftEditMode !== "create" && (
        <button
         type="button"
         onClick={onDeleteShift}
         disabled={isSavingShift || isDeletingShift}
         className="flex-1 rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] px-4 py-3 text-sm font-semibold text-[#A85C52] disabled:cursor-not-allowed disabled:opacity-70"
        >
         {isDeletingShift ? "Suppression..." : "🗑️ Supprimer"}
        </button>
        )}
       </div>
      </form>
      </div>
     </div>
    )}

    {collectesFormOpen && (
     <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0F223680] p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/70 bg-white p-6 shadow-[0_20px_60px_rgba(15,36,54,0.22)]">
      <div className="mb-4 flex items-center justify-between">
       <h2 className="text-xl font-semibold text-[#2C2420]">🗑️ Collectes</h2>
       <button
        type="button"
        onClick={closeCollectesForm}
        className="rounded-lg border border-[#D9D0C8] px-2 py-1 text-sm text-[#6B5D55] hover:bg-[#EDE8E3]"
       >
        <X size={14} />
       </button>
      </div>

      {collectesError && (
       <p className="mb-4 rounded-xl border border-[#D9D0C8] bg-[#FDF0EE] px-3 py-2 text-sm text-[#A85C52]">
        {collectesError}
       </p>
      )}

      <form className="space-y-4" onSubmit={onSaveCollectes}>
       <div className="rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] p-4">
        <p className="text-xs font-semibold tracking-[0.14em] text-[#A89080]">RÈGLE PAR TYPE DE COLLECTE</p>
        <p className="mt-2 text-sm text-[#6B5D55]">Chaque collecte a son jour et son cycle. Tu peux par exemple mettre <span className="font-semibold">Ordures = Semaine A</span> et <span className="font-semibold">Recyclage = Semaine B</span>.</p>

        <div className="mt-4 space-y-3">
        <div className="rounded-xl border border-[#D9D0C8] bg-white p-3">
         <p className="text-sm font-semibold text-[#2C2420]">🗑️ Ordures</p>
         <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
          <label htmlFor="garbageDay" className="mb-1 block text-sm font-medium text-[#6B5D55]">Jour</label>
          <select id="garbageDay" value={collectesGarbageDay} onChange={(event) => setCollectesGarbageDay(event.target.value)} className="w-full rounded-xl border border-[#D9D0C8] bg-white px-3 py-2.5 text-[#2C2420]">
           {WEEKDAY_OPTIONS.map((day) => (
            <option key={`garbage-${day.jsDay}`} value={day.jsDay}>{day.label}</option>
           ))}
          </select>
          </div>
          <div>
          <label htmlFor="garbageCycle" className="mb-1 block text-sm font-medium text-[#6B5D55]">Cycle</label>
          <select id="garbageCycle" value={collectesGarbageCycle} onChange={(event) => setCollectesGarbageCycle(event.target.value as "weekly" | "A" | "B")} className="w-full rounded-xl border border-[#D9D0C8] bg-white px-3 py-2.5 text-[#2C2420]">
           <option value="weekly">Chaque semaine</option>
           <option value="A">Semaine A</option>
           <option value="B">Semaine B</option>
          </select>
          </div>
         </div>
        </div>

        <div className="rounded-xl border border-[#D9D0C8] bg-white p-3">
         <p className="text-sm font-semibold text-[#2C2420]">♻️ Recyclage</p>
         <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
          <label htmlFor="recyclingDay" className="mb-1 block text-sm font-medium text-[#6B5D55]">Jour</label>
          <select id="recyclingDay" value={collectesRecyclingDay} onChange={(event) => setCollectesRecyclingDay(event.target.value)} className="w-full rounded-xl border border-[#D9D0C8] bg-white px-3 py-2.5 text-[#2C2420]">
           {WEEKDAY_OPTIONS.map((day) => (
            <option key={`recycling-${day.jsDay}`} value={day.jsDay}>{day.label}</option>
           ))}
          </select>
          </div>
          <div>
          <label htmlFor="recyclingCycle" className="mb-1 block text-sm font-medium text-[#6B5D55]">Cycle</label>
          <select id="recyclingCycle" value={collectesRecyclingCycle} onChange={(event) => setCollectesRecyclingCycle(event.target.value as "weekly" | "A" | "B")} className="w-full rounded-xl border border-[#D9D0C8] bg-white px-3 py-2.5 text-[#2C2420]">
           <option value="weekly">Chaque semaine</option>
           <option value="A">Semaine A</option>
           <option value="B">Semaine B</option>
          </select>
          </div>
         </div>
        </div>

        <div className="rounded-xl border border-[#D9D0C8] bg-white p-3">
         <p className="text-sm font-semibold text-[#2C2420]">🌱 Compost</p>
         <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
          <label htmlFor="compostDay" className="mb-1 block text-sm font-medium text-[#6B5D55]">Jour</label>
          <select id="compostDay" value={collectesCompostDay} onChange={(event) => setCollectesCompostDay(event.target.value)} className="w-full rounded-xl border border-[#D9D0C8] bg-white px-3 py-2.5 text-[#2C2420]">
           {WEEKDAY_OPTIONS.map((day) => (
            <option key={`compost-${day.jsDay}`} value={day.jsDay}>{day.label}</option>
           ))}
          </select>
          </div>
          <div>
          <label htmlFor="compostCycle" className="mb-1 block text-sm font-medium text-[#6B5D55]">Cycle</label>
          <select id="compostCycle" value={collectesCompostCycle} onChange={(event) => setCollectesCompostCycle(event.target.value as "weekly" | "A" | "B")} className="w-full rounded-xl border border-[#D9D0C8] bg-white px-3 py-2.5 text-[#2C2420]">
           <option value="weekly">Chaque semaine</option>
           <option value="A">Semaine A</option>
           <option value="B">Semaine B</option>
          </select>
          </div>
         </div>
        </div>
        </div>
       </div>

       <button type="submit" disabled={isSavingCollectes} className="w-full rounded-xl bg-[#7C6B5D] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70">
        {isSavingCollectes ? "Sauvegarde..." : "Sauvegarder"}
       </button>
      </form>
      </div>
     </div>
    )}

   {scheduleFormOpen && (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0F223680] p-4 sm:items-center">
     <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/70 bg-white p-6 shadow-[0_20px_60px_rgba(15,36,54,0.22)]">
      <div className="mb-4 flex items-center justify-between">
       <h2 className="text-xl font-semibold text-[#2C2420]"> Horaire de garde</h2>
       <button
        type="button"
        onClick={closeScheduleForm}
        className="rounded-lg border border-[#D9D0C8] px-2 py-1 text-sm text-[#6B5D55] hover:bg-[#EDE8E3]"
       >
        <X size={14} />
       </button>
      </div>

      {scheduleError && (
       <p className="mb-4 rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] px-3 py-2 text-sm text-[#A85C52]">
        {scheduleError}
       </p>
      )}

      <form className="space-y-5" onSubmit={onApplyGuardSchedule}>
       <section className="rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] p-4">
        <p className="text-xs font-semibold tracking-[0.16em] text-[#A89080]">CONFIGURATION DE L'HORAIRE</p>
        <div className="mt-3">
         <label htmlFor="scheduleType" className="mb-1 block text-sm font-medium text-[#6B5D55]">
          Type d'horaire
         </label>
         <select
          id="scheduleType"
          value={scheduleType}
          onChange={(event) => setScheduleType(event.target.value as GuardScheduleType)}
          className="w-full rounded-xl border border-[#D9D0C8] bg-white px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
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
            <label className="flex items-center gap-2 text-sm text-[#6B5D55]">
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
              className="h-4 w-4 rounded border-[#C6D9EC] text-[#7C6B5D] focus:ring-[#7C6B5D]/30"
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
             className="w-full rounded-lg border border-[#D9D0C8] bg-white px-2 py-2 text-sm text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-2 focus:ring-[#7C6B5D]/20"
            >
             <option value="parent1">Parent 1</option>
             <option value="parent2">Parent 2</option>
            </select>
           </div>
          ))}
         </div>
        )}
       </section>

       <section className="rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] p-4">
        <p className="text-xs font-semibold tracking-[0.16em] text-[#A89080]">DÉTAILS DE L'ÉCHANGE</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
         <div>
          <label htmlFor="exchangeTime" className="mb-1 block text-sm font-medium text-[#6B5D55]">
           Heure de l'échange
          </label>
          <input
           id="exchangeTime"
           type="time"
           value={exchangeTime}
           onChange={(event) => setExchangeTime(event.target.value)}
           className="w-full rounded-xl border border-[#D9D0C8] bg-white px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
          />
         </div>
         <div>
          <label htmlFor="exchangeLocation" className="mb-1 block text-sm font-medium text-[#6B5D55]">
           Lieu de l'échange
          </label>
          <input
           id="exchangeLocation"
           type="text"
           value={exchangeLocation}
           onChange={(event) => setExchangeLocation(event.target.value)}
           placeholder="Ex: école, domicile"
           className="w-full rounded-xl border border-[#D9D0C8] bg-white px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
          />
         </div>
        </div>
       </section>

       <section className="rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] p-4">
        <p className="text-xs font-semibold tracking-[0.16em] text-[#A89080]">INFORMATIONS LÉGALES</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
         <div>
          <label htmlFor="legalContactName" className="mb-1 block text-sm font-medium text-[#6B5D55]">
           Nom du médiateur ou avocat
          </label>
          <input
           id="legalContactName"
           type="text"
           value={legalContactName}
           onChange={(event) => setLegalContactName(event.target.value)}
           className="w-full rounded-xl border border-[#D9D0C8] bg-white px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
          />
         </div>
         <div>
          <label htmlFor="legalCaseNumber" className="mb-1 block text-sm font-medium text-[#6B5D55]">
           Numéro de dossier (optionnel)
          </label>
          <input
           id="legalCaseNumber"
           type="text"
           value={legalCaseNumber}
           onChange={(event) => setLegalCaseNumber(event.target.value)}
           className="w-full rounded-xl border border-[#D9D0C8] bg-white px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
          />
         </div>
         <div className="sm:col-span-2">
          <label htmlFor="agreementDate" className="mb-1 block text-sm font-medium text-[#6B5D55]">
           Date de l'entente
          </label>
          <input
           id="agreementDate"
           type="date"
           value={agreementDate}
           onChange={(event) => setAgreementDate(event.target.value)}
           className="w-full rounded-xl border border-[#D9D0C8] bg-white px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
          />
         </div>
         <div className="sm:col-span-2">
          <label htmlFor="mediatorNotes" className="mb-1 block text-sm font-medium text-[#6B5D55]">
           Notes du médiateur
          </label>
          <textarea
           id="mediatorNotes"
           value={mediatorNotes}
           onChange={(event) => setMediatorNotes(event.target.value)}
           rows={4}
           className="w-full rounded-xl border border-[#D9D0C8] bg-white px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
          />
         </div>
        </div>
       </section>

       <button
        type="submit"
        disabled={isApplyingSchedule}
        className="w-full rounded-xl bg-[#7C6B5D] px-4 py-3 text-sm font-semibold text-white shadow-[0_1px_4px_rgba(44,36,32,0.12)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
       >
            {isApplyingSchedule ? <><Loader size={14} className="mr-2 inline animate-spin" />En cours...</> : "Appliquer au calendrier"}
       </button>
      </form>
     </div>
    </div>
   )}

   {schoolImportOpen && (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0F223680] p-4 sm:items-center">
     <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/70 bg-white p-6 shadow-[0_20px_60px_rgba(15,36,54,0.22)]">
      <div className="mb-4 flex items-center justify-between gap-2">
      <h2 className="text-xl font-semibold text-[#2C2420]">Calendrier scolaire</h2>
       <button
        type="button"
        onClick={closeSchoolImportModal}
        disabled={isLoadingSchoolBoardDates || isImportingSchoolDates}
        className="rounded-lg border border-[#D9D0C8] px-2 py-1 text-sm text-[#6B5D55] hover:bg-[#EDE8E3] disabled:cursor-not-allowed disabled:opacity-70"
       >
      <X size={14} />
       </button>
      </div>

      {schoolImportError && (
       <p className="mb-4 rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] px-3 py-2 text-sm text-[#A85C52]">
        {schoolImportError}
       </p>
      )}

      <div className="rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] p-4">
       <label htmlFor="school-board" className="mb-2 block text-sm font-semibold text-[#6B5D55]">
        Choisissez votre commission scolaire :
       </label>
       <select
        id="school-board"
        value={selectedSchoolBoard}
        onChange={(event) => {
         void onSchoolBoardChange(event.target.value as SchoolBoardOption);
        }}
        disabled={isLoadingSchoolBoardDates || isImportingSchoolDates}
        className="w-full rounded-xl border border-[#D9D0C8] bg-white px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20 disabled:cursor-not-allowed disabled:opacity-70"
       >
        <option value="">Sélectionner</option>
        <option value="cssp">CSS des Patriotes (CSSP)</option>
        <option value="other">Autre (bientôt disponible)</option>
       </select>
       {isLoadingSchoolBoardDates && <p className="mt-3 text-sm text-[#6B5D55]">Chargement des dates CSSP...</p>}
       {selectedSchoolBoard === "other" && !isLoadingSchoolBoardDates && (
        <p className="mt-3 text-sm text-[#6B5D55]">Autre (bientôt disponible).</p>
       )}
      </div>

      {selectedSchoolBoard === "cssp" && detectedSchoolDates.length > 0 && (
       <div className="mt-4 rounded-xl border border-[#D9D0C8] bg-white p-4">
        <p className="text-xs font-semibold tracking-[0.16em] text-[#A89080]">DATES CSSP DISPONIBLES</p>
        {csspAlreadyImported && (
         <p className="mt-3 rounded-lg border border-[#F1D29B] bg-[#FFF9ED] px-3 py-2 text-sm text-[#8A6120]">
          📚 Calendrier CSSP déjà importé — Voulez-vous le réimporter ?
         </p>
        )}
        <div className="mt-3 space-y-2">
         {detectedSchoolDates.map((item) => {
          const typeUi = item.type === "pedagogique"
                ? { label: "Journées pédagogiques", color: "#D9A74A" }
           : item.type === "scolaire"
                  ? { label: "Rentrée scolaire", color: "#7C6B5D" }
                  : { label: "Vacances / Relâche", color: "#6B8F71" };
          return (
           <label
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E0EBF6] bg-[#F5F0EB] px-3 py-2"
           >
            <span className="flex items-center gap-2 text-sm text-[#6B5D55]">
             <input
              type="checkbox"
              checked={Boolean(selectedSchoolDateIds[item.id])}
              onChange={() => toggleSchoolDateSelection(item.id)}
              className="h-4 w-4 rounded border-[#C6D9EC] text-[#7C6B5D] focus:ring-[#7C6B5D]/30"
             />
             <span>{formatDateLabel(item.date)}</span>
             <span>·</span>
             <span>{item.description}</span>
            </span>
            <span
             className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold"
             style={{ borderColor: typeUi.color, color: typeUi.color }}
            >
             <span>{typeUi.label}</span>
            </span>
           </label>
          );
         })}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
         <p className="text-sm text-[#6B5D55]">{selectedSchoolDatesCount} date(s) sélectionnée(s)</p>
         <div className="flex flex-wrap gap-2">
          <button
           type="button"
           onClick={onImportSelectedSchoolDates}
           disabled={isImportingSchoolDates || isLoadingSchoolBoardDates}
           className="rounded-xl bg-[#6B8F71] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
          >
                {isImportingSchoolDates ? "Ajout..." : "Ajouter au calendrier"}
          </button>
          <button
           type="button"
           onClick={closeSchoolImportModal}
           disabled={isImportingSchoolDates || isLoadingSchoolBoardDates}
           className="rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] px-4 py-2 text-sm font-semibold text-[#A85C52] transition hover:bg-[#FFECEF] disabled:cursor-not-allowed disabled:opacity-70"
          >
                  Annuler
          </button>
         </div>
        </div>
       </div>
      )}
     </div>
    </div>
   )}

   {decisionOpen && (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0F223680] p-4 sm:items-center">
     <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/70 bg-white p-6 shadow-[0_20px_60px_rgba(15,36,54,0.22)]">
      <div className="mb-4 flex items-center justify-between">
       <h2 className="text-xl font-semibold text-[#2C2420]">
        {decisionType === "accept" ? "Accepter la demande" : "Refuser la demande"}
       </h2>
       <button
        type="button"
        onClick={closeDecisionModal}
        className="rounded-lg border border-[#D9D0C8] px-2 py-1 text-sm text-[#6B5D55] hover:bg-[#EDE8E3]"
       >
            <X size={14} />
       </button>
      </div>

      {decisionError && (
       <p className="mb-4 rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] px-3 py-2 text-sm text-[#A85C52]">
        {decisionError}
       </p>
      )}

      <form className="space-y-4" onSubmit={onSubmitDecision}>
       {decisionType === "refuse" && (
        <div>
         <label htmlFor="decisionReason" className="mb-1 block text-sm font-medium text-[#6B5D55]">
          Raison du refus
         </label>
         <textarea
          id="decisionReason"
          value={decisionReason}
          onChange={(event) => setDecisionReason(event.target.value)}
          rows={4}
          className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
          placeholder="Expliquez la raison du refus..."
         />
        </div>
       )}

       <button
        type="submit"
        disabled={isSubmittingDecision}
        className="w-full rounded-xl bg-[#7C6B5D] px-4 py-3 text-sm font-semibold text-white shadow-[0_1px_4px_rgba(44,36,32,0.12)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
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
    <div className="fixed right-4 bottom-4 z-[60] max-w-sm rounded-xl border border-[#D9D0C8] bg-[#EDE8E3] px-4 py-3 text-sm font-medium text-[#6B8F71] shadow-[0_14px_30px_rgba(45,105,64,0.2)]">
     {toast.message}
    </div>
   )}
  </div>
 );
}
