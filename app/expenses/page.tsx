"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type ExpenseCategory = "Médical" | "Scolaire" | "Vêtements" | "Activités" | "Nourriture" | "Autre";
type PaidBy = "parent1" | "parent2";

type ExpenseItem = {
  id: string;
  amount: number;
  description: string;
  category: ExpenseCategory;
  paidBy: PaidBy;
  expenseDate: string;
  reimbursed: boolean;
  receiptUrl: string | null;
};

type SupabaseExpenseRow = {
  id?: string | number;
  amount?: number | string;
  montant?: number | string;
  description?: string;
  label?: string;
  category?: string;
  categorie?: string;
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
  receipt_url?: string;
  receipt_file_url?: string;
  justificatif_url?: string;
  file_url?: string;
};

type ToastState = {
  message: string;
  variant: "success" | "error";
};

const CATEGORIES: ExpenseCategory[] = ["Médical", "Scolaire", "Vêtements", "Activités", "Nourriture", "Autre"];
const SHARED_MONTH_KEY = "twonest.selectedMonth";

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

function isReceiptFromBucket(url: string | null): boolean {
  if (!url) {
    return false;
  }

  return (
    url.includes("/storage/v1/object/public/receipts/") ||
    url.includes("/storage/v1/object/sign/receipts/")
  );
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

export default function ExpensesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [configError, setConfigError] = useState("");

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
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [receiptMimeType, setReceiptMimeType] = useState("");

  const [selectedMonth, setSelectedMonth] = useState(() => toMonthValue(new Date().toISOString()));
  const [showAllHistory] = useState(true);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [receiptViewerExpense, setReceiptViewerExpense] = useState<ExpenseItem | null>(null);

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

    const mapped = (data as SupabaseExpenseRow[])
      .map((row): ExpenseItem | null => {
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
          statusText === "reimbursed";

        const rawReceiptUrl = row.receipt_url ?? row.receipt_file_url ?? row.justificatif_url ?? row.file_url ?? null;
        const normalizedReceiptUrl = isReceiptFromBucket(rawReceiptUrl) ? rawReceiptUrl : null;

        return {
          id: String(row.id),
          amount: parsedAmount,
          description: row.description ?? row.label ?? "Sans description",
          category: normalizeCategory(row.category ?? row.categorie),
          paidBy: normalizePaidBy(row.paid_by ?? row.payer ?? row.parent),
          expenseDate: rawDate,
          reimbursed,
          receiptUrl: normalizedReceiptUrl,
        };
      })
      .filter((expense): expense is ExpenseItem => expense !== null);

    setExpenses(mapped);
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
      setCheckingSession(false);
      await refreshExpenses(supabase);
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
          paid_by: paidBy,
          expense_date: expenseDate,
          receipt_url: uploadedReceiptUrl,
          reimbursed: false,
          status: "unpaid",
        },
        {
          owner_id: user.id,
          amount: parsedAmount,
          description: description.trim(),
          category,
          paid_by: paidBy,
          expense_date: expenseDate,
          receipt_file_url: uploadedReceiptUrl,
          reimbursed: false,
          status: "unpaid",
        },
        {
          owner_id: user.id,
          montant: parsedAmount,
          label: description.trim(),
          categorie: category,
          parent: paidBy,
          date: expenseDate,
          justificatif_url: uploadedReceiptUrl,
          status: "Non remboursé",
        },
        {
          owner_id: user.id,
          montant: parsedAmount,
          label: description.trim(),
          categorie: category,
          parent: paidBy,
          date: expenseDate,
          status: "Non remboursé",
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
      setReceiptMimeType("");
      if (receiptPreviewUrl) {
        URL.revokeObjectURL(receiptPreviewUrl);
      }
      setReceiptPreviewUrl(null);
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
          .update({ status: "Remboursé", reimbursed_at: nowIso })
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
    let scopedExpenses = expenses;

    if (!showAllHistory) {
      scopedExpenses = expenses.filter((expense) => {
        const month = toMonthValue(expense.expenseDate);
        return month === selectedMonth;
      });
    }

    const hasPeriodFilter = periodStart.length > 0 || periodEnd.length > 0;
    if (!hasPeriodFilter) {
      return scopedExpenses;
    }

    return scopedExpenses.filter((expense) => {
      const expenseDateOnly = toDateOnlyValue(expense.expenseDate);
      if (!expenseDateOnly) {
        return false;
      }

      if (periodStart && expenseDateOnly < periodStart) {
        return false;
      }

      if (periodEnd && expenseDateOnly > periodEnd) {
        return false;
      }

      return true;
    });
  }, [expenses, periodEnd, periodStart, selectedMonth, showAllHistory]);

  const monthTotal = useMemo(() => {
    return filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  }, [filteredExpenses]);

  const reimbursedTotal = useMemo(() => {
    return filteredExpenses.reduce((sum, expense) => (expense.reimbursed ? sum + expense.amount : sum), 0);
  }, [filteredExpenses]);

  const balance = useMemo(() => {
    let net = 0;

    for (const expense of filteredExpenses) {
      if (expense.reimbursed) {
        continue;
      }

      if (expense.paidBy === "parent1") {
        net += expense.amount / 2;
      } else {
        net -= expense.amount / 2;
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

  if (checkingSession || isLoadingExpenses) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#F6FAFF] to-[#EEF5FC] px-6">
        <p className="text-sm font-medium text-[#5B7691]">Chargement des dépenses...</p>
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
            <p className="text-xs font-semibold tracking-[0.2em] text-[#5F81A3]">FINANCES</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#17324D]">💸 Dépenses</h1>
          </div>

          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-xl border border-[#D0DFEE] px-4 py-2 text-sm font-semibold text-[#365A7B] transition hover:bg-[#F1F7FD]"
          >
            ← Retour
          </Link>
        </header>

        <section className="rounded-2xl border border-[#D7E6F4] bg-white p-4 shadow-[0_10px_28px_rgba(74,144,217,0.08)] sm:p-5">
          <p className="text-xs font-semibold tracking-[0.2em] text-[#5F81A3]">FORMULAIRE D'AJOUT</p>
          <h2 className="mb-4 mt-1 text-xl font-semibold text-[#17324D]">Ajouter une dépense</h2>

          {formError && (
            <p className="mb-4 rounded-xl border border-[#E3B4B8] bg-[#FFF4F5] px-4 py-3 text-sm text-[#8D3E45]">{formError}</p>
          )}

          <form className="grid gap-3 sm:grid-cols-2" onSubmit={onAddExpense}>
            <div>
              <label htmlFor="amount" className="mb-1 block text-sm font-medium text-[#2D4B68]">
                Montant ($)
              </label>
              <input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="w-full rounded-xl border border-[#D8E4F0] px-3 py-2.5 text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
                placeholder="0.00"
              />
            </div>

            <div>
              <label htmlFor="description" className="mb-1 block text-sm font-medium text-[#2D4B68]">
                Description
              </label>
              <input
                id="description"
                type="text"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="w-full rounded-xl border border-[#D8E4F0] px-3 py-2.5 text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
                placeholder="Ex: Pharmacie"
              />
            </div>

            <div>
              <label htmlFor="category" className="mb-1 block text-sm font-medium text-[#2D4B68]">
                Catégorie
              </label>
              <select
                id="category"
                value={category}
                onChange={(event) => setCategory(event.target.value as ExpenseCategory)}
                className="w-full rounded-xl border border-[#D8E4F0] px-3 py-2.5 text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
              >
                {CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="paidBy" className="mb-1 block text-sm font-medium text-[#2D4B68]">
                Payé par
              </label>
              <select
                id="paidBy"
                value={paidBy}
                onChange={(event) => setPaidBy(event.target.value as PaidBy)}
                className="w-full rounded-xl border border-[#D8E4F0] px-3 py-2.5 text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
              >
                <option value="parent1">Parent 1</option>
                <option value="parent2">Parent 2</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="expenseDate" className="mb-1 block text-sm font-medium text-[#2D4B68]">
                Date de la dépense
              </label>
              <input
                id="expenseDate"
                type="date"
                value={expenseDate}
                onChange={(event) => setExpenseDate(event.target.value)}
                className="w-full rounded-xl border border-[#D8E4F0] px-3 py-2.5 text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
              />
            </div>

            <div className="sm:col-span-2 rounded-xl border border-[#D8E4F0] bg-[#F8FBFF] p-3">
              <label htmlFor="receipt" className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-[#E8F2FC] px-4 py-2 text-sm font-semibold text-[#2E6395] transition hover:brightness-95">
                📎 Ajouter un reçu
              </label>
              <input
                id="receipt"
                type="file"
                accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                onChange={onReceiptChange}
                className="hidden"
              />
              <p className="mt-2 text-xs text-[#5E7A95]">Formats acceptés: JPG, PNG, PDF</p>

              {receiptFile && (
                <p className="mt-2 text-sm font-medium text-[#2D4B68]">Fichier sélectionné: {receiptFile.name}</p>
              )}

              {receiptPreviewUrl && receiptMimeType.startsWith("image/") && (
                <div className="mt-3 overflow-hidden rounded-xl border border-[#D0DFEE] bg-white p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={receiptPreviewUrl} alt="Aperçu du reçu" className="max-h-52 w-auto rounded-lg object-contain" />
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isCreatingExpense}
              className="sm:col-span-2 mt-1 w-full rounded-xl bg-[#4A90D9] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(74,144,217,0.35)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isCreatingExpense ? "Ajout..." : "Ajouter la dépense"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-[#D7E6F4] bg-white p-4 shadow-[0_10px_28px_rgba(74,144,217,0.08)] sm:p-5">
          <p className="text-xs font-semibold tracking-[0.2em] text-[#5F81A3]">TABLEAU DE BORD DES DÉPENSES</p>
          <h2 className="mb-3 mt-1 text-xl font-semibold text-[#17324D]">Suivi et remboursements</h2>

          <div className="mb-4 rounded-2xl border border-[#CFE1F2] bg-[#F4F9FF] px-4 py-3">
            <p className="text-xs font-semibold tracking-[0.18em] text-[#5F81A3]">HISTORIQUE</p>
            <p className="mt-1 text-lg font-semibold text-[#1F4D77]">Toutes les dépenses</p>
          </div>

          <div className="mb-4 rounded-2xl border border-[#D7E6F4] bg-[#F8FBFF] p-3">
            <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-[#5F81A3]">PÉRIODE</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <input
                type="date"
                value={periodStart}
                onChange={(event) => setPeriodStart(event.target.value)}
                className="w-full rounded-xl border border-[#D8E4F0] px-3 py-2.5 text-sm text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
                aria-label="Date de début"
              />
              <input
                type="date"
                value={periodEnd}
                onChange={(event) => setPeriodEnd(event.target.value)}
                className="w-full rounded-xl border border-[#D8E4F0] px-3 py-2.5 text-sm text-[#1D3145] outline-none transition focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/20"
                aria-label="Date de fin"
              />
              <button
                type="button"
                onClick={() => {
                  setPeriodStart("");
                  setPeriodEnd("");
                }}
                className="rounded-xl border border-[#D0DFEE] bg-white px-3 py-2 text-sm font-semibold text-[#365A7B] transition hover:bg-[#F1F7FD]"
              >
                Effacer la période
              </button>
            </div>
          </div>

          {listError && (
            <p className="mb-4 rounded-xl border border-[#E3B4B8] bg-[#FFF4F5] px-4 py-3 text-sm text-[#8D3E45]">{listError}</p>
          )}

          <div className="space-y-3">
            {filteredExpenses.length === 0 ? (
              <p className="rounded-xl border border-[#D7E6F4] bg-[#F8FBFF] px-4 py-3 text-sm text-[#4A6783]">
                {showAllHistory
                  ? "Aucune dépense enregistrée pour le moment."
                  : `Aucune dépense pour ${formatMonthLabel(selectedMonth)}.`}
              </p>
            ) : (
              filteredExpenses.map((expense) => (
                <article key={expense.id} className="rounded-xl border border-[#D7E6F4] bg-[#FAFCFF] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-lg font-semibold text-[#17324D]">{formatCurrency(expense.amount)}$</p>
                      <p className="mt-1 text-sm font-medium text-[#2D4B68]">{expense.description}</p>
                      <p className="mt-1 text-xs text-[#5E7A95]">
                        {expense.category} · {new Date(expense.expenseDate).toLocaleDateString("fr-CA")}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs font-semibold text-[#5F81A3]">Payé par</p>
                      <p className={`mt-1 rounded-full px-3 py-1 text-xs font-semibold ${
                        expense.paidBy === "parent1"
                          ? "bg-[#E8F2FC] text-[#2E6395]"
                          : "bg-[#E9F8EE] text-[#2D6940]"
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
                            ? "border border-[#BDDCC5] bg-[#F2FAF4] text-[#2D6940]"
                            : "border border-[#F5E4A8] bg-[#FFF9E8] text-[#8A6A00]"
                        }`}
                      >
                        {expense.reimbursed ? "Remboursé" : "Non remboursé"}
                      </span>
                      {expense.receiptUrl && getReceiptType(expense.receiptUrl) === "image" && (
                        <button
                          type="button"
                          onClick={() => openReceiptViewer(expense)}
                          className="overflow-hidden rounded-lg border border-[#D0DFEE] bg-white transition hover:brightness-95"
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

                      {(!expense.receiptUrl || getReceiptType(expense.receiptUrl) !== "image") && (
                        <span className="text-xs font-medium text-[#7A8FA5]">Aucun reçu</span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {!expense.reimbursed && (
                        <button
                          type="button"
                          onClick={() => onMarkReimbursed(expense.id)}
                          disabled={isMarkingReimbursed || deletingExpenseId === expense.id}
                          className="rounded-xl bg-[#4A90D9] px-3 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          Marquer comme remboursé
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onDeleteExpense(expense)}
                        disabled={deletingExpenseId === expense.id || isMarkingReimbursed}
                        className="rounded-xl border border-[#E3B4B8] bg-[#FFF4F5] px-3 py-2 text-sm font-semibold text-[#8D3E45] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {deletingExpenseId === expense.id ? "Suppression..." : "Supprimer"}
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-[#CFE1F2] bg-[#F4F9FF] px-4 py-3">
            <p className="text-xs font-semibold tracking-[0.18em] text-[#5F81A3]">
              RÉCAPITULATIF {showAllHistory ? "GLOBAL" : `DE ${formatMonthLabel(selectedMonth).toUpperCase()}`}
            </p>
            <div className="mt-2 grid gap-2 text-sm text-[#2D4B68] sm:grid-cols-3">
              <p>Total des dépenses: <span className="font-semibold text-[#17324D]">{formatCurrency(monthTotal)}$</span></p>
              <p>Total remboursé: <span className="font-semibold text-[#17324D]">{formatCurrency(reimbursedTotal)}$</span></p>
              <p>Solde restant: <span className="font-semibold text-[#17324D]">{balanceText}</span></p>
            </div>
          </div>
        </section>
      </main>

      {receiptViewerExpense?.receiptUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F223680] p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-white/70 bg-white p-5 shadow-[0_20px_60px_rgba(15,36,54,0.22)]">
            <div className="overflow-hidden rounded-xl border border-[#D7E6F4] bg-[#F8FBFF]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={receiptViewerExpense.receiptUrl} alt="Reçu" className="max-h-[70vh] w-full object-contain" />
            </div>

            <div className="mt-4 space-y-1">
              <p className="text-sm text-[#5E7A95]">Montant</p>
              <p className="text-base font-semibold text-[#17324D]">{formatCurrency(receiptViewerExpense.amount)}$</p>
              <p className="pt-1 text-sm text-[#5E7A95]">Description</p>
              <p className="text-sm font-medium text-[#2D4B68]">{receiptViewerExpense.description}</p>
            </div>

            <button
              type="button"
              onClick={closeReceiptViewer}
              className="mt-5 w-full rounded-xl border border-[#D0DFEE] bg-white px-4 py-2.5 text-sm font-semibold text-[#365A7B] transition hover:bg-[#F1F7FD]"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed right-4 bottom-4 z-[60] max-w-sm rounded-xl border px-4 py-3 text-sm font-medium shadow-[0_14px_30px_rgba(45,105,64,0.2)] ${
            toast.variant === "success"
              ? "border-[#BDDCC5] bg-[#F2FAF4] text-[#2D6940]"
              : "border-[#E3B4B8] bg-[#FFF4F5] text-[#8D3E45]"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
