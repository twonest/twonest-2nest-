"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { LucideIcon } from "lucide-react";
import {
 Baby,
 BookOpen,
 ChevronLeft,
 ChevronRight,
 CircleDollarSign,
 HeartPulse,
 Plus,
 ReceiptText,
 Shirt,
 Trash2,
 UtensilsCrossed,
 X,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import AccessDeniedCard from "@/components/AccessDeniedCard";
import { useFamily } from "@/components/FamilyProvider";
import { getFeatureAccess } from "@/lib/family";

type ExpenseCategory = "Médical" | "Scolaire" | "Vêtements" | "Activités" | "Nourriture" | "Autre";
type PaidBy = "parent1" | "parent2";

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
};

type ParentNames = {
 parent1: string;
 parent2: string;
};

type ToastState = {
 message: string;
 variant: "success" | "error";
};

type ExpensesTab = "expenses" | "statistics";
type DateGroupKey = "today" | "yesterday" | "thisWeek" | "thisMonth" | "older";

type CategoryMeta = {
 icon: LucideIcon;
 iconBg: string;
 iconFg: string;
};

const CATEGORIES: ExpenseCategory[] = ["Médical", "Scolaire", "Vêtements", "Activités", "Nourriture", "Autre"];
const SHARED_CHILD_KEY = "twonest.selectedChildId";
const SHARED_CHILD_NAME_KEY = "twonest.selectedChildName";

const CATEGORY_META: Record<ExpenseCategory, CategoryMeta> = {
 Médical: {
  icon: HeartPulse,
  iconBg: "bg-[#EFE7DF]",
  iconFg: "text-[#8C6A54]",
 },
 Scolaire: {
  icon: BookOpen,
  iconBg: "bg-[#ECE8E1]",
  iconFg: "text-[#76695F]",
 },
 Vêtements: {
  icon: Shirt,
  iconBg: "bg-[#F2ECE6]",
  iconFg: "text-[#8A6D5A]",
 },
 Activités: {
  icon: Baby,
  iconBg: "bg-[#EBE5DE]",
  iconFg: "text-[#7B6B5E]",
 },
 Nourriture: {
  icon: UtensilsCrossed,
  iconBg: "bg-[#F3ECE2]",
  iconFg: "text-[#896C55]",
 },
 Autre: {
  icon: CircleDollarSign,
  iconBg: "bg-[#EFE9E2]",
  iconFg: "text-[#7A6A5E]",
 },
};

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Avr", "Mai", "Juin", "Juil", "Aout", "Sep", "Oct", "Nov", "Dec"];

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

function toDateOnlyValue(dateInput: string): string | null {
 const parsedDate = new Date(dateInput);
 if (Number.isNaN(parsedDate.getTime())) {
  return null;
 }

 const month = `${parsedDate.getMonth() + 1}`.padStart(2, "0");
 const day = `${parsedDate.getDate()}`.padStart(2, "0");
 return `${parsedDate.getFullYear()}-${month}-${day}`;
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

 return null;
}

function getDateGroupKey(dateInput: string): DateGroupKey {
 const date = new Date(dateInput);
 if (Number.isNaN(date.getTime())) {
  return "older";
 }

 const today = new Date();
 const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
 const targetStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
 const diffDays = Math.floor((todayStart.getTime() - targetStart.getTime()) / 86400000);

 if (diffDays === 0) {
  return "today";
 }

 if (diffDays === 1) {
  return "yesterday";
 }

 const dayOfWeek = (todayStart.getDay() + 6) % 7;
 const monday = new Date(todayStart);
 monday.setDate(todayStart.getDate() - dayOfWeek);

 if (targetStart >= monday) {
  return "thisWeek";
 }

 if (targetStart.getMonth() === todayStart.getMonth() && targetStart.getFullYear() === todayStart.getFullYear()) {
  return "thisMonth";
 }

 return "older";
}

function getDateGroupLabel(group: DateGroupKey): string {
 if (group === "today") {
  return "Aujourd'hui";
 }

 if (group === "yesterday") {
  return "Hier";
 }

 if (group === "thisWeek") {
  return "Cette semaine";
 }

 if (group === "thisMonth") {
  return "Ce mois-ci";
 }

 return "Plus ancien";
}

export default function ExpensesPage() {
 const router = useRouter();
 const { activeFamilyId, currentRole: familyRole, currentPermissions } = useFamily();

 const [user, setUser] = useState<User | null>(null);
 const [checkingSession, setCheckingSession] = useState(true);
 const [configError, setConfigError] = useState("");
 const [currentFamilyId, setCurrentFamilyId] = useState<string | null>(null);

 const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
 const [isLoadingExpenses, setIsLoadingExpenses] = useState(true);
 const [isCreatingExpense, setIsCreatingExpense] = useState(false);
 const [isMarkingReimbursed, setIsMarkingReimbursed] = useState(false);
 const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);

 const [amount, setAmount] = useState("");
 const [description, setDescription] = useState("");
 const [category, setCategory] = useState<ExpenseCategory>("Médical");
 const [paidBy, setPaidBy] = useState<PaidBy>("parent1");
 const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
 const [receiptFile, setReceiptFile] = useState<File | null>(null);

 const [activeTab, setActiveTab] = useState<ExpensesTab>("expenses");
 const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
 const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
 const [parentNames, setParentNames] = useState<ParentNames>({ parent1: "Parent 1", parent2: "Parent 2" });

 const [formError, setFormError] = useState("");
 const [listError, setListError] = useState("");
 const [toast, setToast] = useState<ToastState | null>(null);

 const expensesAccess = familyRole
  ? getFeatureAccess("expenses", familyRole, currentPermissions)
  : { allowed: true, readOnly: false, reason: "" };
 const isReadOnly = expensesAccess.readOnly;

 useEffect(() => {
  if (!toast) {
   return;
  }

  const timeout = setTimeout(() => setToast(null), 2500);
  return () => clearTimeout(timeout);
 }, [toast]);

 const refreshExpenses = async (client = getSupabaseBrowserClient(), familyId = currentFamilyId) => {
  if (!familyId) {
   setExpenses([]);
   return;
  }

  const byFamily = await client.from("expenses").select("*").eq("family_id", familyId).order("expense_date", { ascending: false });
  const data = (byFamily.data as SupabaseExpenseRow[] | null) ?? [];
  const error = byFamily.error;

  if (error) {
   setListError(error.message);
   return;
  }

  const rowMap = new Map<string, SupabaseExpenseRow>();
  for (const row of data) {
   if (!row.id) {
    continue;
   }
   rowMap.set(String(row.id), row);
  }

  const mappedEntries = Array.from(rowMap.values()).map((row): ExpenseItem | null => {
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
    receiptUrl: row.recu_url ?? null,
    parent1ShareAmount: parent1ShareAmount ?? roundToTwo(parsedAmount / 2),
    parent2ShareAmount: parent2ShareAmount ?? roundToTwo(parsedAmount / 2),
   };
  });

  const mapped = mappedEntries.filter((expense): expense is ExpenseItem => expense !== null);
  const selectedChildId = window.localStorage.getItem(SHARED_CHILD_KEY) ?? "all";
  const selectedChildName = (window.localStorage.getItem(SHARED_CHILD_NAME_KEY) ?? "").toLowerCase();

  const filtered =
   selectedChildId === "all"
    ? mapped
    : mapped.filter((expense) => {
       const byId = expense.childId === selectedChildId;
       const byName = selectedChildName.length > 0 && (expense.childName ?? "").toLowerCase().includes(selectedChildName);
       return byId || byName;
      });

  setExpenses(filtered);
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
   setCurrentFamilyId(activeFamilyId ?? null);

   const { data: profilesData } = await supabase.from("profiles").select("*");
   if (Array.isArray(profilesData)) {
    let nextParent1 = "Parent 1";
    let nextParent2 = "Parent 2";

    for (const rawProfile of profilesData as Record<string, unknown>[]) {
     const role = normalizePaidBy(typeof rawProfile.role === "string" ? rawProfile.role : undefined);
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

   if (!activeFamilyId) {
    setListError("Aucun espace actif sélectionné.");
    setExpenses([]);
   } else {
    await refreshExpenses(supabase, activeFamilyId);
   }

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
 }, [activeFamilyId, router]);

 const onReceiptChange = (event: ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0] ?? null;

  if (!file) {
   setReceiptFile(null);
   return;
  }

  const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
  if (!allowedTypes.includes(file.type)) {
   setFormError("Format de reçu invalide. Utilise JPG, PNG ou PDF.");
   setReceiptFile(null);
   event.target.value = "";
   return;
  }

  setFormError("");
  setReceiptFile(file);
 };

 const onAddExpense = async (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();

  if (isReadOnly) {
   setFormError("Votre rôle est en lecture seule dans cet espace.");
   return;
  }

  const parsedAmount = Number(amount.replace(",", "."));
  const parent1ShareAmount = roundToTwo(parsedAmount / 2);
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
     family_id: currentFamilyId,
     amount: parsedAmount,
     description: description.trim(),
     category,
     child_id: window.localStorage.getItem(SHARED_CHILD_KEY) !== "all" ? window.localStorage.getItem(SHARED_CHILD_KEY) : null,
     child_name: window.localStorage.getItem(SHARED_CHILD_NAME_KEY) || null,
     paid_by: paidBy,
     expense_date: expenseDate,
     recu_url: uploadedReceiptUrl,
     parent1_share_amount: parent1ShareAmount,
     parent2_share_amount: parent2ShareAmount,
     reimbursed: false,
     status: "unpaid",
    },
    {
     owner_id: user.id,
     family_id: currentFamilyId,
     amount: parsedAmount,
     description: description.trim(),
     category,
     child_id: window.localStorage.getItem(SHARED_CHILD_KEY) !== "all" ? window.localStorage.getItem(SHARED_CHILD_KEY) : null,
     child_name: window.localStorage.getItem(SHARED_CHILD_NAME_KEY) || null,
     paid_by: paidBy,
     expense_date: expenseDate,
     recu_url: uploadedReceiptUrl,
     parent1_share_amount: parent1ShareAmount,
     parent2_share_amount: parent2ShareAmount,
     reimbursed: false,
     status: "unpaid",
    },
    {
     owner_id: user.id,
     family_id: currentFamilyId,
     montant: parsedAmount,
     label: description.trim(),
     categorie: category,
     enfant_id: window.localStorage.getItem(SHARED_CHILD_KEY) !== "all" ? window.localStorage.getItem(SHARED_CHILD_KEY) : null,
     enfant: window.localStorage.getItem(SHARED_CHILD_NAME_KEY) || null,
     parent: paidBy,
     date: expenseDate,
     recu_url: uploadedReceiptUrl,
     parent1_share_amount: parent1ShareAmount,
     parent2_share_amount: parent2ShareAmount,
     status: "En attente de remboursement",
    },
   ];

   let lastInsertError: string | null = null;

   for (const payload of payloadVariants) {
    const { error } = await supabase.from("expenses").insert(payload);

    if (!error) {
     lastInsertError = null;
     break;
    }

    lastInsertError = error.message;
   }

   if (lastInsertError) {
    setFormError(lastInsertError);
    return;
   }

   await refreshExpenses();
   setAmount("");
   setDescription("");
   setCategory("Médical");
   setPaidBy("parent1");
   setExpenseDate(new Date().toISOString().slice(0, 10));
   setReceiptFile(null);
   setIsAddExpenseModalOpen(false);
   setToast({ message: "Dépense ajoutée.", variant: "success" });
  } catch (error) {
   setFormError(error instanceof Error ? error.message : "Erreur pendant l'ajout de la dépense.");
  } finally {
   setIsCreatingExpense(false);
  }
 };

 const onMarkReimbursed = async (expenseId: string) => {
  if (isReadOnly) {
   return;
  }

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
    const fallback = await supabase.from("expenses").update({ status: "Remboursée", reimbursed_at: nowIso }).eq("id", expenseId);

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
  if (isReadOnly) {
   return;
  }

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

 const totals = useMemo(() => {
  let total = 0;
  let paidByParent1 = 0;
  let paidByParent2 = 0;
  let balanceNet = 0;

  for (const expense of expenses) {
   total += expense.amount;

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
   total,
   paidByParent1,
   paidByParent2,
   balanceNet,
  };
 }, [expenses]);

 const balanceText = useMemo(() => {
  if (Math.abs(totals.balanceNet) < 0.005) {
   return `Comptes équilibrés entre ${parentNames.parent1} et ${parentNames.parent2}`;
  }

  if (totals.balanceNet > 0) {
   return `${parentNames.parent2} doit ${formatCurrency(totals.balanceNet)}$ à ${parentNames.parent1}`;
  }

  return `${parentNames.parent1} doit ${formatCurrency(Math.abs(totals.balanceNet))}$ à ${parentNames.parent2}`;
 }, [parentNames.parent1, parentNames.parent2, totals.balanceNet]);

 const groupedExpenses = useMemo(() => {
  const groups: Record<DateGroupKey, ExpenseItem[]> = {
   today: [],
   yesterday: [],
   thisWeek: [],
   thisMonth: [],
   older: [],
  };

  const sorted = [...expenses].sort((a, b) => {
   const aTime = new Date(a.expenseDate).getTime();
   const bTime = new Date(b.expenseDate).getTime();
   return bTime - aTime;
  });

  for (const expense of sorted) {
   groups[getDateGroupKey(expense.expenseDate)].push(expense);
  }

  return groups;
 }, [expenses]);

 const groupOrder: DateGroupKey[] = ["today", "yesterday", "thisWeek", "thisMonth", "older"];

 const annualExpenses = useMemo(() => {
  return expenses.filter((expense) => getExpenseYear(expense.expenseDate) === selectedYear);
 }, [expenses, selectedYear]);

 const annualTotals = useMemo(() => {
  let total = 0;
  let paidByParent1 = 0;
  let paidByParent2 = 0;

  for (const expense of annualExpenses) {
   total += expense.amount;

   if (expense.paidBy === "parent1") {
    paidByParent1 += expense.amount;
   } else {
    paidByParent2 += expense.amount;
   }
  }

  return { total, paidByParent1, paidByParent2 };
 }, [annualExpenses]);

 const annualMonthlyData = useMemo(() => {
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
   total: roundToTwo(item.parent1 + item.parent2),
  }));
 }, [annualExpenses]);

 const annualCategoryData = useMemo(() => {
  const totalsByCategory: Record<ExpenseCategory, number> = {
   Médical: 0,
   Scolaire: 0,
   Vêtements: 0,
   Activités: 0,
   Nourriture: 0,
   Autre: 0,
  };

  for (const expense of annualExpenses) {
   totalsByCategory[expense.category] += expense.amount;
  }

  return CATEGORIES.map((name) => ({
   name,
   value: roundToTwo(totalsByCategory[name]),
  })).filter((entry) => entry.value > 0);
 }, [annualExpenses]);

 const annualBalanceText = useMemo(() => {
  const net = annualTotals.paidByParent1 - annualTotals.paidByParent2;

  if (Math.abs(net) < 0.005) {
   return "Comptes équilibrés";
  }

  if (net > 0) {
   return `${parentNames.parent2} doit ${formatCurrency(net)}$ à ${parentNames.parent1}`;
  }

  return `${parentNames.parent1} doit ${formatCurrency(Math.abs(net))}$ à ${parentNames.parent2}`;
 }, [annualTotals.paidByParent1, annualTotals.paidByParent2, parentNames.parent1, parentNames.parent2]);

 const maxMonthlyValue = useMemo(() => {
  return annualMonthlyData.reduce((max, item) => Math.max(max, item.total), 0);
 }, [annualMonthlyData]);

 const maxCategoryValue = useMemo(() => {
  return annualCategoryData.reduce((max, item) => Math.max(max, item.value), 0);
 }, [annualCategoryData]);

 if (checkingSession || isLoadingExpenses) {
  return (
   <div className="flex min-h-screen items-center justify-center bg-[#F5F0EB] px-6">
    <p className="text-sm font-medium text-[#6B5D55]">Chargement des dépenses...</p>
   </div>
  );
 }

 if (configError) {
  return (
   <div className="flex min-h-screen items-center justify-center bg-[#F5F0EB] px-6">
    <p className="max-w-xl text-center text-sm font-medium text-[#A85C52]">{configError}</p>
   </div>
  );
 }

 if (!expensesAccess.allowed) {
  return <AccessDeniedCard title="Dépenses" message={expensesAccess.reason} />;
 }

 return (
  <div className="min-h-screen bg-[#F5F0EB] px-4 py-6 sm:px-6 sm:py-8">
   <main className="mx-auto flex w-full max-w-3xl flex-col gap-4">
    <header className="rounded-2xl border border-[#DDD2C7] bg-[#FBF8F4] p-4 sm:p-5">
     <div className="flex items-start justify-between gap-3">
      <div>
       <h1 className="text-3xl font-semibold tracking-tight text-[#2C2420]">Dépenses</h1>
       <p className="mt-3 text-2xl font-semibold leading-tight text-[#3B2F27]">{balanceText}</p>
      </div>

      <button
       type="button"
       onClick={() => setIsAddExpenseModalOpen(true)}
       disabled={isReadOnly}
       className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#7C6B5D] text-white shadow-[0_8px_20px_rgba(44,36,32,0.16)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
       aria-label="Ajouter une dépense"
      >
       <Plus size={20} />
      </button>
     </div>

     <section className="mt-4 rounded-xl border border-[#E3D9CE] bg-[#F2E9DE] p-4">
      <p className="text-xs font-semibold tracking-[0.14em] text-[#7A6A5E]">RÉSUMÉ</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
       <p className="text-sm text-[#5E5148]">Total des dépenses: <span className="font-semibold text-[#2C2420]">{formatCurrency(totals.total)}$</span></p>
       <p className="text-sm text-[#5E5148]">{parentNames.parent1} a payé: <span className="font-semibold text-[#2C2420]">{formatCurrency(totals.paidByParent1)}$</span></p>
       <p className="text-sm text-[#5E5148]">{parentNames.parent2} a payé: <span className="font-semibold text-[#2C2420]">{formatCurrency(totals.paidByParent2)}$</span></p>
       <p className="text-sm text-[#5E5148]">Solde: <span className="font-semibold text-[#2C2420]">{balanceText}</span></p>
      </div>
     </section>
    </header>

    <section className="rounded-2xl border border-[#DDD2C7] bg-[#FBF8F4] p-2">
     <div className="grid grid-cols-2 gap-2">
      <button
       type="button"
       onClick={() => setActiveTab("expenses")}
       className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
        activeTab === "expenses"
         ? "bg-[#E5DBD0] text-[#4E4036]"
         : "bg-white text-[#6B5D55] hover:bg-[#F4EEE7]"
       }`}
      >
       Dépenses
      </button>
      <button
       type="button"
       onClick={() => setActiveTab("statistics")}
       className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
        activeTab === "statistics"
         ? "bg-[#E5DBD0] text-[#4E4036]"
         : "bg-white text-[#6B5D55] hover:bg-[#F4EEE7]"
       }`}
      >
       Statistiques
      </button>
     </div>
    </section>

    {activeTab === "expenses" ? (
     <section className="rounded-2xl border border-[#DDD2C7] bg-[#FBF8F4] p-4 sm:p-5">
      {isReadOnly && (
       <p className="mb-4 rounded-xl border border-[#E3D9CE] bg-[#F2E9DE] px-4 py-3 text-sm text-[#6B5D55]">
        Consultation seule dans cet espace pour votre rôle.
       </p>
      )}

      {listError && (
       <p className="mb-4 rounded-xl border border-[#E3D9CE] bg-[#F8E8E4] px-4 py-3 text-sm text-[#A85C52]">{listError}</p>
      )}

      <div className="space-y-5">
       {expenses.length === 0 ? (
        <p className="rounded-xl border border-[#E3D9CE] bg-[#F2E9DE] px-4 py-3 text-sm text-[#6B5D55]">
         Aucune dépense pour l'instant.
        </p>
       ) : (
        groupOrder.map((groupKey) => {
         const items = groupedExpenses[groupKey];
         if (items.length === 0) {
          return null;
         }

         return (
          <div key={groupKey}>
           <div className="mb-3 flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8A7A6E]">{getDateGroupLabel(groupKey)}</span>
            <div className="h-px flex-1 bg-[#E5DACE]" />
           </div>

           <div className="space-y-2">
            {items.map((expense) => {
             const meta = CATEGORY_META[expense.category];
             const Icon = meta.icon;
             const payerName = expense.paidBy === "parent1" ? parentNames.parent1 : parentNames.parent2;
             const expenseDateText = new Date(expense.expenseDate).toLocaleDateString("fr-CA", {
              weekday: "short",
              day: "2-digit",
              month: "short",
             });

             return (
              <article key={expense.id} className="rounded-xl border border-[#E6DBCF] bg-white px-3 py-3 sm:px-4">
               <div className="flex items-start gap-3">
                <div className={`mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${meta.iconBg}`}>
                 <Icon size={18} className={meta.iconFg} />
                </div>

                <div className="min-w-0 flex-1">
                 <p className="truncate text-sm font-semibold text-[#2C2420]">{expense.description}</p>
                 <p className="mt-1 text-xs text-[#7B6E65]">{expenseDateText}</p>
                 {expense.receiptUrl && (
                  <a
                   href={expense.receiptUrl}
                   target="_blank"
                   rel="noreferrer"
                   className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#7C6B5D] underline-offset-2 hover:underline"
                  >
                   <ReceiptText size={12} />
                   Reçu
                  </a>
                 )}
                </div>

                <div className="text-right">
                 <p className="text-base font-bold text-[#2C2420]">{formatCurrency(expense.amount)}$</p>
                 <p className="mt-0.5 text-[11px] text-[#6F6258]">Payé par {payerName}</p>
                 <span
                  className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                   expense.reimbursed
                    ? "bg-[#E8F3EA] text-[#3D7A4B]"
                    : "bg-[#FBEAD6] text-[#B06B1D]"
                  }`}
                 >
                  {expense.reimbursed ? "Remboursé" : "En attente"}
                 </span>

                 {!isReadOnly && (
                  <div className="mt-2 flex justify-end gap-2">
                   {!expense.reimbursed && (
                    <button
                     type="button"
                     onClick={() => onMarkReimbursed(expense.id)}
                     disabled={isMarkingReimbursed || deletingExpenseId === expense.id}
                     className="rounded-lg border border-[#DCD1C6] bg-[#F6F1EA] px-2 py-1 text-[11px] font-semibold text-[#5E5046] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                     Rembourser
                    </button>
                   )}
                   <button
                    type="button"
                    onClick={() => onDeleteExpense(expense)}
                    disabled={deletingExpenseId === expense.id || isMarkingReimbursed}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#E8D3CF] bg-[#FCF4F2] text-[#B56658] disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="Supprimer la dépense"
                   >
                    <Trash2 size={13} />
                   </button>
                  </div>
                 )}
                </div>
               </div>
              </article>
             );
            })}
           </div>
          </div>
         );
        })
       )}
      </div>
     </section>
    ) : (
     <section className="rounded-2xl border border-[#DDD2C7] bg-[#FBF8F4] p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between rounded-xl border border-[#E3D9CE] bg-[#F2E9DE] px-3 py-2">
       <button
        type="button"
        onClick={() => setSelectedYear((current) => current - 1)}
        className="rounded-lg p-1 text-[#6B5D55] hover:bg-[#E7DDD2]"
        aria-label="Année précédente"
       >
        <ChevronLeft size={16} />
       </button>
       <p className="text-sm font-semibold text-[#4E4036]">{selectedYear}</p>
       <button
        type="button"
        onClick={() => setSelectedYear((current) => current + 1)}
        className="rounded-lg p-1 text-[#6B5D55] hover:bg-[#E7DDD2]"
        aria-label="Année suivante"
       >
        <ChevronRight size={16} />
       </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
       <p className="rounded-xl border border-[#E3D9CE] bg-[#F2E9DE] px-3 py-2 text-sm text-[#5E5148]">
        Total: <span className="font-semibold text-[#2C2420]">{formatCurrency(annualTotals.total)}$</span>
       </p>
       <p className="rounded-xl border border-[#E3D9CE] bg-[#F2E9DE] px-3 py-2 text-sm text-[#5E5148]">
        {parentNames.parent1}: <span className="font-semibold text-[#2C2420]">{formatCurrency(annualTotals.paidByParent1)}$</span>
       </p>
       <p className="rounded-xl border border-[#E3D9CE] bg-[#F2E9DE] px-3 py-2 text-sm text-[#5E5148]">
        {parentNames.parent2}: <span className="font-semibold text-[#2C2420]">{formatCurrency(annualTotals.paidByParent2)}$</span>
       </p>
       <p className="rounded-xl border border-[#E3D9CE] bg-[#F2E9DE] px-3 py-2 text-sm text-[#5E5148]">
        Solde: <span className="font-semibold text-[#2C2420]">{annualBalanceText}</span>
       </p>
      </div>

      <div className="mt-5 rounded-xl border border-[#E3D9CE] bg-white p-3">
       <p className="text-xs font-semibold tracking-[0.12em] text-[#8A7A6E]">DÉPENSES PAR MOIS</p>

       <div className="mt-3 space-y-2">
        {annualMonthlyData.map((item) => {
         const width = maxMonthlyValue > 0 ? (item.total / maxMonthlyValue) * 100 : 0;

         return (
          <div key={item.month} className="grid grid-cols-[40px_1fr_68px] items-center gap-2">
           <span className="text-xs font-medium text-[#7A6D64]">{item.month}</span>
           <div className="h-3 rounded-full bg-[#EFE7DF]">
            <div
             className="h-3 rounded-full bg-[#7C6B5D]"
             style={{ width: `${Math.max(width, item.total > 0 ? 8 : 0)}%` }}
            />
           </div>
           <span className="text-right text-xs font-semibold text-[#4E4036]">{formatCurrency(item.total)}$</span>
          </div>
         );
        })}
       </div>
      </div>

      <div className="mt-4 rounded-xl border border-[#E3D9CE] bg-white p-3">
       <p className="text-xs font-semibold tracking-[0.12em] text-[#8A7A6E]">RÉPARTITION PAR CATÉGORIE</p>

       {annualCategoryData.length === 0 ? (
        <p className="mt-3 text-sm text-[#6B5D55]">Aucune dépense pour {selectedYear}.</p>
       ) : (
        <div className="mt-3 space-y-2">
         {annualCategoryData.map((item) => {
          const width = maxCategoryValue > 0 ? (item.value / maxCategoryValue) * 100 : 0;
          const meta = CATEGORY_META[item.name];
          const Icon = meta.icon;

          return (
           <div key={item.name} className="grid grid-cols-[1fr_68px] items-center gap-2">
            <div className="flex items-center gap-2">
             <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${meta.iconBg}`}>
              <Icon size={12} className={meta.iconFg} />
             </span>
             <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-[#5E5148]">{item.name}</p>
              <div className="mt-1 h-2 rounded-full bg-[#EFE7DF]">
               <div
                className="h-2 rounded-full bg-[#A89080]"
                style={{ width: `${Math.max(width, item.value > 0 ? 6 : 0)}%` }}
               />
              </div>
             </div>
            </div>
            <p className="text-right text-xs font-semibold text-[#4E4036]">{formatCurrency(item.value)}$</p>
           </div>
          );
         })}
        </div>
       )}
      </div>
     </section>
    )}
   </main>

   {isAddExpenseModalOpen && (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#2A211B66] p-0 sm:items-center sm:p-4">
     <div className="w-full max-w-xl rounded-t-2xl border border-[#E0D6CB] bg-[#FBF8F4] p-4 shadow-[0_20px_45px_rgba(32,24,18,0.18)] sm:rounded-2xl sm:p-5">
      <div className="mb-4 flex items-center justify-between">
       <h2 className="text-xl font-semibold text-[#2C2420]">Ajouter une dépense</h2>
       <button
        type="button"
        onClick={() => setIsAddExpenseModalOpen(false)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E0D6CB] bg-white text-[#6B5D55]"
        aria-label="Fermer"
       >
        <X size={16} />
       </button>
      </div>

      {formError && (
       <p className="mb-4 rounded-xl border border-[#E3D9CE] bg-[#F8E8E4] px-4 py-3 text-sm text-[#A85C52]">{formError}</p>
      )}

      <form className="space-y-3" onSubmit={onAddExpense}>
       <div>
        <label htmlFor="description" className="mb-1 block text-sm font-medium text-[#5E5148]">
         Titre / Description
        </label>
        <input
         id="description"
         type="text"
         value={description}
         disabled={isReadOnly}
         onChange={(event) => setDescription(event.target.value)}
         className="w-full rounded-xl border border-[#DCCFC3] bg-white px-3 py-2.5 text-sm text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/15"
         placeholder="Ex: Pharmacie"
        />
       </div>

       <div>
        <label htmlFor="amount" className="mb-1 block text-sm font-medium text-[#5E5148]">
         Montant ($)
        </label>
        <input
         id="amount"
         type="number"
         min="0"
         step="0.01"
         value={amount}
         disabled={isReadOnly}
         onChange={(event) => setAmount(event.target.value)}
         className="w-full rounded-xl border border-[#DCCFC3] bg-white px-3 py-2.5 text-sm text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/15"
         placeholder="0.00"
        />
       </div>

       <div>
        <p className="mb-2 text-sm font-medium text-[#5E5148]">Catégorie</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
         {CATEGORIES.map((item) => {
          const meta = CATEGORY_META[item];
          const Icon = meta.icon;
          const isSelected = category === item;

          return (
           <button
            key={item}
            type="button"
            disabled={isReadOnly}
            onClick={() => setCategory(item)}
            className={`rounded-xl border px-3 py-2 text-left transition ${
             isSelected
              ? "border-[#7C6B5D] bg-[#EFE7DF]"
              : "border-[#E0D6CB] bg-white hover:bg-[#F5EEE6]"
            }`}
           >
            <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${meta.iconBg}`}>
             <Icon size={12} className={meta.iconFg} />
            </span>
            <span className="mt-1 block text-xs font-medium text-[#4E4036]">{item}</span>
           </button>
          );
         })}
        </div>
       </div>

       <div>
        <label htmlFor="paidBy" className="mb-1 block text-sm font-medium text-[#5E5148]">
         Payé par
        </label>
        <select
         id="paidBy"
         value={paidBy}
         disabled={isReadOnly}
         onChange={(event) => setPaidBy(event.target.value as PaidBy)}
         className="w-full rounded-xl border border-[#DCCFC3] bg-white px-3 py-2.5 text-sm text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/15"
        >
         <option value="parent1">{parentNames.parent1}</option>
         <option value="parent2">{parentNames.parent2}</option>
        </select>
       </div>

       <div>
        <label htmlFor="expenseDate" className="mb-1 block text-sm font-medium text-[#5E5148]">
         Date
        </label>
        <input
         id="expenseDate"
         type="date"
         value={expenseDate}
         disabled={isReadOnly}
         onChange={(event) => setExpenseDate(event.target.value)}
         className="w-full rounded-xl border border-[#DCCFC3] bg-white px-3 py-2.5 text-sm text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-4 focus:ring-[#7C6B5D]/15"
        />
       </div>

       <div>
        <label htmlFor="receipt" className="mb-1 block text-sm font-medium text-[#5E5148]">
         Photo du reçu (optionnel)
        </label>
        <label
         htmlFor="receipt"
         className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#DCCFC3] bg-white px-3 py-2 text-sm font-medium text-[#5E5148] hover:bg-[#F5EEE6]"
        >
         <ReceiptText size={14} />
         Choisir un fichier
        </label>
        <input
         id="receipt"
         type="file"
         disabled={isReadOnly}
         accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
         onChange={onReceiptChange}
         className="hidden"
        />
        {receiptFile && <p className="mt-2 text-xs text-[#6B5D55]">Fichier: {receiptFile.name}</p>}
       </div>

       <button
        type="submit"
        disabled={isCreatingExpense || isReadOnly}
        className="mt-2 w-full rounded-xl bg-[#7C6B5D] px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(44,36,32,0.12)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
       >
        {isCreatingExpense ? "Ajout..." : "Ajouter"}
       </button>
      </form>
     </div>
    </div>
   )}

   {toast && (
    <div
     className={`fixed right-4 bottom-4 z-[60] max-w-sm rounded-xl border px-4 py-3 text-sm font-medium shadow-[0_14px_30px_rgba(45,105,64,0.2)] ${
      toast.variant === "success"
       ? "border-[#CFE2D2] bg-[#E8F3EA] text-[#3D7A4B]"
       : "border-[#E9CFC8] bg-[#F8E8E4] text-[#A85C52]"
     }`}
    >
     {toast.message}
    </div>
   )}

  </div>
 );
}
