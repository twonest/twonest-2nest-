"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { ArrowLeft, CheckCircle, ChevronLeft, ChevronRight, Clock, Download, Eye, PlusCircle, Settings, Trash2, XCircle } from "lucide-react";
import jsPDF from "jspdf";
import {
 Bar,
 BarChart,
 CartesianGrid,
 Cell,
 Legend,
 Pie,
 PieChart,
 ResponsiveContainer,
 Tooltip,
 XAxis,
 YAxis,
} from "recharts";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type ExpenseCategory = "Médical" | "Scolaire" | "Vêtements" | "Activités" | "Nourriture" | "Autre";
type PaidBy = "parent1" | "parent2";
type ParentRole = "parent1" | "parent2";
type ReviewStatus = "pending" | "approved" | "contested";

type ExpenseItem = {
 id: string;
 amount: number;
 description: string;
 category: ExpenseCategory;
 childId: string | null;
 childName: string | null;
 paidBy: PaidBy;
 expenseDate: string;
 reimbursed: boolean;
 receiptUrl: string | null;
 parent1ShareAmount: number;
 parent2ShareAmount: number;
};

type SupabaseExpenseRow = {
 id?: string | number;
 amount?: number | string;
 montant?: number | string;
 description?: string;
 label?: string;
 category?: string;
 categorie?: string;
 child_id?: string;
 enfant_id?: string;
 child_name?: string;
 enfant?: string;
 paid_by?: string;
 payer?: string;
 parent?: string;
 expense_date?: string;
 date?: string;
 spent_at?: string;
 created_at?: string;
 reimbursed?: boolean;
 reimbursed_at?: string | null;
 status?: string;
 recu_url?: string;
 parent1_share_amount?: number | string;
 parent2_share_amount?: number | string;
 split_parent1?: number | string;
 split_parent2?: number | string;
 parent1_share_pct?: number | string;
 parent2_share_pct?: number | string;
};

type SupabasePartageRegleRow = {
 category?: string;
 categorie?: string;
 parent1_pct?: number | string;
 parent2_pct?: number | string;
 parent1_percentage?: number | string;
 parent2_percentage?: number | string;
};

type SupabaseExpenseReviewRow = {
 id?: string | number;
 expense_id?: string | number;
 depense_id?: string | number;
 requester_user_id?: string;
 user_id?: string;
 reviewer_role?: string;
 reviewer?: string;
 status?: string;
 review_status?: string;
 contest_reason?: string | null;
 reason?: string | null;
 contested_reason?: string | null;
 reviewed_at?: string | null;
 decided_at?: string | null;
 created_at?: string | null;
 reviewer_user_id?: string | null;
};

type ExpenseReview = {
 id: string;
 expenseId: string;
 requesterUserId: string | null;
 reviewerRole: ParentRole;
 status: ReviewStatus;
 contestReason: string | null;
 reviewedAt: string | null;
 createdAt: string | null;
 reviewerUserId: string | null;
};

type ToastState = {
 message: string;
 variant: "success" | "error";
};

type ParentNames = {
 parent1: string;
 parent2: string;
};

type ExpensesTab = "expenses" | "annual";

const CATEGORIES: ExpenseCategory[] = ["Médical", "Scolaire", "Vêtements", "Activités", "Nourriture", "Autre"];
const SHARED_MONTH_KEY = "twonest.selectedMonth";
const SHARED_CHILD_KEY = "twonest.selectedChildId";
const SHARED_CHILD_NAME_KEY = "twonest.selectedChildName";
const MONTH_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];
const DEFAULT_SHARE_RULES: Record<ExpenseCategory, number> = {
 Médical: 50,
 Scolaire: 50,
 Vêtements: 50,
 Activités: 50,
 Nourriture: 50,
 Autre: 50,
};
const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
 Médical: "#7C6B5D",
 Scolaire: "#7AA8D2",
 Vêtements: "#8A7FD1",
 Activités: "#6B8F71",
 Nourriture: "#F3B562",
 Autre: "#A7B8C9",
};

function parseAmount(value: number | string | undefined): number | null {
 if (typeof value === "number") {
  return Number.isFinite(value) ? value : null;
 }

 if (typeof value === "string") {
  const normalized = Number(value.replace(",", "."));
  return Number.isFinite(normalized) ? normalized : null;
 }

 return null;
}

function roundToTwo(value: number): number {
 return Math.round(value * 100) / 100;
}

function normalizePaidBy(value: string | undefined): PaidBy {
 if (!value) {
  return "parent1";
 }

 const normalized = value.toLowerCase();
 if (normalized.includes("parent 2") || normalized.includes("parent2") || normalized === "p2") {
  return "parent2";
 }

 if (normalized.includes("parent 1") || normalized.includes("parent1") || normalized === "p1") {
  return "parent1";
 }

 return normalized === "parent2" ? "parent2" : "parent1";
}

function normalizeParentRole(value: string | undefined): ParentRole {
 return normalizePaidBy(value);
}

function getOppositeParentRole(role: ParentRole): ParentRole {
 return role === "parent1" ? "parent2" : "parent1";
}

function normalizeCategory(value: string | undefined): ExpenseCategory {
 if (!value) {
  return "Autre";
 }

 const found = CATEGORIES.find((category) => category.toLowerCase() === value.toLowerCase());
 return found ?? "Autre";
}

function formatCurrency(amount: number): string {
 return amount.toLocaleString("fr-CA", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
 });
}

function formatTooltipCurrencyValue(value: unknown): string {
 if (typeof value === "number") {
  return `${formatCurrency(value)}$`;
 }

 if (typeof value === "string") {
  const parsed = Number(value.replace(",", "."));
  return `${formatCurrency(Number.isFinite(parsed) ? parsed : 0)}$`;
 }

 return `${formatCurrency(0)}$`;
}

function toMonthValue(dateInput: string): string {
 const date = new Date(dateInput);
 if (Number.isNaN(date.getTime())) {
  return "";
 }

 const month = `${date.getMonth() + 1}`.padStart(2, "0");
 return `${date.getFullYear()}-${month}`;
}

function shiftMonth(monthValue: string, delta: number): string {
 const [rawYear, rawMonth] = monthValue.split("-");
 const year = Number(rawYear);
 const month = Number(rawMonth);

 if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
  return toMonthValue(new Date().toISOString());
 }

 const date = new Date(year, month - 1 + delta, 1);
 const nextMonth = `${date.getMonth() + 1}`.padStart(2, "0");
 return `${date.getFullYear()}-${nextMonth}`;
}

function formatMonthLabel(monthValue: string): string {
 const [rawYear, rawMonth] = monthValue.split("-");
 const year = Number(rawYear);
 const month = Number(rawMonth);

 if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
  return monthValue;
 }

 const label = new Date(year, month - 1, 1).toLocaleDateString("fr-CA", {
  month: "long",
  year: "numeric",
 });

 return label.charAt(0).toUpperCase() + label.slice(1);
}

function getReceiptType(url: string | null): "image" | "pdf" | "other" {
 if (!url) {
  return "other";
 }

 const cleanUrl = url.split("?")[0].toLowerCase();
 if (cleanUrl.endsWith(".pdf")) {
  return "pdf";
 }

 if (cleanUrl.endsWith(".jpg") || cleanUrl.endsWith(".jpeg") || cleanUrl.endsWith(".png") || cleanUrl.endsWith(".webp")) {
  return "image";
 }

 return "other";
}

function toDateOnlyValue(dateInput: string): string | null {
 const parsedDate = new Date(dateInput);
 if (Number.isNaN(parsedDate.getTime())) {
  return null;
 }

 const month = `${parsedDate.getMonth() + 1}`.padStart(2, "0");
 const day = `${parsedDate.getDate()}`.padStart(2, "0");
 return `${parsedDate.getFullYear()}-${month}-${day}`;
}

function clampPercentage(value: number): number {
 if (!Number.isFinite(value)) {
  return 50;
 }

 if (value < 0) {
  return 0;
 }

 if (value > 100) {
  return 100;
 }

 return Math.round(value * 100) / 100;
}

function getExpenseYear(dateInput: string): number | null {
 const date = new Date(dateInput);
 if (Number.isNaN(date.getTime())) {
  return null;
 }

 return date.getFullYear();
}

function extractProfileDisplayName(profile: Record<string, unknown>): string | null {
 const firstName =
  typeof profile.first_name === "string"
   ? profile.first_name.trim()
   : typeof profile.prenom === "string"
    ? profile.prenom.trim()
    : "";

 const lastName =
  typeof profile.last_name === "string"
   ? profile.last_name.trim()
   : typeof profile.nom === "string"
    ? profile.nom.trim()
    : "";

 if (firstName.length > 0 && lastName.length > 0) {
  return `${firstName} ${lastName}`;
 }

 if (firstName.length > 0) {
  return firstName;
 }

 if (lastName.length > 0) {
  return lastName;
 }

 const candidateKeys = ["full_name", "display_name", "name", "nom", "prenom_nom"];

 for (const key of candidateKeys) {
  const value = profile[key];
  if (typeof value === "string" && value.trim().length > 0) {
   return value.trim();
  }
 }

 return null;
}

export default function ExpensesPage() {
 const router = useRouter();
 const [user, setUser] = useState<User | null>(null);
 const [checkingSession, setCheckingSession] = useState(true);
 const [configError, setConfigError] = useState("");

 const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
 const [expenseReviews, setExpenseReviews] = useState<ExpenseReview[]>([]);
 const [isLoadingExpenses, setIsLoadingExpenses] = useState(true);
 const [isCreatingExpense, setIsCreatingExpense] = useState(false);
 const [isMarkingReimbursed, setIsMarkingReimbursed] = useState(false);
 const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
 const [isSubmittingReview, setIsSubmittingReview] = useState(false);
 const [currentParentRole, setCurrentParentRole] = useState<ParentRole>("parent1");

 const [amount, setAmount] = useState("");
 const [description, setDescription] = useState("");
 const [category, setCategory] = useState<ExpenseCategory>("Médical");
 const [paidBy, setPaidBy] = useState<PaidBy>("parent1");
 const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
 const [receiptFile, setReceiptFile] = useState<File | null>(null);
 const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
 const [receiptMimeType, setReceiptMimeType] = useState("");

 const [selectedMonth, setSelectedMonth] = useState(() => toMonthValue(new Date().toISOString()));
 const [activeTab, setActiveTab] = useState<ExpensesTab>("expenses");
 const [isAddExpenseFormOpen, setIsAddExpenseFormOpen] = useState(false);
 const [receiptViewerExpense, setReceiptViewerExpense] = useState<ExpenseItem | null>(null);
 const [contestingReview, setContestingReview] = useState<ExpenseReview | null>(null);
 const [contestReasonInput, setContestReasonInput] = useState("");
 const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
 const [parentNames, setParentNames] = useState<ParentNames>({ parent1: "Parent 1", parent2: "Parent 2" });
 const [shareRules, setShareRules] = useState<Record<ExpenseCategory, number>>(DEFAULT_SHARE_RULES);
 const [isShareSettingsOpen, setIsShareSettingsOpen] = useState(false);
 const [isSavingShareRules, setIsSavingShareRules] = useState(false);

 const [formError, setFormError] = useState("");
 const [listError, setListError] = useState("");
 const [toast, setToast] = useState<ToastState | null>(null);

 useEffect(() => {
  if (!toast) {
   return;
  }

  const timeout = setTimeout(() => setToast(null), 2500);
  return () => clearTimeout(timeout);
 }, [toast]);

 useEffect(() => {
  const storedMonth = window.localStorage.getItem(SHARED_MONTH_KEY);
  if (storedMonth && /^\d{4}-\d{2}$/.test(storedMonth)) {
   setSelectedMonth(storedMonth);
  }
 }, []);

 useEffect(() => {
  if (/^\d{4}-\d{2}$/.test(selectedMonth)) {
   window.localStorage.setItem(SHARED_MONTH_KEY, selectedMonth);
  }
 }, [selectedMonth]);

 useEffect(() => {
  return () => {
   if (receiptPreviewUrl) {
    URL.revokeObjectURL(receiptPreviewUrl);
   }
  };
 }, [receiptPreviewUrl]);

 const onReceiptChange = (event: ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0] ?? null;

  if (receiptPreviewUrl) {
   URL.revokeObjectURL(receiptPreviewUrl);
   setReceiptPreviewUrl(null);
  }

  if (!file) {
   setReceiptFile(null);
   setReceiptMimeType("");
   return;
  }

  const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
  if (!allowedTypes.includes(file.type)) {
   setFormError("Format de reçu invalide. Utilise JPG, PNG ou PDF.");
   setReceiptFile(null);
   setReceiptMimeType("");
   event.target.value = "";
   return;
  }

  setFormError("");
  setReceiptFile(file);
  setReceiptMimeType(file.type);

  if (file.type.startsWith("image/")) {
   setReceiptPreviewUrl(URL.createObjectURL(file));
  }
 };

 const openReceiptViewer = (expense: ExpenseItem) => {
  setReceiptViewerExpense(expense);
 };

 const closeReceiptViewer = () => {
  setReceiptViewerExpense(null);
 };

 const openContestModal = (review: ExpenseReview) => {
  setContestingReview(review);
  setContestReasonInput("");
 };

 const closeContestModal = () => {
  setContestingReview(null);
  setContestReasonInput("");
 };

 const onChangeParent1Share = (categoryName: ExpenseCategory, nextValue: string) => {
  const numeric = clampPercentage(Number(nextValue.replace(",", ".")));
  setShareRules((current) => ({
   ...current,
   [categoryName]: numeric,
  }));
 };

 const refreshShareRules = async (client = getSupabaseBrowserClient()) => {
  let { data, error } = await client.from("partage_regles").select("*");

  if (error) {
   setShareRules(DEFAULT_SHARE_RULES);
   return;
  }

  const nextRules: Record<ExpenseCategory, number> = { ...DEFAULT_SHARE_RULES };

  for (const row of (data ?? []) as SupabasePartageRegleRow[]) {
   const rowCategory = normalizeCategory(row.category ?? row.categorie);
   const parsedParent1 = parseAmount(row.parent1_pct ?? row.parent1_percentage);
   if (parsedParent1 !== null) {
    nextRules[rowCategory] = clampPercentage(parsedParent1);
   }
  }

  setShareRules(nextRules);
 };

 const onSaveShareRules = async () => {
  setIsSavingShareRules(true);
  setListError("");

  try {
   const supabase = getSupabaseBrowserClient();

   for (const categoryName of CATEGORIES) {
    const parent1Pct = clampPercentage(shareRules[categoryName] ?? 50);
    const parent2Pct = clampPercentage(100 - parent1Pct);

    const { error } = await supabase.from("partage_regles").upsert(
     {
      category: categoryName,
      parent1_pct: parent1Pct,
      parent2_pct: parent2Pct,
     },
     { onConflict: "category" },
    );

    if (!error) {
     continue;
    }

    const fallback = await supabase.from("partage_regles").upsert(
     {
      categorie: categoryName,
      parent1_percentage: parent1Pct,
      parent2_percentage: parent2Pct,
     },
     { onConflict: "categorie" },
    );

    if (fallback.error) {
     setListError(fallback.error.message);
     return;
    }
   }

   setToast({ message: "Entente de partage sauvegardée.", variant: "success" });
   await refreshShareRules();
  } catch (error) {
   setListError(error instanceof Error ? error.message : "Erreur pendant la sauvegarde des règles.");
  } finally {
   setIsSavingShareRules(false);
  }
 };

 const refreshExpenses = async (client = getSupabaseBrowserClient()) => {
  let query = client.from("expenses").select("*");
  let { data, error } = await query.order("expense_date", { ascending: false });

  if (error) {
   const fallback = await client.from("expenses").select("*").order("created_at", { ascending: false });
   data = fallback.data;
   error = fallback.error;
  }

  if (error) {
   setListError(error.message);
   return;
  }

  const mappedEntries = (data as SupabaseExpenseRow[]).map((row): ExpenseItem | null => {
    const parsedAmount = parseAmount(row.amount ?? row.montant);
    const rawDate = row.expense_date ?? row.date ?? row.spent_at ?? row.created_at;

    if (!row.id || parsedAmount === null || !rawDate) {
     return null;
    }

    const statusText = (row.status ?? "").toLowerCase();
    const reimbursed =
     row.reimbursed === true ||
     Boolean(row.reimbursed_at) ||
     statusText === "remboursé" ||
         statusText === "remboursée" ||
     statusText === "reimbursed";

    const normalizedReceiptUrl = row.recu_url ?? null;

    const parent1ShareAmount = parseAmount(row.parent1_share_amount) ?? parseAmount(row.split_parent1);
    const parent2ShareAmount = parseAmount(row.parent2_share_amount) ?? parseAmount(row.split_parent2);

    return {
     id: String(row.id),
     amount: parsedAmount,
     description: row.description ?? row.label ?? "Sans description",
     category: normalizeCategory(row.category ?? row.categorie),
     childId: row.child_id ?? row.enfant_id ?? null,
     childName: row.child_name ?? row.enfant ?? null,
     paidBy: normalizePaidBy(row.paid_by ?? row.payer ?? row.parent),
     expenseDate: rawDate,
     reimbursed,
     receiptUrl: normalizedReceiptUrl,
     parent1ShareAmount: parent1ShareAmount ?? roundToTwo(parsedAmount / 2),
     parent2ShareAmount: parent2ShareAmount ?? roundToTwo(parsedAmount / 2),
    };
   });

  const mapped = mappedEntries.filter((expense): expense is ExpenseItem => expense !== null);

  const selectedChildId = window.localStorage.getItem(SHARED_CHILD_KEY) ?? "all";
  const selectedChildName = (window.localStorage.getItem(SHARED_CHILD_NAME_KEY) ?? "").toLowerCase();
  const filtered = selectedChildId === "all"
   ? mapped
   : mapped.filter((expense) => {
    const byId = expense.childId === selectedChildId;
    const byName = selectedChildName.length > 0 && (expense.childName ?? "").toLowerCase().includes(selectedChildName);
    return byId || byName;
   });

  setExpenses(filtered);
 };

 const refreshExpenseReviews = async (client = getSupabaseBrowserClient()) => {
  let { data, error } = await client.from("expense_reviews").select("*").order("created_at", { ascending: false });

  if (error) {
   const fallback = await client.from("expense_reviews").select("*");
   data = fallback.data;
   error = fallback.error;
  }

  if (error) {
   return;
  }

  const mapped = (data as SupabaseExpenseReviewRow[])
   .map((row): ExpenseReview | null => {
    const expenseId = row.expense_id ?? row.depense_id;
    if (!row.id || !expenseId) {
     return null;
    }

    const rawStatus = (row.status ?? row.review_status ?? "pending").toLowerCase();
    const status: ReviewStatus = rawStatus === "approved" || rawStatus === "contested" ? rawStatus : "pending";

    return {
     id: String(row.id),
     expenseId: String(expenseId),
     requesterUserId: row.requester_user_id ?? row.user_id ?? null,
     reviewerRole: normalizeParentRole(row.reviewer_role ?? row.reviewer),
     status,
     contestReason: row.contest_reason ?? row.contested_reason ?? row.reason ?? null,
     reviewedAt: row.reviewed_at ?? row.decided_at ?? null,
     createdAt: row.created_at ?? null,
     reviewerUserId: row.reviewer_user_id ?? null,
    };
   })
   .filter((review): review is ExpenseReview => review !== null);

  setExpenseReviews(mapped);
 };

 const onApproveExpense = async (review: ExpenseReview) => {
  if (!user) {
   return;
  }

  setIsSubmittingReview(true);
  setListError("");

  try {
   const supabase = getSupabaseBrowserClient();
   const reviewedAt = new Date().toISOString();

   const { error } = await supabase
    .from("expense_reviews")
    .update({
     status: "approved",
     reviewed_at: reviewedAt,
     reviewer_user_id: user.id,
     contest_reason: null,
    })
    .eq("id", review.id);

   if (error) {
    setListError(error.message);
    return;
   }

   await refreshExpenseReviews();
   setToast({ message: "Dépense approuvée.", variant: "success" });
  } catch (error) {
   setListError(error instanceof Error ? error.message : "Erreur pendant l'approbation.");
  } finally {
   setIsSubmittingReview(false);
  }
 };

 const onSubmitContestExpense = async () => {
  if (!user || !contestingReview) {
   return;
  }

  if (contestReasonInput.trim().length === 0) {
   setListError("La raison de contestation est obligatoire.");
   return;
  }

  setIsSubmittingReview(true);
  setListError("");

  try {
   const supabase = getSupabaseBrowserClient();
   const reviewedAt = new Date().toISOString();

   const { error } = await supabase
    .from("expense_reviews")
    .update({
     status: "contested",
     reviewed_at: reviewedAt,
     reviewer_user_id: user.id,
     contest_reason: contestReasonInput.trim(),
    })
    .eq("id", contestingReview.id);

   if (error) {
    setListError(error.message);
    return;
   }

   await refreshExpenseReviews();
   closeContestModal();
   setToast({ message: "Dépense contestée.", variant: "success" });
  } catch (error) {
   setListError(error instanceof Error ? error.message : "Erreur pendant la contestation.");
  } finally {
   setIsSubmittingReview(false);
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
   setIsLoadingExpenses(false);
   return;
  }

  const loadInitialData = async () => {
   const { data: userData } = await supabase.auth.getUser();

   if (!userData.user) {
    router.replace("/");
    return;
   }

   setUser(userData.user);

   const { data: profileData } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", userData.user.id)
    .maybeSingle();

   setCurrentParentRole(normalizeParentRole(profileData?.role));

   const { data: profilesData } = await supabase.from("profiles").select("*");
   if (Array.isArray(profilesData)) {
    let nextParent1 = "Parent 1";
    let nextParent2 = "Parent 2";

    for (const rawProfile of profilesData as Record<string, unknown>[]) {
     const role = normalizeParentRole(typeof rawProfile.role === "string" ? rawProfile.role : undefined);
     const displayName = extractProfileDisplayName(rawProfile);
     if (!displayName) {
      continue;
     }

     if (role === "parent1") {
      nextParent1 = displayName;
     } else {
      nextParent2 = displayName;
     }
    }

    setParentNames({ parent1: nextParent1, parent2: nextParent2 });
   }

   setCheckingSession(false);
   await refreshShareRules(supabase);
   await refreshExpenses(supabase);
   await refreshExpenseReviews(supabase);
   setIsLoadingExpenses(false);
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

 const onAddExpense = async (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();

  const parsedAmount = Number(amount.replace(",", "."));
  const parent1Pct = clampPercentage(shareRules[category] ?? 50);
  const parent2Pct = clampPercentage(100 - parent1Pct);
  const parent1ShareAmount = roundToTwo((parsedAmount * parent1Pct) / 100);
  const parent2ShareAmount = roundToTwo(parsedAmount - parent1ShareAmount);

  if (!user || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || description.trim().length === 0 || !expenseDate) {
   setFormError("Tous les champs sont obligatoires et le montant doit être valide.");
   return;
  }

  setIsCreatingExpense(true);
  setFormError("");

  try {
   const supabase = getSupabaseBrowserClient();
   let uploadedReceiptUrl: string | null = null;

   if (receiptFile) {
    const safeName = receiptFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${user.id}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage.from("receipts").upload(path, receiptFile, {
     upsert: true,
    });

    if (uploadError) {
     setFormError(`${uploadError.message}. Vérifie que le bucket 'receipts' existe et est accessible.`);
     return;
    }

    const {
     data: { publicUrl },
    } = supabase.storage.from("receipts").getPublicUrl(path);

    uploadedReceiptUrl = publicUrl;
   }

   const payloadVariants = [
    {
     user_id: user.id,
     amount: parsedAmount,
     description: description.trim(),
     category,
     child_id: window.localStorage.getItem(SHARED_CHILD_KEY) !== "all" ? window.localStorage.getItem(SHARED_CHILD_KEY) : null,
     child_name: window.localStorage.getItem(SHARED_CHILD_NAME_KEY) || null,
     paid_by: paidBy,
     expense_date: expenseDate,
     recu_url: uploadedReceiptUrl,
     parent1_share_pct: parent1Pct,
     parent2_share_pct: parent2Pct,
     parent1_share_amount: parent1ShareAmount,
     parent2_share_amount: parent2ShareAmount,
     reimbursed: false,
     status: "unpaid",
    },
    {
     owner_id: user.id,
     amount: parsedAmount,
     description: description.trim(),
     category,
     child_id: window.localStorage.getItem(SHARED_CHILD_KEY) !== "all" ? window.localStorage.getItem(SHARED_CHILD_KEY) : null,
     child_name: window.localStorage.getItem(SHARED_CHILD_NAME_KEY) || null,
     paid_by: paidBy,
     expense_date: expenseDate,
     recu_url: uploadedReceiptUrl,
     parent1_share_pct: parent1Pct,
     parent2_share_pct: parent2Pct,
     parent1_share_amount: parent1ShareAmount,
     parent2_share_amount: parent2ShareAmount,
     reimbursed: false,
     status: "unpaid",
    },
    {
     owner_id: user.id,
     montant: parsedAmount,
     label: description.trim(),
     categorie: category,
     enfant_id: window.localStorage.getItem(SHARED_CHILD_KEY) !== "all" ? window.localStorage.getItem(SHARED_CHILD_KEY) : null,
     enfant: window.localStorage.getItem(SHARED_CHILD_NAME_KEY) || null,
     parent: paidBy,
     date: expenseDate,
     recu_url: uploadedReceiptUrl,
     parent1_share_pct: parent1Pct,
     parent2_share_pct: parent2Pct,
     parent1_share_amount: parent1ShareAmount,
     parent2_share_amount: parent2ShareAmount,
         status: "En attente de remboursement",
    },
    {
     owner_id: user.id,
     montant: parsedAmount,
     label: description.trim(),
     categorie: category,
     enfant_id: window.localStorage.getItem(SHARED_CHILD_KEY) !== "all" ? window.localStorage.getItem(SHARED_CHILD_KEY) : null,
     enfant: window.localStorage.getItem(SHARED_CHILD_NAME_KEY) || null,
     parent: paidBy,
     date: expenseDate,
     parent1_share_pct: parent1Pct,
     parent2_share_pct: parent2Pct,
     parent1_share_amount: parent1ShareAmount,
     parent2_share_amount: parent2ShareAmount,
         status: "En attente de remboursement",
    },
   ];

   let lastInsertError: string | null = null;
   let createdExpenseId: string | null = null;

   for (const payload of payloadVariants) {
    const { data: inserted, error } = await supabase
     .from("expenses")
     .insert(payload)
     .select("id")
     .maybeSingle();

    if (!error) {
     lastInsertError = null;
     if (inserted?.id) {
      createdExpenseId = String(inserted.id);
     }
     break;
    }
    lastInsertError = error.message;
   }

   if (lastInsertError) {
    setFormError(lastInsertError);
    return;
   }

   if (createdExpenseId) {
    await supabase.from("expense_reviews").upsert(
     {
      expense_id: createdExpenseId,
      requester_user_id: user.id,
      reviewer_role: getOppositeParentRole(paidBy),
      status: "pending",
     },
     { onConflict: "expense_id" },
    );
   }

   await refreshExpenses();
   await refreshExpenseReviews();
   setAmount("");
   setDescription("");
   setCategory("Médical");
   setPaidBy("parent1");
   setExpenseDate(new Date().toISOString().slice(0, 10));
   setReceiptFile(null);
   setReceiptMimeType("");
   if (receiptPreviewUrl) {
    URL.revokeObjectURL(receiptPreviewUrl);
   }
   setReceiptPreviewUrl(null);
   setIsAddExpenseFormOpen(false);
   setToast({ message: "Dépense ajoutée.", variant: "success" });
  } catch (error) {
   setFormError(error instanceof Error ? error.message : "Erreur pendant l'ajout de la dépense.");
  } finally {
   setIsCreatingExpense(false);
  }
 };

 const onMarkReimbursed = async (expenseId: string) => {
  setIsMarkingReimbursed(true);
  setListError("");

  try {
   const supabase = getSupabaseBrowserClient();
   const nowIso = new Date().toISOString();
   const { error } = await supabase
    .from("expenses")
    .update({ reimbursed: true, reimbursed_at: nowIso, status: "reimbursed" })
    .eq("id", expenseId);

   if (error) {
    const fallback = await supabase
     .from("expenses")
         .update({ status: "Remboursée", reimbursed_at: nowIso })
     .eq("id", expenseId);

    if (fallback.error) {
     setListError(fallback.error.message);
     return;
    }
   }

   await refreshExpenses();
   setToast({ message: "Dépense marquée comme remboursée.", variant: "success" });
  } catch (error) {
   setListError(error instanceof Error ? error.message : "Erreur pendant la mise à jour.");
  } finally {
   setIsMarkingReimbursed(false);
  }
 };

 const onDeleteExpense = async (expense: ExpenseItem) => {
  const shouldDelete = window.confirm("Supprimer cette dépense ? Cette action est définitive.");
  if (!shouldDelete) {
   return;
  }

  setDeletingExpenseId(expense.id);
  setListError("");

  try {
   const supabase = getSupabaseBrowserClient();
   const { error } = await supabase.from("expenses").delete().eq("id", expense.id);

   if (error) {
    setListError(error.message);
    return;
   }

   if (expense.receiptUrl?.includes("/storage/v1/object/public/receipts/")) {
    const receiptPath = decodeURIComponent(expense.receiptUrl.split("/storage/v1/object/public/receipts/")[1] ?? "");
    if (receiptPath) {
     await supabase.storage.from("receipts").remove([receiptPath]);
    }
   }

   await refreshExpenses();
   setToast({ message: "Dépense supprimée.", variant: "success" });
  } catch (error) {
   setListError(error instanceof Error ? error.message : "Erreur pendant la suppression.");
  } finally {
   setDeletingExpenseId(null);
  }
 };

 const filteredExpenses = useMemo(() => {
  return expenses.filter((expense) => toMonthValue(expense.expenseDate) === selectedMonth);
 }, [expenses, selectedMonth]);

 const balance = useMemo(() => {
  let net = 0;

  for (const expense of filteredExpenses) {
   if (expense.reimbursed) {
    continue;
   }

   if (expense.paidBy === "parent1") {
    const parent2Share = expense.parent2ShareAmount ?? expense.amount / 2;
    net += parent2Share;
   } else {
    const parent1Share = expense.parent1ShareAmount ?? expense.amount / 2;
    net -= parent1Share;
   }
  }

  return net;
 }, [filteredExpenses]);

 const balanceText = useMemo(() => {
  if (Math.abs(balance) < 0.005) {
   return "Comptes équilibrés entre Parent 1 et Parent 2";
  }

  if (balance > 0) {
   return `Parent 2 doit ${formatCurrency(balance)}$ à Parent 1`;
  }

  return `Parent 1 doit ${formatCurrency(Math.abs(balance))}$ à Parent 2`;
 }, [balance]);

 const reviewByExpenseId = useMemo(() => {
  const map = new Map<string, ExpenseReview>();
  for (const review of expenseReviews) {
   if (!map.has(review.expenseId)) {
    map.set(review.expenseId, review);
   }
  }
  return map;
 }, [expenseReviews]);

 const pendingNotifications = useMemo(() => {
  return expenseReviews.filter((review) => review.status === "pending" && review.reviewerRole === currentParentRole);
 }, [currentParentRole, expenseReviews]);

 const annualExpenses = useMemo(() => {
  return expenses.filter((expense) => getExpenseYear(expense.expenseDate) === selectedYear);
 }, [expenses, selectedYear]);

 const annualTotals = useMemo(() => {
  let paidByParent1 = 0;
  let paidByParent2 = 0;
  let balanceNet = 0;

  for (const expense of annualExpenses) {
   if (expense.paidBy === "parent1") {
    paidByParent1 += expense.amount;
   } else {
    paidByParent2 += expense.amount;
   }

   if (!expense.reimbursed) {
    if (expense.paidBy === "parent1") {
     balanceNet += expense.parent2ShareAmount ?? expense.amount / 2;
    } else {
     balanceNet -= expense.parent1ShareAmount ?? expense.amount / 2;
    }
   }
  }

  return {
   total: annualExpenses.reduce((sum, expense) => sum + expense.amount, 0),
   paidByParent1,
   paidByParent2,
   balanceNet,
  };
 }, [annualExpenses]);

 const annualBarData = useMemo(() => {
  const data = MONTH_LABELS.map((label) => ({
   month: label,
   parent1: 0,
   parent2: 0,
  }));

  for (const expense of annualExpenses) {
   const date = new Date(expense.expenseDate);
   if (Number.isNaN(date.getTime())) {
    continue;
   }

   const monthIndex = date.getMonth();
   if (!data[monthIndex]) {
    continue;
   }

   if (expense.paidBy === "parent1") {
    data[monthIndex].parent1 += expense.amount;
   } else {
    data[monthIndex].parent2 += expense.amount;
   }
  }

  return data.map((item) => ({
   ...item,
   parent1: roundToTwo(item.parent1),
   parent2: roundToTwo(item.parent2),
  }));
 }, [annualExpenses]);

 const annualCategoryData = useMemo(() => {
  const totals = CATEGORIES.reduce(
   (accumulator, currentCategory) => {
    accumulator[currentCategory] = 0;
    return accumulator;
   },
   {} as Record<ExpenseCategory, number>,
  );

  for (const expense of annualExpenses) {
   totals[expense.category] += expense.amount;
  }

  return CATEGORIES.map((item) => ({
   name: item,
   value: roundToTwo(totals[item]),
   percentage: annualTotals.total > 0 ? (totals[item] / annualTotals.total) * 100 : 0,
   color: CATEGORY_COLORS[item],
  })).filter((item) => item.value > 0);
 }, [annualExpenses, annualTotals.total]);

 const annualTopPayerText = useMemo(() => {
  if (Math.abs(annualTotals.paidByParent1 - annualTotals.paidByParent2) < 0.005) {
   return `Égalité · ${formatCurrency(annualTotals.paidByParent1)}$ chacun`;
  }

  if (annualTotals.paidByParent1 > annualTotals.paidByParent2) {
   return `${parentNames.parent1} · ${formatCurrency(annualTotals.paidByParent1)}$`;
  }

  return `${parentNames.parent2} · ${formatCurrency(annualTotals.paidByParent2)}$`;
 }, [annualTotals.paidByParent1, annualTotals.paidByParent2, parentNames.parent1, parentNames.parent2]);

 const annualBalanceText = useMemo(() => {
  if (Math.abs(annualTotals.balanceNet) < 0.005) {
   return "Comptes équilibrés";
  }

  if (annualTotals.balanceNet > 0) {
   return `${parentNames.parent2} doit ${formatCurrency(annualTotals.balanceNet)}$ à ${parentNames.parent1}`;
  }

  return `${parentNames.parent1} doit ${formatCurrency(Math.abs(annualTotals.balanceNet))}$ à ${parentNames.parent2}`;
 }, [annualTotals.balanceNet, parentNames.parent1, parentNames.parent2]);

 const onExportTaxReport = () => {
  const doc = new jsPDF();
  const fileName = `rapport-fiscal-2nest-${selectedYear}.pdf`;
  const pageWidth = doc.internal.pageSize.getWidth();
  const rightMargin = pageWidth - 14;
  const tableLeft = 14;
  const tableWidth = pageWidth - 28;
  const headerHeight = 9;
  const rowHeight = 8;
  const col1 = tableLeft + 2;
  const col2 = tableLeft + tableWidth * 0.6;
  const col3 = tableLeft + tableWidth * 0.8;
  let y = 18;

  doc.setFontSize(18);
  doc.text(`Rapport fiscal 2nest ${selectedYear}`, 14, y);

  y += 8;
  doc.setLineWidth(0.3);
  doc.line(14, y, rightMargin, y);

  y += 8;
  doc.setFontSize(11);
  doc.text(`Parents: ${parentNames.parent1} et ${parentNames.parent2}`, 14, y);
  y += 6;
  doc.text(`Année fiscale: ${selectedYear}`, 14, y);

  y += 10;
  doc.setFontSize(13);
  doc.text("Total par catégorie", 14, y);

  y += 5;
  doc.setFillColor(241, 247, 253);
  doc.rect(tableLeft, y, tableWidth, headerHeight, "F");
  doc.setDrawColor(208, 223, 238);
  doc.rect(tableLeft, y, tableWidth, headerHeight);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Catégorie", col1, y + 6);
  doc.text("%", col2, y + 6);
  doc.text("Montant", col3, y + 6);

  y += headerHeight;
  doc.setFont("helvetica", "normal");
  for (const categoryName of CATEGORIES) {
   const categoryValue = annualCategoryData.find((item) => item.name === categoryName)?.value ?? 0;
   const categoryPct = annualTotals.total > 0 ? (categoryValue / annualTotals.total) * 100 : 0;

   doc.rect(tableLeft, y, tableWidth, rowHeight);
   doc.text(categoryName, col1, y + 5.5);
   doc.text(`${categoryPct.toFixed(1)}%`, col2, y + 5.5);
   doc.text(`${formatCurrency(categoryValue)}$`, col3, y + 5.5, { align: "left" });

   y += rowHeight;
  }

  y += 10;
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Totaux annuels", 14, y);

  y += 6;
  doc.setFont("helvetica", "normal");
  const summaryLines = [
   `Total des dépenses: ${formatCurrency(annualTotals.total)}$`,
   `${parentNames.parent1} a payé: ${formatCurrency(annualTotals.paidByParent1)}$`,
   `${parentNames.parent2} a payé: ${formatCurrency(annualTotals.paidByParent2)}$`,
   `Solde final: ${annualBalanceText}`,
  ];

  for (const line of summaryLines) {
   doc.text(line, 14, y);
   y += 6;
  }

  y += 4;
  doc.setFontSize(9);
  doc.setTextColor(94, 122, 149);
  doc.text(`Document généré le ${new Date().toLocaleDateString("fr-CA")}`, 14, y);

  doc.save(fileName);
  setToast({ message: "Rapport fiscal PDF généré.", variant: "success" });
 };

 if (checkingSession || isLoadingExpenses) {
  return (
   <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#F5F0EB] to-[#EDE8E3] px-6">
    <p className="text-sm font-medium text-[#6B5D55]">Chargement des dépenses...</p>
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

 return (
  <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#F5F0EB] via-[#EDE8E3] to-[#EDE8E3] px-4 py-8 sm:px-6 sm:py-10">
   <div className="pointer-events-none absolute -top-32 -left-24 h-80 w-80 rounded-full bg-[#7C6B5D]/20 blur-3xl" />
   <div className="pointer-events-none absolute right-0 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-[#A89080]/20 blur-3xl" />

   <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-6 rounded-3xl border border-white/70 bg-white/90 p-6 shadow-[0_2px_8px_rgba(44,36,32,0.08)] backdrop-blur-sm sm:p-8">
    <header className="flex flex-wrap items-start justify-between gap-3">
     <div>
      <p className="text-xs font-semibold tracking-[0.2em] text-[#A89080]">FINANCES</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#2C2420]"> Dépenses</h1>
     </div>

     <div className="flex items-center gap-2">
      <button
       type="button"
       onClick={() => setIsShareSettingsOpen((current) => !current)}
       className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#D9D0C8] bg-white text-lg text-[#6B5D55] transition hover:bg-[#EDE8E3]"
       title="Paramètres de partage"
       aria-label="Paramètres de partage"
      >
      <Settings size={16} />
      </button>
      <Link
       href="/dashboard"
       className="inline-flex items-center justify-center rounded-xl border border-[#D9D0C8] px-4 py-2 text-sm font-semibold text-[#6B5D55] transition hover:bg-[#EDE8E3]"
      >
        <ArrowLeft size={16} className="mr-2" />
        Retour
      </Link>
     </div>
    </header>

    {isShareSettingsOpen && (
     <section className="rounded-2xl border border-[#D9D0C8] bg-white p-4 shadow-[0_1px_4px_rgba(44,36,32,0.06)] sm:p-5">
      <h2 className="text-base font-semibold text-[#2C2420]"> Paramètres de partage</h2>
      <div className="mt-3 space-y-3">
       {CATEGORIES.map((categoryName) => {
        const parent1Pct = clampPercentage(shareRules[categoryName] ?? 50);
        const parent2Pct = clampPercentage(100 - parent1Pct);

        return (
         <div key={categoryName} className="rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] p-3">
          <p className="text-sm font-semibold text-[#2C2420]">{categoryName}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
           <label className="text-xs font-medium text-[#6B5D55]">
            Parent 1 (%)
            <input
             type="number"
             min="0"
             max="100"
             step="1"
             value={parent1Pct}
             onChange={(event) => onChangeParent1Share(categoryName, event.target.value)}
             className="mt-1 w-full rounded-xl border border-[#D9D0C8] px-3 py-2 text-sm text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
            />
           </label>
           <label className="text-xs font-medium text-[#6B5D55]">
            Parent 2 (%)
            <input
             type="number"
             value={parent2Pct}
             readOnly
             className="mt-1 w-full rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] px-3 py-2 text-sm text-[#2C2420]"
            />
           </label>
          </div>
         </div>
        );
       })}

       <button
        type="button"
        onClick={onSaveShareRules}
        disabled={isSavingShareRules}
        className="w-full rounded-xl bg-[#7C6B5D] px-4 py-3 text-sm font-semibold text-white shadow-[0_1px_4px_rgba(44,36,32,0.12)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
       >
        {isSavingShareRules ? "Sauvegarde..." : "Sauvegarder l'entente de partage"}
       </button>
      </div>
     </section>
    )}

    <section className="rounded-2xl border border-[#D9D0C8] bg-white p-2 shadow-[0_1px_4px_rgba(44,36,32,0.06)] sm:p-3">
     <div className="grid gap-2 sm:grid-cols-2">
      <button
       type="button"
       onClick={() => setActiveTab("expenses")}
       className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
        activeTab === "expenses"
         ? "bg-[#EDE8E3] text-[#6B5D55]"
         : "border border-[#D9D0C8] bg-white text-[#6B5D55] hover:bg-[#F5F0EB]"
       }`}
      >
        Dépenses
      </button>
      <button
       type="button"
       onClick={() => setActiveTab("annual")}
       className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
        activeTab === "annual"
         ? "bg-[#EDE8E3] text-[#6B5D55]"
         : "border border-[#D9D0C8] bg-white text-[#6B5D55] hover:bg-[#F5F0EB]"
       }`}
      >
        Tableau de bord annuel
      </button>
     </div>
    </section>

    {activeTab === "expenses" ? (
     <>
      <section className="rounded-2xl border border-[#D9D0C8] bg-white p-4 shadow-[0_1px_4px_rgba(44,36,32,0.06)] sm:p-5">
       <button
        type="button"
        onClick={() => setIsAddExpenseFormOpen(true)}
        className="w-full rounded-xl bg-[#7C6B5D] px-4 py-3 text-base font-semibold text-white shadow-[0_1px_4px_rgba(44,36,32,0.12)] transition hover:brightness-105"
       >
          <PlusCircle size={16} className="mr-2 inline-flex" />
          Ajouter une dépense
       </button>

       <div className="mt-4 flex items-center justify-between rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] px-3 py-2">
        <button
         type="button"
         onClick={() => setSelectedMonth((current) => shiftMonth(current, -1))}
         className="rounded-lg px-2 py-1 text-sm font-semibold text-[#6B5D55] transition hover:bg-[#EDE8E3]"
        >
         <ChevronLeft size={16} />
        </button>
        <div className="text-sm font-semibold text-[#6B5D55]">{formatMonthLabel(selectedMonth)}</div>
        <button
         type="button"
         onClick={() => setSelectedMonth((current) => shiftMonth(current, 1))}
         className="rounded-lg px-2 py-1 text-sm font-semibold text-[#6B5D55] transition hover:bg-[#EDE8E3]"
        >
         <ChevronRight size={16} />
        </button>
       </div>
      </section>

      {isAddExpenseFormOpen && (
       <section className="rounded-2xl border border-[#D9D0C8] bg-white p-4 shadow-[0_1px_4px_rgba(44,36,32,0.06)] sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
         <h2 className="text-xl font-semibold text-[#2C2420]">Ajouter une dépense</h2>
         <button
          type="button"
          onClick={() => setIsAddExpenseFormOpen(false)}
          className="rounded-xl border border-[#D9D0C8] bg-white px-3 py-2 text-sm font-semibold text-[#6B5D55] transition hover:bg-[#EDE8E3]"
         >
          Fermer
         </button>
        </div>

        {formError && (
         <p className="mb-4 rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] px-4 py-3 text-sm text-[#A85C52]">{formError}</p>
        )}

        <form className="grid gap-3 sm:grid-cols-2" onSubmit={onAddExpense}>
         <div>
          <label htmlFor="amount" className="mb-1 block text-sm font-medium text-[#6B5D55]">
           Montant ($)
          </label>
          <input
           id="amount"
           type="number"
           min="0"
           step="0.01"
           value={amount}
           onChange={(event) => setAmount(event.target.value)}
           className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
           placeholder="0.00"
          />
         </div>

         <div>
          <label htmlFor="description" className="mb-1 block text-sm font-medium text-[#6B5D55]">
           Description
          </label>
          <input
           id="description"
           type="text"
           value={description}
           onChange={(event) => setDescription(event.target.value)}
           className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
           placeholder="Ex: Pharmacie"
          />
         </div>

         <div>
          <label htmlFor="category" className="mb-1 block text-sm font-medium text-[#6B5D55]">
           Catégorie
          </label>
          <select
           id="category"
           value={category}
           onChange={(event) => setCategory(event.target.value as ExpenseCategory)}
           className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
          >
           {CATEGORIES.map((item) => (
            <option key={item} value={item}>
             {item}
            </option>
           ))}
          </select>
         </div>

         <div>
          <label htmlFor="paidBy" className="mb-1 block text-sm font-medium text-[#6B5D55]">
           Payé par
          </label>
          <select
           id="paidBy"
           value={paidBy}
           onChange={(event) => setPaidBy(event.target.value as PaidBy)}
           className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
          >
           <option value="parent1">Parent 1</option>
           <option value="parent2">Parent 2</option>
          </select>
         </div>

         <div className="sm:col-span-2">
          <label htmlFor="expenseDate" className="mb-1 block text-sm font-medium text-[#6B5D55]">
           Date de la dépense
          </label>
          <input
           id="expenseDate"
           type="date"
           value={expenseDate}
           onChange={(event) => setExpenseDate(event.target.value)}
           className="w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
          />
         </div>

         <div className="sm:col-span-2 rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] p-3">
          <label htmlFor="receipt" className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-[#EDE8E3] px-4 py-2 text-sm font-semibold text-[#7C6B5D] transition hover:brightness-95">
            <PlusCircle size={14} className="mr-2" />
            Ajouter un reçu
          </label>
          <input
           id="receipt"
           type="file"
           accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
           onChange={onReceiptChange}
           className="hidden"
          />
          <p className="mt-2 text-xs text-[#6B5D55]">Formats acceptés: JPG, PNG, PDF</p>

          {receiptFile && (
           <p className="mt-2 text-sm font-medium text-[#6B5D55]">Fichier sélectionné: {receiptFile.name}</p>
          )}

          {receiptPreviewUrl && receiptMimeType.startsWith("image/") && (
           <div className="mt-3 overflow-hidden rounded-xl border border-[#D9D0C8] bg-white p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={receiptPreviewUrl} alt="Aperçu du reçu" className="max-h-52 w-auto rounded-lg object-contain" />
           </div>
          )}
         </div>

         <button
          type="submit"
          disabled={isCreatingExpense}
          className="sm:col-span-2 mt-1 w-full rounded-xl bg-[#7C6B5D] px-4 py-3 text-sm font-semibold text-white shadow-[0_1px_4px_rgba(44,36,32,0.12)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
         >
          {isCreatingExpense ? "Ajout..." : "Ajouter la dépense"}
         </button>
        </form>
       </section>
      )}

      <section className="rounded-2xl border border-[#D9D0C8] bg-white p-4 shadow-[0_1px_4px_rgba(44,36,32,0.06)] sm:p-5">
       {listError && (
        <p className="mb-4 rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] px-4 py-3 text-sm text-[#A85C52]">{listError}</p>
       )}

       <div className="space-y-3">
        {filteredExpenses.length === 0 ? (
         <p className="rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] px-4 py-3 text-sm text-[#6B5D55]">
          Aucune dépense pour {formatMonthLabel(selectedMonth)}.
         </p>
        ) : (
         filteredExpenses.map((expense) => (
          <article key={expense.id} className="rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] p-4">
           {(() => {
            const review = reviewByExpenseId.get(expense.id);
            const reviewStatus = review?.status ?? "pending";
            const statusClass =
             reviewStatus === "approved"
              ? "border-[#D9D0C8] bg-[#EDE8E3] text-[#6B8F71]"
              : reviewStatus === "contested"
               ? "border-[#D9D0C8] bg-[#F5F0EB] text-[#A85C52]"
               : "border-[#D9D0C8] bg-[#F5F0EB] text-[#6B5D55]";

              const statusIcon =
               reviewStatus === "approved" ? (
                <CheckCircle size={12} className="mr-1" />
               ) : reviewStatus === "contested" ? (
                <XCircle size={12} className="mr-1" />
               ) : (
                <Clock size={12} className="mr-1" />
               );

            return (
             <div className="mb-3 space-y-1">
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClass}`}>
                 {statusIcon}
               {reviewStatus === "approved" ? "Approuvée" : reviewStatus === "contested" ? "Contestée" : "En attente d'approbation"}
              </span>
              <p className="text-xs text-[#6B5D55]">
               Demande créée le {new Date(review?.createdAt ?? expense.expenseDate).toLocaleString("fr-CA")}
               {review?.reviewedAt ? ` · Décision le ${new Date(review.reviewedAt).toLocaleString("fr-CA")}` : ""}
              </p>
              {review?.contestReason && <p className="text-xs font-medium text-[#A85C52]">Raison: {review.contestReason}</p>}
             </div>
            );
           })()}

           <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
             <p className="text-lg font-semibold text-[#2C2420]">{formatCurrency(expense.amount)}$</p>
             <p className="mt-1 text-sm font-medium text-[#6B5D55]">{expense.description}</p>
             <p className="mt-1 text-xs text-[#6B5D55]">
              {expense.category} · {new Date(expense.expenseDate).toLocaleDateString("fr-CA")}
             </p>
            </div>

            <div className="text-right">
             <p className="text-xs font-semibold text-[#A89080]">Payé par</p>
             <p className={`mt-1 rounded-full px-3 py-1 text-xs font-semibold ${
              expense.paidBy === "parent1"
               ? "bg-[#EDE8E3] text-[#7C6B5D]"
               : "bg-[#E9F8EE] text-[#6B8F71]"
             }`}>
              {expense.paidBy === "parent1" ? "Parent 1" : "Parent 2"}
             </p>
            </div>
           </div>

           <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
             <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
               expense.reimbursed
                ? "border border-[#D9D0C8] bg-[#EDE8E3] text-[#6B8F71]"
                : "border border-[#D9D0C8] bg-[#F5F0EB] text-[#6B5D55]"
              }`}
             >
              {expense.reimbursed ? "Remboursée" : "En attente de remboursement"}
             </span>
             {expense.receiptUrl && getReceiptType(expense.receiptUrl) !== "pdf" && (
              <button
               type="button"
               onClick={() => openReceiptViewer(expense)}
               className="overflow-hidden rounded-lg border border-[#D9D0C8] bg-white transition hover:brightness-95"
               title="Ouvrir la photo du reçu"
              >
               {/* eslint-disable-next-line @next/next/no-img-element */}
               <img
                src={expense.receiptUrl}
                alt="Miniature du reçu"
                className="h-[60px] w-[60px] object-cover"
               />
              </button>
             )}

             {expense.receiptUrl && getReceiptType(expense.receiptUrl) === "pdf" && (
              <a
               href={expense.receiptUrl}
               target="_blank"
               rel="noreferrer"
               className="rounded-full border border-[#D9D0C8] bg-white px-3 py-1 text-xs font-semibold text-[#7C6B5D] transition hover:bg-[#F5F0EB]"
               title="Ouvrir le reçu PDF"
              >
                <Download size={12} className="mr-1 inline-flex" />
                Reçu PDF
              </a>
             )}

             {!expense.receiptUrl && (
              <span className="text-xs font-medium text-[#7A8FA5]">Aucun reçu</span>
             )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
             {!expense.reimbursed && (
              <button
               type="button"
               onClick={() => onMarkReimbursed(expense.id)}
               disabled={isMarkingReimbursed || deletingExpenseId === expense.id}
               className="rounded-xl bg-[#7C6B5D] px-3 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
              >
               Marquer comme remboursé
              </button>
             )}

             <button
              type="button"
              onClick={() => onDeleteExpense(expense)}
              disabled={deletingExpenseId === expense.id || isMarkingReimbursed}
              className="rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] px-3 py-2 text-sm font-semibold text-[#A85C52] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
             >
                <Trash2 size={14} className="mr-2 inline-flex" />
                {deletingExpenseId === expense.id ? "Suppression..." : "Supprimer"}
             </button>
            </div>
           </div>
          </article>
         ))
        )}
       </div>

       <button
        type="button"
        onClick={() => setIsAddExpenseFormOpen(true)}
        className="mt-4 w-full rounded-xl bg-[#7C6B5D] px-4 py-3 text-base font-semibold text-white shadow-[0_1px_4px_rgba(44,36,32,0.12)] transition hover:brightness-105"
       >
          <PlusCircle size={16} className="mr-2 inline-flex" />
          Ajouter une dépense
       </button>

       <div className="mt-4 rounded-2xl border border-[#D9D0C8] bg-[#F5F0EB] px-4 py-3">
        <p className="text-xs font-semibold tracking-[0.18em] text-[#A89080]">SOLDE ACTUEL</p>
        <p className="mt-2 text-sm font-semibold text-[#2C2420]">{balanceText}</p>
       </div>
      </section>
     </>
    ) : (
     <section className="rounded-2xl border border-[#D9D0C8] bg-white p-4 shadow-[0_1px_4px_rgba(44,36,32,0.06)] sm:p-5">
      <p className="text-xs font-semibold tracking-[0.2em] text-[#A89080]">ANALYSE</p>
      <h2 className="mt-1 text-xl font-semibold text-[#2C2420]"> Tableau de bord annuel</h2>

      <div className="mt-4 flex items-center justify-between rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] px-3 py-2">
       <button
        type="button"
        onClick={() => setSelectedYear((current) => current - 1)}
        className="rounded-lg px-2 py-1 text-sm font-semibold text-[#6B5D55] transition hover:bg-[#EDE8E3]"
       >
        <ChevronLeft size={16} />
       </button>

       <div className="flex items-center gap-2 text-sm font-semibold text-[#6B5D55]">
        <button
         type="button"
         onClick={() => setSelectedYear((current) => current - 1)}
         className="rounded-lg px-2 py-1 transition hover:bg-[#EDE8E3]"
        >
         {selectedYear - 1}
        </button>
        <span>|</span>
        <button type="button" className="rounded-lg bg-[#EDE8E3] px-2 py-1 text-[#7C6B5D]">
         {selectedYear}
        </button>
        <span>|</span>
        <button
         type="button"
         onClick={() => setSelectedYear((current) => current + 1)}
         className="rounded-lg px-2 py-1 transition hover:bg-[#EDE8E3]"
        >
         {selectedYear + 1}
        </button>
       </div>

       <button
        type="button"
        onClick={() => setSelectedYear((current) => current + 1)}
        className="rounded-lg px-2 py-1 text-sm font-semibold text-[#6B5D55] transition hover:bg-[#EDE8E3]"
       >
          <ChevronRight size={16} />
       </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
       <div className="rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] p-3">
        <p className="text-xs font-semibold tracking-[0.12em] text-[#A89080]"> Total annuel</p>
        <p className="mt-2 text-lg font-semibold text-[#2C2420]">{formatCurrency(annualTotals.total)}$</p>
       </div>
       <div className="rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] p-3">
        <p className="text-xs font-semibold tracking-[0.12em] text-[#A89080]"> Qui a payé le plus</p>
        <p className="mt-2 text-sm font-semibold text-[#2C2420]">{annualTopPayerText}</p>
       </div>
       <div className="rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] p-3">
        <p className="text-xs font-semibold tracking-[0.12em] text-[#A89080]"> Solde annuel</p>
        <p className="mt-2 text-sm font-semibold text-[#2C2420]">{annualBalanceText}</p>
       </div>
      </div>

      <div className="mt-4 rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] p-3">
       <p className="text-xs font-semibold tracking-[0.14em] text-[#A89080]">DÉPENSES PAR MOIS</p>
       <div className="mt-3 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
         <BarChart data={annualBarData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#D9D0C8" />
          <XAxis dataKey="month" stroke="#A89080" />
          <YAxis stroke="#A89080" tickFormatter={(value) => `${value}$`} />
          <Tooltip formatter={(value) => formatTooltipCurrencyValue(value)} />
          <Legend />
          <Bar dataKey="parent1" name={parentNames.parent1} fill="#7C6B5D" radius={[6, 6, 0, 0]} />
          <Bar dataKey="parent2" name={parentNames.parent2} fill="#6B8F71" radius={[6, 6, 0, 0]} />
         </BarChart>
        </ResponsiveContainer>
       </div>
      </div>

      <div className="mt-4 rounded-xl border border-[#D9D0C8] bg-[#F5F0EB] p-3">
       <p className="text-xs font-semibold tracking-[0.14em] text-[#A89080]">RÉPARTITION PAR CATÉGORIE</p>
       {annualCategoryData.length === 0 ? (
        <p className="mt-3 text-sm text-[#6B5D55]">Aucune dépense pour {selectedYear}.</p>
       ) : (
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
         <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
           <PieChart>
            <Pie data={annualCategoryData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={95}>
             {annualCategoryData.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
             ))}
            </Pie>
            <Tooltip formatter={(value) => formatTooltipCurrencyValue(value)} />
           </PieChart>
          </ResponsiveContainer>
         </div>

         <div className="space-y-2">
          {annualCategoryData.map((item) => (
           <div key={item.name} className="flex items-center justify-between rounded-lg border border-[#D9D0C8] bg-white px-3 py-2">
            <div className="flex items-center gap-2">
             <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
             <span className="text-sm font-medium text-[#6B5D55]">{item.name}</span>
            </div>
            <span className="text-sm font-semibold text-[#2C2420]">{item.percentage.toFixed(1)}% · {formatCurrency(item.value)}$</span>
           </div>
          ))}
         </div>
        </div>
       )}
      </div>

      <button
       type="button"
       onClick={onExportTaxReport}
       className="mt-4 w-full rounded-xl border border-[#D9D0C8] bg-[#EDE8E3] px-4 py-3 text-sm font-semibold text-[#7C6B5D] transition hover:brightness-95"
      >
        <Download size={16} className="mr-2 inline-flex" />
        Exporter pour les impôts
      </button>
     </section>
    )}
   </main>

   {receiptViewerExpense?.receiptUrl && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F223680] p-4">
     <div className="w-full max-w-3xl rounded-2xl border border-white/70 bg-white p-5 shadow-[0_20px_60px_rgba(15,36,54,0.22)]">
      <div className="overflow-hidden rounded-xl border border-[#D9D0C8] bg-[#F5F0EB]">
       {/* eslint-disable-next-line @next/next/no-img-element */}
       <img src={receiptViewerExpense.receiptUrl} alt="Reçu" className="max-h-[70vh] w-full object-contain" />
      </div>

      <div className="mt-4 space-y-1">
       <p className="text-sm text-[#6B5D55]">Montant</p>
       <p className="text-base font-semibold text-[#2C2420]">{formatCurrency(receiptViewerExpense.amount)}$</p>
       <p className="pt-1 text-sm text-[#6B5D55]">Description</p>
       <p className="text-sm font-medium text-[#6B5D55]">{receiptViewerExpense.description}</p>
      </div>

      <button
       type="button"
       onClick={closeReceiptViewer}
       className="mt-5 w-full rounded-xl border border-[#D9D0C8] bg-white px-4 py-2.5 text-sm font-semibold text-[#6B5D55] transition hover:bg-[#EDE8E3]"
      >
       Fermer
      </button>
     </div>
    </div>
   )}

   {contestingReview && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F223680] p-4">
     <div className="w-full max-w-lg rounded-2xl border border-white/70 bg-white p-5 shadow-[0_20px_60px_rgba(15,36,54,0.22)]">
      <h3 className="text-lg font-semibold text-[#2C2420]">Contester la dépense</h3>
      <p className="mt-1 text-sm text-[#6B5D55]">Explique la raison de contestation (tracée et datée).</p>
      <textarea
       value={contestReasonInput}
       onChange={(event) => setContestReasonInput(event.target.value)}
       rows={4}
       className="mt-3 w-full rounded-xl border border-[#D9D0C8] px-3 py-2.5 text-sm text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/20"
       placeholder="Ex: Montant contesté, reçu illisible, dépense hors accord..."
      />
      <div className="mt-4 flex gap-2">
       <button
        type="button"
        onClick={onSubmitContestExpense}
        disabled={isSubmittingReview}
        className="w-full rounded-xl bg-[#A85C52] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
       >
        Enregistrer la contestation
       </button>
       <button
        type="button"
        onClick={closeContestModal}
        className="w-full rounded-xl border border-[#D9D0C8] bg-white px-4 py-2.5 text-sm font-semibold text-[#6B5D55] transition hover:bg-[#EDE8E3]"
       >
        Annuler
       </button>
      </div>
     </div>
    </div>
   )}

   {toast && (
    <div
     className={`fixed right-4 bottom-4 z-[60] max-w-sm rounded-xl border px-4 py-3 text-sm font-medium shadow-[0_14px_30px_rgba(45,105,64,0.2)] ${
      toast.variant === "success"
       ? "border-[#D9D0C8] bg-[#EDE8E3] text-[#6B8F71]"
       : "border-[#D9D0C8] bg-[#F5F0EB] text-[#A85C52]"
     }`}
    >
     {toast.message}
    </div>
   )}
  </div>
 );
}
