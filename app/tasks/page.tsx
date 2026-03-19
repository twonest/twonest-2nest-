"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Check,
  CheckSquare,
  ChevronDown,
  ClipboardList,
  DollarSign,
  Heart,
  Home,
  Paperclip,
  Plus,
  ShoppingCart,
  Users,
  Wrench,
  X,
} from "lucide-react";
import AccessDeniedCard from "@/components/AccessDeniedCard";
import { useFamily } from "@/components/FamilyProvider";
import { getFeatureAccess } from "@/lib/family";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type TaskView = "list" | "kanban" | "history";
type ScopeFilter = "all" | "mine" | "child" | "category";
type TaskStatus = "todo" | "in_progress" | "done";
type TaskPriority = "high" | "normal" | "low";
type RecurrenceFrequency = "daily" | "weekly" | "monthly";
type AssigneeKind = "member" | "child";
type CategoryKey = "home" | "shopping" | "children" | "medical" | "school" | "finance" | "maintenance" | "general";

type TaskRow = Record<string, unknown>;

type TaskItem = {
  id: string;
  familyId: string;
  title: string;
  description: string;
  category: CategoryKey;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  assignedKind: AssigneeKind;
  assignedUserId: string | null;
  assignedChildId: string | null;
  linkedChildId: string | null;
  points: number;
  proofUrl: string | null;
  proofPath: string | null;
  completedAt: string | null;
  completedBy: string | null;
  isRecurring: boolean;
  recurrenceFrequency: RecurrenceFrequency | null;
  recurrenceWeekday: number | null;
  recurrenceMonthday: number | null;
  createdAt: string;
};

type Member = {
  userId: string;
  role: string;
  displayName: string;
  avatarUrl: string | null;
};

type Child = {
  id: string;
  displayName: string;
};

type AssigneeOption = {
  id: string;
  label: string;
  kind: AssigneeKind;
  userId: string | null;
  childId: string | null;
};

type Reward = {
  id: string;
  label: string;
  pointsRequired: number;
};

type ToastState = {
  message: string;
  variant: "success" | "error";
};

type CategoryMeta = {
  key: CategoryKey;
  label: string;
  icon: LucideIcon;
  badgeClass: string;
};

type PendingProof = {
  taskId: string;
  title: string;
};

const WEEK_DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

const CATEGORIES: CategoryMeta[] = [
  { key: "home", label: "Maison", icon: Home, badgeClass: "bg-[#ECE5DC] text-[#6E6157]" },
  { key: "shopping", label: "Courses", icon: ShoppingCart, badgeClass: "bg-[#F0E7DB] text-[#8A694B]" },
  { key: "children", label: "Enfants", icon: Users, badgeClass: "bg-[#E8E3DB] text-[#5F6C68]" },
  { key: "medical", label: "Medical", icon: Heart, badgeClass: "bg-[#F3E3DE] text-[#9A5A4F]" },
  { key: "school", label: "Scolaire", icon: BookOpen, badgeClass: "bg-[#EDE8DF] text-[#58606D]" },
  { key: "finance", label: "Finances", icon: DollarSign, badgeClass: "bg-[#ECE9DF] text-[#6D6457]" },
  { key: "maintenance", label: "Entretien", icon: Wrench, badgeClass: "bg-[#E8E5DF] text-[#66625A]" },
  { key: "general", label: "General", icon: ClipboardList, badgeClass: "bg-[#EDE8E3] text-[#5F5A55]" },
];

function getCategoryMeta(category: CategoryKey): CategoryMeta {
  return CATEGORIES.find((item) => item.key === category) ?? CATEGORIES[CATEGORIES.length - 1];
}

function extractMissingColumn(message: string): string | null {
  const match = message.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+does not exist/i);
  if (match?.[1]) {
    return match[1];
  }

  const cacheMatch = message.match(/Could not find the ['\"]?([a-zA-Z0-9_]+)['\"]? column/i);
  return cacheMatch?.[1] ?? null;
}

function normalizeTaskStatus(value: unknown, completedAt: string | null): TaskStatus {
  if (completedAt) {
    return "done";
  }

  if (typeof value !== "string") {
    return "todo";
  }

  const normalized = value.toLowerCase();
  if (normalized === "done" || normalized === "fait" || normalized === "completed") {
    return "done";
  }
  if (normalized === "in_progress" || normalized === "en_cours") {
    return "in_progress";
  }
  return "todo";
}

function normalizeTaskPriority(value: unknown): TaskPriority {
  if (typeof value !== "string") {
    return "normal";
  }

  const normalized = value.toLowerCase();
  if (["high", "haute", "urgent", "haute_priorite"].includes(normalized)) {
    return "high";
  }
  if (["low", "basse", "faible"].includes(normalized)) {
    return "low";
  }
  return "normal";
}

function normalizeCategory(value: unknown): CategoryKey {
  if (typeof value !== "string") {
    return "general";
  }

  const normalized = value.toLowerCase();
  if (["home", "maison"].includes(normalized)) return "home";
  if (["shopping", "courses"].includes(normalized)) return "shopping";
  if (["children", "enfants"].includes(normalized)) return "children";
  if (["medical", "medicale", "medical"].includes(normalized)) return "medical";
  if (["school", "scolaire"].includes(normalized)) return "school";
  if (["finance", "finances"].includes(normalized)) return "finance";
  if (["maintenance", "entretien"].includes(normalized)) return "maintenance";
  return "general";
}

function normalizeRecurrenceFrequency(value: unknown): RecurrenceFrequency | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.toLowerCase();
  if (normalized === "daily" || normalized === "quotidienne") return "daily";
  if (normalized === "weekly" || normalized === "hebdomadaire") return "weekly";
  if (normalized === "monthly" || normalized === "mensuelle") return "monthly";
  return null;
}

function normalizeAssigneeKind(value: unknown): AssigneeKind {
  if (typeof value === "string" && value.toLowerCase() === "child") {
    return "child";
  }
  return "member";
}

function toIsoDateOnly(value: string): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function toDateInputValue(value: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function isOverdue(dueDate: string | null, completedAt: string | null): boolean {
  if (!dueDate || completedAt) {
    return false;
  }

  const now = new Date();
  const due = new Date(dueDate);
  return due.getTime() < now.getTime();
}

function isToday(dueDate: string | null): boolean {
  if (!dueDate) {
    return false;
  }

  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) {
    return false;
  }

  const now = new Date();
  return (
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate()
  );
}

function formatDueDateLabel(value: string | null): string {
  if (!value) {
    return "Sans echeance";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Sans echeance";
  }

  return date.toLocaleDateString("fr-CA", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("fr-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function safeText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function safeNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function clampPoints(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.min(10, Math.max(1, Math.round(value)));
}

function getInitials(name: string): string {
  const chunks = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (chunks.length === 0) {
    return "?";
  }

  return chunks.map((chunk) => chunk[0]?.toUpperCase() ?? "").join("");
}

export default function TasksPage() {
  const router = useRouter();
  const { activeFamilyId, user: familyUser, currentRole, currentPermissions } = useFamily();

  const [user, setUser] = useState<User | null>(familyUser);
  const [checkingSession, setCheckingSession] = useState(true);
  const [configError, setConfigError] = useState("");
  const [listError, setListError] = useState("");
  const [toast, setToast] = useState<ToastState | null>(null);

  const [view, setView] = useState<TaskView>("list");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [selectedChildFilter, setSelectedChildFilter] = useState("all");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<CategoryKey>("general");

  const [members, setMembers] = useState<Member[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [isSavingReward, setIsSavingReward] = useState(false);

  const [pendingProof, setPendingProof] = useState<PendingProof | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isCompletingTask, setIsCompletingTask] = useState(false);

  const [historyMemberFilter, setHistoryMemberFilter] = useState("all");
  const [historyMonthFilter, setHistoryMonthFilter] = useState("all");

  const [selectedPointsChildId, setSelectedPointsChildId] = useState("all");
  const [rewardLabel, setRewardLabel] = useState("");
  const [rewardPoints, setRewardPoints] = useState("50");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<CategoryKey>("general");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [dueDate, setDueDate] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency>("weekly");
  const [recurrenceWeekday, setRecurrenceWeekday] = useState("1");
  const [recurrenceMonthday, setRecurrenceMonthday] = useState("1");
  const [linkedChildId, setLinkedChildId] = useState("none");
  const [points, setPoints] = useState("3");

  const tasksAccess = currentRole
    ? getFeatureAccess("tasks", currentRole, currentPermissions)
    : { allowed: true, readOnly: false, reason: "" };

  const assigneeOptions = useMemo<AssigneeOption[]>(() => {
    const options: AssigneeOption[] = [];

    const parentMembers = members.filter((member) => member.role === "parent");
    const regularMembers = members.filter((member) => member.role !== "parent");

    if (parentMembers[0]) {
      options.push({
        id: `member:${parentMembers[0].userId}`,
        label: "Parent 1",
        kind: "member",
        userId: parentMembers[0].userId,
        childId: null,
      });
    }

    if (parentMembers[1]) {
      options.push({
        id: `member:${parentMembers[1].userId}`,
        label: "Parent 2",
        kind: "member",
        userId: parentMembers[1].userId,
        childId: null,
      });
    }

    for (const member of regularMembers) {
      options.push({
        id: `member:${member.userId}`,
        label: member.displayName,
        kind: "member",
        userId: member.userId,
        childId: null,
      });
    }

    for (const child of children) {
      options.push({
        id: `child:${child.id}`,
        label: child.displayName,
        kind: "child",
        userId: null,
        childId: child.id,
      });
    }

    return options;
  }, [children, members]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!assigneeId && assigneeOptions.length > 0) {
      setAssigneeId(assigneeOptions[0].id);
    }
  }, [assigneeId, assigneeOptions]);

  const memberById = useMemo(() => {
    const map = new Map<string, Member>();
    for (const member of members) {
      map.set(member.userId, member);
    }
    return map;
  }, [members]);

  const childById = useMemo(() => {
    const map = new Map<string, Child>();
    for (const child of children) {
      map.set(child.id, child);
    }
    return map;
  }, [children]);

  const resolveAssignee = (task: TaskItem): { label: string; avatar: string | null; initials: string } => {
    if (task.assignedKind === "child" && task.assignedChildId) {
      const child = childById.get(task.assignedChildId);
      const label = child?.displayName ?? "Enfant";
      return { label, avatar: null, initials: getInitials(label) };
    }

    if (task.assignedUserId) {
      const member = memberById.get(task.assignedUserId);
      const label = member?.displayName ?? "Membre";
      return { label, avatar: member?.avatarUrl ?? null, initials: getInitials(label) };
    }

    return { label: "Non assignee", avatar: null, initials: "?" };
  };

  const resolveCompletedBy = (task: TaskItem): string => {
    if (!task.completedBy) {
      return "Membre inconnu";
    }

    const member = memberById.get(task.completedBy);
    return member?.displayName ?? "Membre inconnu";
  };

  const refreshMembersChildren = async (familyId: string) => {
    const supabase = getSupabaseBrowserClient();

    const membersResponse = await supabase
      .from("family_members")
      .select("user_id, role")
      .eq("family_id", familyId)
      .eq("status", "active");

    const memberRows = ((membersResponse.data ?? []) as Array<Record<string, unknown>>).filter(
      (item) => typeof item.user_id === "string",
    );

    const userIds = Array.from(new Set(memberRows.map((item) => String(item.user_id))));

    const profilesResponse = userIds.length
      ? await supabase
          .from("profiles")
          .select("user_id, first_name, last_name, prenom, nom, avatar_url, photo_url, email")
          .in("user_id", userIds)
      : { data: [] as Array<Record<string, unknown>> };

    const profileMap = new Map<string, Record<string, unknown>>();
    for (const profile of (profilesResponse.data ?? []) as Array<Record<string, unknown>>) {
      if (typeof profile.user_id === "string") {
        profileMap.set(profile.user_id, profile);
      }
    }

    const mappedMembers: Member[] = memberRows.map((row) => {
      const userId = String(row.user_id);
      const profile = profileMap.get(userId);
      const firstName = safeText(profile?.first_name ?? profile?.prenom).trim();
      const lastName = safeText(profile?.last_name ?? profile?.nom).trim();
      const email = safeText(profile?.email);
      const displayName = `${firstName} ${lastName}`.trim() || (email.includes("@") ? email.split("@")[0] : "Parent");
      const avatarUrl = safeText(profile?.avatar_url ?? profile?.photo_url).trim() || null;

      return {
        userId,
        role: safeText(row.role, "parent"),
        displayName,
        avatarUrl,
      };
    });

    setMembers(mappedMembers);

    const childrenResponse = await supabase
      .from("children")
      .select("id, first_name, last_name, prenom, nom")
      .eq("family_id", familyId)
      .order("created_at", { ascending: true });

    const mappedChildren: Child[] = ((childrenResponse.data ?? []) as Array<Record<string, unknown>>)
      .map((row) => {
        const id = typeof row.id === "string" || typeof row.id === "number" ? String(row.id) : "";
        if (!id) {
          return null;
        }
        const firstName = safeText(row.first_name ?? row.prenom, "Enfant").trim();
        const lastName = safeText(row.last_name ?? row.nom).trim();
        const displayName = `${firstName} ${lastName}`.trim();
        return { id, displayName };
      })
      .filter((child): child is Child => child !== null);

    setChildren(mappedChildren);

    if (mappedChildren.length > 0 && selectedPointsChildId === "all") {
      setSelectedPointsChildId(mappedChildren[0].id);
    }
  };

  const refreshTasks = async (familyId: string) => {
    const supabase = getSupabaseBrowserClient();
    const response = await supabase
      .from("tasks")
      .select("*")
      .eq("family_id", familyId)
      .order("created_at", { ascending: false });

    if (response.error) {
      setListError(response.error.message);
      setTasks([]);
      return;
    }

    const mapped: TaskItem[] = ((response.data ?? []) as TaskRow[])
      .map((row) => {
        const id = typeof row.id === "string" || typeof row.id === "number" ? String(row.id) : "";
        const familyIdRaw = safeText(row.family_id);
        const titleRaw = safeText(row.title ?? row.titre);
        if (!id || !familyIdRaw || !titleRaw) {
          return null;
        }

        const completedAt = safeText(row.completed_at) || null;
        const status = normalizeTaskStatus(row.status, completedAt);
        const assignedKind = normalizeAssigneeKind(row.assigned_kind ?? row.assigned_type);
        const assignedUserId = safeText(row.assigned_user_id ?? row.assignee_user_id) || null;
        const assignedChildId = safeText(row.assigned_child_id ?? row.child_id) || null;

        return {
          id,
          familyId: familyIdRaw,
          title: titleRaw,
          description: safeText(row.description),
          category: normalizeCategory(row.category),
          status,
          priority: normalizeTaskPriority(row.priority),
          dueDate: safeText(row.due_date) || null,
          assignedKind,
          assignedUserId,
          assignedChildId,
          linkedChildId: safeText(row.linked_child_id ?? row.related_child_id) || null,
          points: clampPoints(safeNumber(row.points, 3)),
          proofUrl: safeText(row.proof_url ?? row.photo_url) || null,
          proofPath: safeText(row.proof_path) || null,
          completedAt,
          completedBy: safeText(row.completed_by) || null,
          isRecurring: Boolean(row.is_recurring),
          recurrenceFrequency: normalizeRecurrenceFrequency(row.recurrence_frequency),
          recurrenceWeekday: row.recurrence_weekday === null ? null : safeNumber(row.recurrence_weekday, 0),
          recurrenceMonthday: row.recurrence_monthday === null ? null : safeNumber(row.recurrence_monthday, 1),
          createdAt: safeText(row.created_at, new Date().toISOString()),
        };
      })
      .filter((item): item is TaskItem => item !== null);

    setListError("");
    setTasks(mapped);
  };

  const refreshRewards = async (familyId: string) => {
    const supabase = getSupabaseBrowserClient();
    const response = await supabase
      .from("task_rewards")
      .select("id, label, points_required")
      .eq("family_id", familyId)
      .order("points_required", { ascending: true });

    if (response.error) {
      setRewards([]);
      return;
    }

    const mapped: Reward[] = ((response.data ?? []) as Array<Record<string, unknown>>)
      .map((row) => {
        const id = typeof row.id === "string" || typeof row.id === "number" ? String(row.id) : "";
        const label = safeText(row.label);
        const pointsRequired = safeNumber(row.points_required, 0);
        if (!id || !label || pointsRequired <= 0) {
          return null;
        }
        return { id, label, pointsRequired };
      })
      .filter((item): item is Reward => item !== null);

    setRewards(mapped);
  };

  useEffect(() => {
    let channelTasksCleanup: (() => void) | null = null;
    let channelRewardsCleanup: (() => void) | null = null;

    const init = async () => {
      let supabase;

      try {
        supabase = getSupabaseBrowserClient();
      } catch (error) {
        setConfigError(error instanceof Error ? error.message : "Configuration Supabase manquante.");
        setCheckingSession(false);
        return;
      }

      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/");
        return;
      }

      setUser(data.user);

      if (!activeFamilyId) {
        setListError("Aucun espace actif selectionne.");
        setCheckingSession(false);
        setIsLoading(false);
        return;
      }

      await refreshMembersChildren(activeFamilyId);
      await refreshTasks(activeFamilyId);
      await refreshRewards(activeFamilyId);

      const tasksChannel = supabase
        .channel(`tasks-live-${activeFamilyId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "tasks",
            filter: `family_id=eq.${activeFamilyId}`,
          },
          async () => {
            await refreshTasks(activeFamilyId);
          },
        )
        .subscribe();

      channelTasksCleanup = () => {
        tasksChannel.unsubscribe();
      };

      const rewardsChannel = supabase
        .channel(`task-rewards-live-${activeFamilyId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "task_rewards",
            filter: `family_id=eq.${activeFamilyId}`,
          },
          async () => {
            await refreshRewards(activeFamilyId);
          },
        )
        .subscribe();

      channelRewardsCleanup = () => {
        rewardsChannel.unsubscribe();
      };

      setCheckingSession(false);
      setIsLoading(false);
    };

    void init();

    return () => {
      channelTasksCleanup?.();
      channelRewardsCleanup?.();
    };
  }, [activeFamilyId, router]);

  const currentMonthOptions = useMemo(() => {
    const set = new Set<string>();
    for (const task of tasks) {
      if (!task.completedAt) {
        continue;
      }
      const date = new Date(task.completedAt);
      if (Number.isNaN(date.getTime())) {
        continue;
      }
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      set.add(month);
    }

    return ["all", ...Array.from(set.values()).sort((a, b) => b.localeCompare(a))];
  }, [tasks]);

  const scopedTasks = useMemo(() => {
    const base = tasks.filter((task) => task.completedAt === null);

    if (scopeFilter === "mine" && user) {
      return base.filter((task) => task.assignedKind === "member" && task.assignedUserId === user.id);
    }

    if (scopeFilter === "child") {
      if (selectedChildFilter === "all") {
        return base.filter((task) => task.assignedKind === "child");
      }
      return base.filter((task) => task.assignedKind === "child" && task.assignedChildId === selectedChildFilter);
    }

    if (scopeFilter === "category") {
      return base.filter((task) => task.category === selectedCategoryFilter);
    }

    return base;
  }, [scopeFilter, selectedCategoryFilter, selectedChildFilter, tasks, user]);

  const historyTasks = useMemo(() => {
    let items = tasks.filter((task) => task.completedAt !== null);

    if (historyMemberFilter !== "all") {
      if (historyMemberFilter === "me" && user) {
        items = items.filter((task) => task.completedBy === user.id);
      } else {
        items = items.filter((task) => {
          if (historyMemberFilter.startsWith("member:")) {
            const userId = historyMemberFilter.replace("member:", "");
            return task.assignedUserId === userId || task.completedBy === userId;
          }

          if (historyMemberFilter.startsWith("child:")) {
            const childId = historyMemberFilter.replace("child:", "");
            return task.assignedChildId === childId || task.linkedChildId === childId;
          }

          return true;
        });
      }
    }

    if (historyMonthFilter !== "all") {
      items = items.filter((task) => {
        if (!task.completedAt) {
          return false;
        }
        const date = new Date(task.completedAt);
        if (Number.isNaN(date.getTime())) {
          return false;
        }
        const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        return month === historyMonthFilter;
      });
    }

    return items.sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  }, [historyMemberFilter, historyMonthFilter, tasks, user]);

  const kanbanGroups = useMemo(() => {
    const todo = scopedTasks.filter((task) => task.status === "todo");
    const inProgress = scopedTasks.filter((task) => task.status === "in_progress");
    const done = tasks.filter((task) => task.status === "done");

    return { todo, inProgress, done };
  }, [scopedTasks, tasks]);

  const childPointsById = useMemo(() => {
    const map = new Map<string, number>();

    for (const task of tasks) {
      if (!task.completedAt || task.assignedKind !== "child" || !task.assignedChildId) {
        continue;
      }
      map.set(task.assignedChildId, (map.get(task.assignedChildId) ?? 0) + task.points);
    }

    return map;
  }, [tasks]);

  const selectedChildPoints = useMemo(() => {
    if (selectedPointsChildId === "all") {
      return 0;
    }

    return childPointsById.get(selectedPointsChildId) ?? 0;
  }, [childPointsById, selectedPointsChildId]);

  const nextReward = useMemo(() => {
    const sorted = [...rewards].sort((a, b) => a.pointsRequired - b.pointsRequired);
    return sorted.find((reward) => reward.pointsRequired > selectedChildPoints) ?? null;
  }, [rewards, selectedChildPoints]);

  const progressPercent = useMemo(() => {
    if (!nextReward) {
      return 100;
    }

    return Math.max(0, Math.min(100, Math.round((selectedChildPoints / nextReward.pointsRequired) * 100)));
  }, [nextReward, selectedChildPoints]);

  const resetTaskForm = () => {
    setTitle("");
    setDescription("");
    setCategory("general");
    setAssigneeId(assigneeOptions[0]?.id ?? "");
    setPriority("normal");
    setDueDate("");
    setIsRecurring(false);
    setRecurrenceFrequency("weekly");
    setRecurrenceWeekday("1");
    setRecurrenceMonthday("1");
    setLinkedChildId("none");
    setPoints("3");
  };

  const createTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!activeFamilyId || tasksAccess.readOnly) {
      return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setToast({ message: "Le titre est requis.", variant: "error" });
      return;
    }

    const selectedAssignee = assigneeOptions.find((option) => option.id === assigneeId);
    if (!selectedAssignee) {
      setToast({ message: "Selectionnez un responsable.", variant: "error" });
      return;
    }

    const nowIso = new Date().toISOString();
    const dueDateIso = toIsoDateOnly(dueDate);

    let payload: Record<string, unknown> = {
      family_id: activeFamilyId,
      title: trimmedTitle,
      description: description.trim() || null,
      category,
      status: "todo",
      priority,
      due_date: dueDateIso,
      assigned_kind: selectedAssignee.kind,
      assigned_user_id: selectedAssignee.userId,
      assigned_child_id: selectedAssignee.childId,
      linked_child_id: linkedChildId === "none" ? null : linkedChildId,
      points: selectedAssignee.kind === "child" ? clampPoints(Number(points)) : null,
      is_recurring: isRecurring,
      recurrence_frequency: isRecurring ? recurrenceFrequency : null,
      recurrence_weekday: isRecurring && recurrenceFrequency === "weekly" ? Number(recurrenceWeekday) : null,
      recurrence_monthday: isRecurring && recurrenceFrequency === "monthly" ? Number(recurrenceMonthday) : null,
      created_at: nowIso,
      updated_at: nowIso,
    };

    setIsSavingTask(true);

    try {
      const supabase = getSupabaseBrowserClient();

      for (let attempt = 0; attempt < 10; attempt += 1) {
        const response = await supabase.from("tasks").insert(payload).select("id").maybeSingle();

        if (!response.error) {
          setIsAddModalOpen(false);
          resetTaskForm();
          setToast({ message: "Tache ajoutee.", variant: "success" });
          await refreshTasks(activeFamilyId);
          return;
        }

        const missingColumn = extractMissingColumn(response.error.message);
        if (missingColumn && Object.prototype.hasOwnProperty.call(payload, missingColumn)) {
          const next = { ...payload };
          delete next[missingColumn];
          payload = next;
          continue;
        }

        throw new Error(response.error.message);
      }

      throw new Error("Insertion impossible: schema tasks incompatible.");
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Impossible d'ajouter la tache.", variant: "error" });
    } finally {
      setIsSavingTask(false);
    }
  };

  const uploadProof = async (taskId: string, file: File): Promise<{ url: string; path: string }> => {
    if (!activeFamilyId) {
      throw new Error("Aucun espace actif selectionne.");
    }

    const supabase = getSupabaseBrowserClient();
    const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${activeFamilyId}/${taskId}/${Date.now()}-${sanitized}`;

    const upload = await supabase.storage.from("tasks").upload(path, file, { upsert: false });
    if (upload.error) {
      throw new Error(`${upload.error.message}. Verifiez le bucket Storage 'tasks'.`);
    }

    const { data } = supabase.storage.from("tasks").getPublicUrl(path);
    return { url: data.publicUrl, path };
  };

  const updateTask = async (taskId: string, patch: Record<string, unknown>) => {
    const supabase = getSupabaseBrowserClient();
    let payload: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() };

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const response = await supabase.from("tasks").update(payload).eq("id", taskId);
      if (!response.error) {
        return;
      }

      const missingColumn = extractMissingColumn(response.error.message);
      if (missingColumn && Object.prototype.hasOwnProperty.call(payload, missingColumn)) {
        const next = { ...payload };
        delete next[missingColumn];
        payload = next;
        continue;
      }

      throw new Error(response.error.message);
    }

    throw new Error("Mise a jour impossible: schema tasks incompatible.");
  };

  const completeTask = async () => {
    if (!pendingProof || !user) {
      return;
    }

    setIsCompletingTask(true);

    try {
      let proofUrl: string | null = null;
      let proofPath: string | null = null;

      if (proofFile) {
        const uploaded = await uploadProof(pendingProof.taskId, proofFile);
        proofUrl = uploaded.url;
        proofPath = uploaded.path;
      }

      await updateTask(pendingProof.taskId, {
        status: "done",
        completed_at: new Date().toISOString(),
        completed_by: user.id,
        proof_url: proofUrl,
        proof_path: proofPath,
      });

      setPendingProof(null);
      setProofFile(null);
      setToast({ message: "Tache terminee.", variant: "success" });

      if (activeFamilyId) {
        await refreshTasks(activeFamilyId);
      }
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Impossible de terminer la tache.", variant: "error" });
    } finally {
      setIsCompletingTask(false);
    }
  };

  const onToggleTask = async (task: TaskItem, checked: boolean) => {
    if (tasksAccess.readOnly || !user) {
      return;
    }

    if (checked) {
      setPendingProof({ taskId: task.id, title: task.title });
      return;
    }

    try {
      await updateTask(task.id, {
        status: "todo",
        completed_at: null,
        completed_by: null,
      });

      if (activeFamilyId) {
        await refreshTasks(activeFamilyId);
      }
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Impossible de rouvrir la tache.", variant: "error" });
    }
  };

  const onChangeTaskStatus = async (taskId: string, status: TaskStatus) => {
    if (tasksAccess.readOnly) {
      return;
    }

    try {
      const patch: Record<string, unknown> = { status };
      if (status !== "done") {
        patch.completed_at = null;
        patch.completed_by = null;
      }
      await updateTask(taskId, patch);
      if (activeFamilyId) {
        await refreshTasks(activeFamilyId);
      }
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Impossible de changer le statut.", variant: "error" });
    }
  };

  const addReward = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!activeFamilyId || tasksAccess.readOnly) {
      return;
    }

    const trimmed = rewardLabel.trim();
    const pointsRequired = Math.max(1, Math.round(Number(rewardPoints)));

    if (!trimmed) {
      setToast({ message: "Nom de recompense requis.", variant: "error" });
      return;
    }

    setIsSavingReward(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const response = await supabase.from("task_rewards").insert({
        family_id: activeFamilyId,
        label: trimmed,
        points_required: pointsRequired,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      setRewardLabel("");
      setRewardPoints("50");
      setToast({ message: "Recompense enregistree.", variant: "success" });
      await refreshRewards(activeFamilyId);
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Impossible d'enregistrer la recompense.", variant: "error" });
    } finally {
      setIsSavingReward(false);
    }
  };

  if (checkingSession || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center rounded-2xl border border-[#E2D8CF] bg-white px-6">
        <p className="text-sm font-medium text-[#6B5D55]">Chargement des taches...</p>
      </div>
    );
  }

  if (configError) {
    return (
      <div className="rounded-2xl border border-[#E7C8BC] bg-[#FAEFEC] p-6 text-sm font-medium text-[#A85C52]">
        {configError}
      </div>
    );
  }

  if (currentRole && !tasksAccess.allowed) {
    return <AccessDeniedCard title="Acces aux taches" message={tasksAccess.reason} />;
  }

  const renderTaskCard = (task: TaskItem, compact = false) => {
    const categoryMeta = getCategoryMeta(task.category);
    const CategoryIcon = categoryMeta.icon;
    const assignee = resolveAssignee(task);
    const dueLabel = formatDueDateLabel(task.dueDate);

    const dueClass = isOverdue(task.dueDate, task.completedAt)
      ? "text-[#B0483E]"
      : isToday(task.dueDate)
        ? "text-[#BE7B2A]"
        : "text-[#7B746D]";

    const priorityLabel = task.priority === "high" ? "Haute" : task.priority === "low" ? "Basse" : "Normale";
    const priorityClass = task.priority === "high"
      ? "bg-[#F2DFD9] text-[#9E4A41]"
      : task.priority === "low"
        ? "bg-[#E4EEE4] text-[#4F7755]"
        : "bg-[#EFE5CC] text-[#8A6B1F]";

    return (
      <article key={task.id} className="rounded-2xl border border-[#DDD2C7] bg-white p-3 shadow-[0_1px_4px_rgba(44,36,32,0.06)]">
        <div className={`flex ${compact ? "items-start" : "items-center"} gap-3`}>
          <button
            type="button"
            disabled={tasksAccess.readOnly}
            onClick={() => onToggleTask(task, !task.completedAt)}
            className={`mt-1 flex h-6 w-6 items-center justify-center rounded-full border transition ${
              task.completedAt
                ? "border-[#6B8F71] bg-[#6B8F71] text-white"
                : "border-[#B9ACA0] bg-white text-transparent hover:border-[#7C6B5D]"
            }`}
            aria-label={task.completedAt ? "Marquer non terminee" : "Marquer terminee"}
          >
            <Check size={14} />
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-[#2C2420]">{task.title}</p>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${categoryMeta.badgeClass}`}>
                <CategoryIcon size={12} />
                {categoryMeta.label}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${priorityClass}`}>● {priorityLabel}</span>
              {task.proofUrl ? <Paperclip size={14} className="text-[#7C6B5D]" /> : null}
            </div>

            {task.description ? <p className="mt-1 text-xs text-[#756A60]">{task.description}</p> : null}

            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#F5F0EB] px-2 py-1 text-[#5F564F]">
                <span className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full bg-[#DCCFC2] text-[10px] font-semibold text-[#4E433A]">
                  {assignee.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={assignee.avatar} alt={assignee.label} className="h-full w-full object-cover" />
                  ) : (
                    assignee.initials
                  )}
                </span>
                {assignee.label}
              </span>
              <span className={`font-semibold ${dueClass}`}>{dueLabel}</span>
              {task.assignedKind === "child" ? (
                <span className="rounded-full bg-[#ECE8E0] px-2 py-1 font-semibold text-[#5A5752]">{task.points} pts</span>
              ) : null}
            </div>
          </div>

          <div>
            <select
              value={task.status}
              disabled={tasksAccess.readOnly}
              onChange={(event) => onChangeTaskStatus(task.id, event.target.value as TaskStatus)}
              className="rounded-lg border border-[#D7CCC1] bg-white px-2 py-1 text-xs text-[#5F564F]"
            >
              <option value="todo">A faire</option>
              <option value="in_progress">En cours</option>
              <option value="done">Fait</option>
            </select>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-[#DED2C7] bg-white p-4 shadow-[0_2px_10px_rgba(44,36,32,0.06)] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#E9E0D6] text-[#6E6053]">
              <CheckSquare size={20} />
            </span>
            <div>
              <h2 className="text-2xl font-bold text-[#2C2420]">Taches</h2>
              <p className="text-xs text-[#7B6D62]">Organisation co-parentale en temps reel</p>
            </div>
          </div>

          <button
            type="button"
            disabled={tasksAccess.readOnly}
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#7C6B5D] px-4 text-sm font-semibold text-white transition hover:bg-[#6C5D50] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus size={16} />
            Ajouter une tache
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <button
            type="button"
            onClick={() => setScopeFilter("all")}
            className={`rounded-xl border px-3 py-2 text-sm font-medium ${scopeFilter === "all" ? "border-[#7C6B5D] bg-[#EFE7DD] text-[#4F443A]" : "border-[#D9CDC1] bg-white text-[#6E6258]"}`}
          >
            Toutes
          </button>
          <button
            type="button"
            onClick={() => setScopeFilter("mine")}
            className={`rounded-xl border px-3 py-2 text-sm font-medium ${scopeFilter === "mine" ? "border-[#7C6B5D] bg-[#EFE7DD] text-[#4F443A]" : "border-[#D9CDC1] bg-white text-[#6E6258]"}`}
          >
            Mes taches
          </button>
          <button
            type="button"
            onClick={() => setScopeFilter("child")}
            className={`rounded-xl border px-3 py-2 text-sm font-medium ${scopeFilter === "child" ? "border-[#7C6B5D] bg-[#EFE7DD] text-[#4F443A]" : "border-[#D9CDC1] bg-white text-[#6E6258]"}`}
          >
            Par enfant
          </button>
          <button
            type="button"
            onClick={() => setScopeFilter("category")}
            className={`rounded-xl border px-3 py-2 text-sm font-medium ${scopeFilter === "category" ? "border-[#7C6B5D] bg-[#EFE7DD] text-[#4F443A]" : "border-[#D9CDC1] bg-white text-[#6E6258]"}`}
          >
            Par categorie
          </button>
        </div>

        {scopeFilter === "child" ? (
          <div className="mt-3">
            <select
              value={selectedChildFilter}
              onChange={(event) => setSelectedChildFilter(event.target.value)}
              className="w-full rounded-xl border border-[#D9CDC1] bg-white px-3 py-2 text-sm text-[#51483F]"
            >
              <option value="all">Tous les enfants</option>
              {children.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.displayName}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {scopeFilter === "category" ? (
          <div className="mt-3">
            <select
              value={selectedCategoryFilter}
              onChange={(event) => setSelectedCategoryFilter(event.target.value as CategoryKey)}
              className="w-full rounded-xl border border-[#D9CDC1] bg-white px-3 py-2 text-sm text-[#51483F]"
            >
              {CATEGORIES.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setView("list")}
            className={`rounded-xl px-3 py-2 text-sm font-semibold ${view === "list" ? "bg-[#7C6B5D] text-white" : "bg-[#EFE8E0] text-[#5D534A]"}`}
          >
            📋 Liste
          </button>
          <button
            type="button"
            onClick={() => setView("kanban")}
            className={`rounded-xl px-3 py-2 text-sm font-semibold ${view === "kanban" ? "bg-[#7C6B5D] text-white" : "bg-[#EFE8E0] text-[#5D534A]"}`}
          >
            📊 Kanban
          </button>
          <button
            type="button"
            onClick={() => setView("history")}
            className={`rounded-xl px-3 py-2 text-sm font-semibold ${view === "history" ? "bg-[#7C6B5D] text-white" : "bg-[#EFE8E0] text-[#5D534A]"}`}
          >
            ✅ Historique
          </button>
        </div>

        {listError ? <p className="mt-4 text-sm text-[#A85C52]">{listError}</p> : null}
      </section>

      {view === "list" ? (
        <section className="space-y-3">
          {scopedTasks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#D9CDC1] bg-white px-4 py-8 text-center text-sm text-[#74695E]">
              Aucune tache pour ce filtre.
            </div>
          ) : (
            scopedTasks.map((task) => renderTaskCard(task))
          )}
        </section>
      ) : null}

      {view === "kanban" ? (
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-[#DDD1C5] bg-[#F8F4EF] p-3">
            <h3 className="mb-3 text-sm font-bold text-[#4E453D]">A faire</h3>
            <div className="space-y-2">
              {kanbanGroups.todo.length === 0 ? <p className="text-xs text-[#7E746A]">Vide</p> : kanbanGroups.todo.map((task) => renderTaskCard(task, true))}
            </div>
          </div>
          <div className="rounded-2xl border border-[#DDD1C5] bg-[#F8F4EF] p-3">
            <h3 className="mb-3 text-sm font-bold text-[#4E453D]">En cours</h3>
            <div className="space-y-2">
              {kanbanGroups.inProgress.length === 0 ? <p className="text-xs text-[#7E746A]">Vide</p> : kanbanGroups.inProgress.map((task) => renderTaskCard(task, true))}
            </div>
          </div>
          <div className="rounded-2xl border border-[#DDD1C5] bg-[#F8F4EF] p-3">
            <h3 className="mb-3 text-sm font-bold text-[#4E453D]">Fait</h3>
            <div className="space-y-2">
              {kanbanGroups.done.length === 0 ? <p className="text-xs text-[#7E746A]">Vide</p> : kanbanGroups.done.map((task) => renderTaskCard(task, true))}
            </div>
          </div>
        </section>
      ) : null}

      {view === "history" ? (
        <section className="space-y-3">
          <div className="grid gap-2 rounded-2xl border border-[#DED1C5] bg-white p-3 sm:grid-cols-2">
            <select
              value={historyMemberFilter}
              onChange={(event) => setHistoryMemberFilter(event.target.value)}
              className="rounded-xl border border-[#D8CCC0] bg-white px-3 py-2 text-sm text-[#5E544B]"
            >
              <option value="all">Tous les membres</option>
              {user ? <option value="me">Moi</option> : null}
              {members.map((member) => (
                <option key={member.userId} value={`member:${member.userId}`}>
                  {member.displayName}
                </option>
              ))}
              {children.map((child) => (
                <option key={child.id} value={`child:${child.id}`}>
                  {child.displayName}
                </option>
              ))}
            </select>

            <select
              value={historyMonthFilter}
              onChange={(event) => setHistoryMonthFilter(event.target.value)}
              className="rounded-xl border border-[#D8CCC0] bg-white px-3 py-2 text-sm text-[#5E544B]"
            >
              {currentMonthOptions.map((month) => (
                <option key={month} value={month}>
                  {month === "all" ? "Tous les mois" : month}
                </option>
              ))}
            </select>
          </div>

          {historyTasks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#D9CDC1] bg-white px-4 py-8 text-center text-sm text-[#74695E]">
              Aucune tache completee pour ce filtre.
            </div>
          ) : (
            historyTasks.map((task) => {
              const assignee = resolveAssignee(task);
              const categoryMeta = getCategoryMeta(task.category);
              const CategoryIcon = categoryMeta.icon;

              return (
                <article key={task.id} className="rounded-2xl border border-[#DDD2C7] bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#2C2420]">{task.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#6E645B]">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${categoryMeta.badgeClass}`}>
                          <CategoryIcon size={12} />
                          {categoryMeta.label}
                        </span>
                        <span>Assignee a {assignee.label}</span>
                        <span>Par {resolveCompletedBy(task)}</span>
                        <span>Le {formatDateTime(task.completedAt)}</span>
                      </div>
                    </div>
                    <span className="rounded-full bg-[#E4EEE4] px-2 py-1 text-xs font-semibold text-[#4F7755]">Fait</span>
                  </div>

                  {task.proofUrl ? (
                    <div className="mt-3 overflow-hidden rounded-xl border border-[#DDD2C7] bg-[#F6F1EA] p-2">
                      <p className="mb-2 text-xs font-semibold text-[#665C53]">Preuve photo</p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={task.proofUrl} alt="Preuve" className="max-h-56 w-full rounded-lg object-cover" />
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-[#DED2C7] bg-white p-4">
          <h3 className="text-sm font-bold text-[#433A32]">Profil enfant et points</h3>
          <p className="mt-1 text-xs text-[#7A7066]">Total de points accumules et progression vers recompense.</p>

          <select
            value={selectedPointsChildId}
            onChange={(event) => setSelectedPointsChildId(event.target.value)}
            className="mt-3 w-full rounded-xl border border-[#D9CDC1] bg-white px-3 py-2 text-sm text-[#5E544B]"
          >
            {children.length === 0 ? <option value="all">Aucun enfant</option> : null}
            {children.map((child) => (
              <option key={child.id} value={child.id}>
                {child.displayName}
              </option>
            ))}
          </select>

          <div className="mt-3 rounded-xl bg-[#F4EEE7] p-3">
            <p className="text-xs text-[#6B6057]">Points accumules</p>
            <p className="text-2xl font-bold text-[#2C2420]">{selectedChildPoints}</p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#E2D8CD]">
              <div className="h-full rounded-full bg-[#7C6B5D]" style={{ width: `${progressPercent}%` }} />
            </div>
            <p className="mt-2 text-xs text-[#6B6057]">
              {nextReward ? `Objectif suivant: ${nextReward.pointsRequired} pts = ${nextReward.label}` : "Toutes les recompenses sont debloquees."}
            </p>
          </div>
        </article>

        <article className="rounded-2xl border border-[#DED2C7] bg-white p-4">
          <h3 className="text-sm font-bold text-[#433A32]">Recompenses parents</h3>
          <p className="mt-1 text-xs text-[#7A7066]">Exemple: 50 points = 1h de jeux video.</p>

          <form onSubmit={addReward} className="mt-3 grid gap-2 sm:grid-cols-[1fr_120px_auto]">
            <input
              value={rewardLabel}
              onChange={(event) => setRewardLabel(event.target.value)}
              placeholder="Nom de la recompense"
              className="rounded-xl border border-[#D8CCC0] bg-white px-3 py-2 text-sm text-[#403831]"
            />
            <input
              type="number"
              min={1}
              value={rewardPoints}
              onChange={(event) => setRewardPoints(event.target.value)}
              className="rounded-xl border border-[#D8CCC0] bg-white px-3 py-2 text-sm text-[#403831]"
            />
            <button
              type="submit"
              disabled={tasksAccess.readOnly || isSavingReward}
              className="rounded-xl bg-[#7C6B5D] px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Ajouter
            </button>
          </form>

          <ul className="mt-3 space-y-2">
            {rewards.length === 0 ? <li className="text-xs text-[#7A7066]">Aucune recompense definie.</li> : null}
            {rewards.map((reward) => (
              <li key={reward.id} className="rounded-xl border border-[#E1D6CB] bg-[#F8F4EF] px-3 py-2 text-sm text-[#4B423A]">
                {reward.pointsRequired} pts = {reward.label}
              </li>
            ))}
          </ul>
        </article>
      </section>

      {isAddModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#2C2420]/40 p-0 sm:items-center sm:p-6">
          <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl border border-[#D7CCC1] bg-white p-5 sm:max-w-2xl sm:rounded-3xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#2C2420]">Ajouter une tache</h3>
              <button type="button" onClick={() => setIsAddModalOpen(false)} className="rounded-lg p-1 text-[#786D62] hover:bg-[#F2EBE3]">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={createTask} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6D6258]">Titre de la tache</label>
                <input
                  required
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="w-full rounded-xl border border-[#D8CCC0] bg-white px-3 py-2 text-sm text-[#3F3731]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6D6258]">Description (optionnel)</label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-[#D8CCC0] bg-white px-3 py-2 text-sm text-[#3F3731]"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#6D6258]">Categorie</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {CATEGORIES.map((item) => {
                    const Icon = item.icon;
                    const active = category === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setCategory(item.key)}
                        className={`flex items-center gap-2 rounded-xl border px-2 py-2 text-xs font-semibold ${active ? "border-[#7C6B5D] bg-[#EFE7DD] text-[#4D4339]" : "border-[#D8CCC0] bg-white text-[#6A6057]"}`}
                      >
                        <Icon size={14} />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6D6258]">Assignee a</label>
                  <div className="relative">
                    <select
                      value={assigneeId}
                      onChange={(event) => setAssigneeId(event.target.value)}
                      className="w-full appearance-none rounded-xl border border-[#D8CCC0] bg-white px-3 py-2 pr-8 text-sm text-[#3F3731]"
                    >
                      {assigneeOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="pointer-events-none absolute right-2 top-3 text-[#74695F]" />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6D6258]">Priorite</label>
                  <select
                    value={priority}
                    onChange={(event) => setPriority(event.target.value as TaskPriority)}
                    className="w-full rounded-xl border border-[#D8CCC0] bg-white px-3 py-2 text-sm text-[#3F3731]"
                  >
                    <option value="high">🔴 Haute</option>
                    <option value="normal">🟡 Normale</option>
                    <option value="low">🟢 Basse</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6D6258]">Date d'echeance</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                    className="w-full rounded-xl border border-[#D8CCC0] bg-white px-3 py-2 text-sm text-[#3F3731]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6D6258]">Lier a un enfant (optionnel)</label>
                  <select
                    value={linkedChildId}
                    onChange={(event) => setLinkedChildId(event.target.value)}
                    className="w-full rounded-xl border border-[#D8CCC0] bg-white px-3 py-2 text-sm text-[#3F3731]"
                  >
                    <option value="none">Aucun</option>
                    {children.map((child) => (
                      <option key={child.id} value={child.id}>
                        {child.displayName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {assigneeId.startsWith("child:") ? (
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6D6258]">Valeur en points enfant (1-10)</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={points}
                    onChange={(event) => setPoints(event.target.value)}
                    className="w-full rounded-xl border border-[#D8CCC0] bg-white px-3 py-2 text-sm text-[#3F3731]"
                  />
                </div>
              ) : null}

              <div className="rounded-xl border border-[#D8CCC0] bg-[#F7F2EB] p-3">
                <label className="flex items-center justify-between gap-3 text-sm font-semibold text-[#4A4037]">
                  Tache recurrente ?
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(event) => setIsRecurring(event.target.checked)}
                    className="h-4 w-4"
                  />
                </label>

                {isRecurring ? (
                  <div className="mt-3 space-y-3">
                    <select
                      value={recurrenceFrequency}
                      onChange={(event) => setRecurrenceFrequency(event.target.value as RecurrenceFrequency)}
                      className="w-full rounded-xl border border-[#D8CCC0] bg-white px-3 py-2 text-sm text-[#3F3731]"
                    >
                      <option value="daily">Quotidienne</option>
                      <option value="weekly">Hebdomadaire</option>
                      <option value="monthly">Mensuelle</option>
                    </select>

                    {recurrenceFrequency === "weekly" ? (
                      <select
                        value={recurrenceWeekday}
                        onChange={(event) => setRecurrenceWeekday(event.target.value)}
                        className="w-full rounded-xl border border-[#D8CCC0] bg-white px-3 py-2 text-sm text-[#3F3731]"
                      >
                        {WEEK_DAYS.map((label, index) => (
                          <option key={label} value={index}>
                            {label}
                          </option>
                        ))}
                      </select>
                    ) : null}

                    {recurrenceFrequency === "monthly" ? (
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={recurrenceMonthday}
                        onChange={(event) => setRecurrenceMonthday(event.target.value)}
                        className="w-full rounded-xl border border-[#D8CCC0] bg-white px-3 py-2 text-sm text-[#3F3731]"
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={isSavingTask || tasksAccess.readOnly}
                className="w-full rounded-xl bg-[#7C6B5D] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingTask ? "Ajout en cours..." : "Ajouter la tache"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {pendingProof ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#2C2420]/40 p-0 sm:items-center sm:p-6">
          <div className="w-full rounded-t-3xl border border-[#D7CCC1] bg-white p-5 sm:max-w-lg sm:rounded-3xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#2C2420]">Ajouter une photo comme preuve</h3>
              <button type="button" onClick={() => setPendingProof(null)} className="rounded-lg p-1 text-[#786D62] hover:bg-[#F2EBE3]">
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-[#63594F]">{pendingProof.title}</p>

            <label className="mt-4 flex w-full cursor-pointer items-center justify-center rounded-xl border border-dashed border-[#CDBEAF] bg-[#F7F2EB] px-4 py-4 text-sm font-medium text-[#63584E]">
              Choisir une photo (optionnel)
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event: ChangeEvent<HTMLInputElement>) => setProofFile(event.target.files?.[0] ?? null)}
              />
            </label>

            {proofFile ? <p className="mt-2 text-xs text-[#6E6359]">Fichier: {proofFile.name}</p> : null}

            <button
              type="button"
              disabled={isCompletingTask}
              onClick={completeTask}
              className="mt-4 w-full rounded-xl bg-[#7C6B5D] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCompletingTask ? "Validation..." : "Terminer la tache"}
            </button>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          className={`fixed bottom-5 right-5 z-50 rounded-xl px-4 py-3 text-sm font-semibold shadow-lg ${
            toast.variant === "success" ? "bg-[#4E7A5A] text-white" : "bg-[#A54F45] text-white"
          }`}
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}
