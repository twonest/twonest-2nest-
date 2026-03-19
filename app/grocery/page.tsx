"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { ShoppingCart, Trash2 } from "lucide-react";
import AccessDeniedCard from "@/components/AccessDeniedCard";
import { useFamily } from "@/components/FamilyProvider";
import { getFeatureAccess } from "@/lib/family";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type GroceryCategoryKey =
  | "fruits_vegetables"
  | "meats_fish"
  | "dairy"
  | "bakery"
  | "household"
  | "pharmacy"
  | "other";

type GroceryItem = {
  id: string;
  familyId: string;
  name: string;
  quantity: string | null;
  category: GroceryCategoryKey;
  addedBy: string | null;
  addedByName: string | null;
  isChecked: boolean;
  isRecurring: boolean;
  createdAt: string;
};

type GroceryRow = Record<string, unknown>;

type CategoryMeta = {
  key: GroceryCategoryKey;
  title: string;
};

const CATEGORIES: CategoryMeta[] = [
  { key: "fruits_vegetables", title: "🥦 Fruits et légumes" },
  { key: "meats_fish", title: "🥩 Viandes et poissons" },
  { key: "dairy", title: "🥛 Produits laitiers" },
  { key: "bakery", title: "🍞 Boulangerie" },
  { key: "household", title: "🧴 Produits ménagers" },
  { key: "pharmacy", title: "💊 Pharmacie" },
  { key: "other", title: "📦 Autres" },
];

const CATEGORY_RULES: Array<{ category: GroceryCategoryKey; keywords: string[] }> = [
  { category: "dairy", keywords: ["lait", "yaourt", "yogourt", "fromage", "beurre", "creme", "oeuf", "oeufs"] },
  { category: "fruits_vegetables", keywords: ["pomme", "pommes", "banane", "bananes", "carotte", "legume", "fruit", "salade", "tomate"] },
  { category: "household", keywords: ["savon", "detergent", "papier", "essuie", "nettoyant", "javel", "sac poubelle"] },
  { category: "pharmacy", keywords: ["ibuprofene", "acetaminophene", "vitamine", "pansement", "sirop", "medicament"] },
  { category: "meats_fish", keywords: ["poulet", "boeuf", "porc", "saumon", "thon", "viande", "poisson"] },
  { category: "bakery", keywords: ["pain", "bagel", "croissant", "brioche", "muffin"] },
];

function safeText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeCategory(value: unknown): GroceryCategoryKey {
  const normalized = safeText(value).toLowerCase();
  for (const category of CATEGORIES) {
    if (category.key === normalized) {
      return category.key;
    }
  }
  return "other";
}

function detectCategory(itemName: string): GroceryCategoryKey {
  const normalized = itemName.trim().toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
      return rule.category;
    }
  }
  return "other";
}

export default function GroceryPage() {
  const router = useRouter();
  const { activeFamilyId, currentRole, currentPermissions } = useFamily();

  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("Parent");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState<GroceryItem[]>([]);

  const [inputName, setInputName] = useState("");
  const [inputQuantity, setInputQuantity] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isClearingChecked, setIsClearingChecked] = useState(false);

  const groceryAccess = currentRole
    ? getFeatureAccess("grocery", currentRole, currentPermissions)
    : { allowed: true, readOnly: false, reason: "" };

  const refreshItems = async (familyId: string) => {
    const supabase = getSupabaseBrowserClient();
    const response = await supabase
      .from("grocery_items")
      .select("*")
      .eq("family_id", familyId)
      .order("created_at", { ascending: false });

    if (response.error) {
      setError(response.error.message);
      return;
    }

    const mapped = ((response.data ?? []) as GroceryRow[])
      .map((row): GroceryItem | null => {
        const id = safeText(row.id);
        const familyIdValue = safeText(row.family_id);
        const name = safeText(row.name).trim();

        if (!id || !familyIdValue || !name) {
          return null;
        }

        return {
          id,
          familyId: familyIdValue,
          name,
          quantity: safeText(row.quantity).trim() || null,
          category: normalizeCategory(row.category),
          addedBy: safeText(row.added_by) || null,
          addedByName: safeText(row.added_by_name) || null,
          isChecked: Boolean(row.is_checked),
          isRecurring: Boolean(row.is_recurring),
          createdAt: safeText(row.created_at) || new Date().toISOString(),
        };
      })
      .filter((item): item is GroceryItem => item !== null);

    setItems(mapped);
    setError("");
  };

  useEffect(() => {
    let channelCleanup: (() => void) | null = null;

    const init = async () => {
      let supabase;

      try {
        supabase = getSupabaseBrowserClient();
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Configuration Supabase manquante.");
        setLoading(false);
        return;
      }

      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/");
        return;
      }

      setUser(data.user);

      const profileResponse = await supabase
        .from("profiles")
        .select("first_name, last_name, prenom, nom, email")
        .eq("user_id", data.user.id)
        .maybeSingle();

      const profile = (profileResponse.data ?? null) as Record<string, unknown> | null;
      const firstName = safeText(profile?.first_name ?? profile?.prenom).trim();
      const lastName = safeText(profile?.last_name ?? profile?.nom).trim();
      const fallbackName = safeText(profile?.email).split("@")[0] || "Parent";
      setDisplayName(`${firstName} ${lastName}`.trim() || fallbackName);

      if (!activeFamilyId) {
        setError("Aucun espace actif sélectionné.");
        setLoading(false);
        return;
      }

      await refreshItems(activeFamilyId);

      const channel = supabase
        .channel(`grocery-live-${activeFamilyId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "grocery_items",
            filter: `family_id=eq.${activeFamilyId}`,
          },
          async () => {
            await refreshItems(activeFamilyId);
          },
        )
        .subscribe();

      channelCleanup = () => {
        channel.unsubscribe();
      };

      setLoading(false);
    };

    void init();

    return () => {
      channelCleanup?.();
    };
  }, [activeFamilyId, router]);

  const groupedItems = useMemo(() => {
    const groups: Record<GroceryCategoryKey, GroceryItem[]> = {
      fruits_vegetables: [],
      meats_fish: [],
      dairy: [],
      bakery: [],
      household: [],
      pharmacy: [],
      other: [],
    };

    for (const item of items) {
      groups[item.category].push(item);
    }

    for (const key of Object.keys(groups) as GroceryCategoryKey[]) {
      groups[key].sort((a, b) => {
        if (a.isChecked !== b.isChecked) {
          return a.isChecked ? 1 : -1;
        }
        return b.createdAt.localeCompare(a.createdAt);
      });
    }

    return groups;
  }, [items]);

  const checkedCount = useMemo(() => items.filter((item) => item.isChecked).length, [items]);

  const onAddItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!activeFamilyId || !user || groceryAccess.readOnly) {
      return;
    }

    const name = inputName.trim();
    if (!name) {
      return;
    }

    setIsSaving(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const category = detectCategory(name);
      const response = await supabase.from("grocery_items").insert({
        family_id: activeFamilyId,
        name,
        quantity: inputQuantity.trim() || null,
        category,
        added_by: user.id,
        added_by_name: displayName,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      setInputName("");
      setInputQuantity("");
      await refreshItems(activeFamilyId);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Impossible d'ajouter cet item.");
    } finally {
      setIsSaving(false);
    }
  };

  const updateItem = async (itemId: string, patch: Record<string, unknown>) => {
    const supabase = getSupabaseBrowserClient();
    const response = await supabase
      .from("grocery_items")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", itemId);

    if (response.error) {
      throw new Error(response.error.message);
    }
  };

  const onToggleItem = async (item: GroceryItem, checked: boolean) => {
    if (!activeFamilyId || groceryAccess.readOnly) {
      return;
    }

    try {
      await updateItem(item.id, {
        is_checked: checked,
        checked_at: checked ? new Date().toISOString() : null,
      });
      await refreshItems(activeFamilyId);
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Impossible de mettre à jour cet item.");
    }
  };

  const onToggleRecurring = async (item: GroceryItem, recurring: boolean) => {
    if (!activeFamilyId || groceryAccess.readOnly) {
      return;
    }

    try {
      await updateItem(item.id, { is_recurring: recurring });
      await refreshItems(activeFamilyId);
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Impossible de mettre à jour la récurrence.");
    }
  };

  const onClearChecked = async () => {
    if (!activeFamilyId || groceryAccess.readOnly || checkedCount === 0) {
      return;
    }

    setIsClearingChecked(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const checkedItems = items.filter((item) => item.isChecked);
      const recurringIds = checkedItems.filter((item) => item.isRecurring).map((item) => item.id);
      const nonRecurringIds = checkedItems.filter((item) => !item.isRecurring).map((item) => item.id);

      if (recurringIds.length > 0) {
        const recurringResult = await supabase
          .from("grocery_items")
          .update({ is_checked: false, checked_at: null, updated_at: new Date().toISOString() })
          .in("id", recurringIds);

        if (recurringResult.error) {
          throw new Error(recurringResult.error.message);
        }
      }

      if (nonRecurringIds.length > 0) {
        const deleteResult = await supabase
          .from("grocery_items")
          .delete()
          .in("id", nonRecurringIds);

        if (deleteResult.error) {
          throw new Error(deleteResult.error.message);
        }
      }

      await refreshItems(activeFamilyId);
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : "Impossible de vider les items cochés.");
    } finally {
      setIsClearingChecked(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center rounded-2xl border border-[#E2D8CF] bg-white px-6">
        <p className="text-sm font-medium text-[#6B5D55]">Chargement de la liste d'épicerie...</p>
      </div>
    );
  }

  if (currentRole && !groceryAccess.allowed) {
    return <AccessDeniedCard title="Liste d'épicerie" message={groceryAccess.reason} />;
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-[#DED2C7] bg-white p-4 shadow-[0_2px_10px_rgba(44,36,32,0.06)] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#E9E0D6] text-[#6E6053]">
              <ShoppingCart size={20} />
            </span>
            <div>
              <h2 className="text-2xl font-bold text-[#2C2420]">Liste d'épicerie partagée</h2>
              <p className="text-xs text-[#7B6D62]">Temps réel entre co-parents</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClearChecked}
            disabled={groceryAccess.readOnly || checkedCount === 0 || isClearingChecked}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#D7CCC1] bg-white px-4 text-sm font-semibold text-[#5E544B] transition hover:bg-[#F5F0EB] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 size={16} />
            Vider les items cochés
          </button>
        </div>

        <form onSubmit={onAddItem} className="mt-4 grid gap-2 sm:grid-cols-[1fr_120px_auto]">
          <input
            value={inputName}
            onChange={(event) => setInputName(event.target.value)}
            placeholder="Ajouter un item..."
            disabled={groceryAccess.readOnly || isSaving}
            className="rounded-xl border border-[#D8CCC0] bg-white px-3 py-2 text-sm text-[#403831]"
          />
          <input
            value={inputQuantity}
            onChange={(event) => setInputQuantity(event.target.value)}
            placeholder="Quantité"
            disabled={groceryAccess.readOnly || isSaving}
            className="rounded-xl border border-[#D8CCC0] bg-white px-3 py-2 text-sm text-[#403831]"
          />
          <button
            type="submit"
            disabled={groceryAccess.readOnly || isSaving || inputName.trim().length === 0}
            className="rounded-xl bg-[#7C6B5D] px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Ajouter
          </button>
        </form>

        {error ? (
          <p className="mt-3 rounded-xl border border-[#E6C8BD] bg-[#FBEFEB] px-3 py-2 text-sm text-[#A85C52]">{error}</p>
        ) : null}
      </section>

      <section className="space-y-4">
        {CATEGORIES.map((category) => {
          const categoryItems = groupedItems[category.key];

          return (
            <article key={category.key} className="rounded-2xl border border-[#DED2C7] bg-white p-4">
              <h3 className="text-sm font-bold tracking-wide text-[#433A32]">{category.title}</h3>

              {categoryItems.length === 0 ? (
                <p className="mt-3 text-sm text-[#7B6D62]">Aucun item.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {categoryItems.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-xl border px-3 py-2 ${item.isChecked ? "border-[#E0D7CF] bg-[#F5F0EB]" : "border-[#E1D6CB] bg-white"}`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onToggleItem(item, !item.isChecked)}
                          disabled={groceryAccess.readOnly}
                          aria-label={item.isChecked ? "Décocher" : "Cocher"}
                          className={`h-6 w-6 rounded-full border-2 transition ${
                            item.isChecked
                              ? "border-[#6B8F71] bg-[#6B8F71]"
                              : "border-[#B9ACA0] bg-white hover:border-[#7C6B5D]"
                          }`}
                        >
                          <span className="block text-center text-[12px] font-bold text-white">{item.isChecked ? "✓" : ""}</span>
                        </button>

                        <p className={`text-sm font-semibold ${item.isChecked ? "text-[#9D9187 line-through" : "text-[#2C2420]"}`}>
                          {item.name}
                        </p>

                        {item.quantity ? (
                          <span className="rounded-full bg-[#EFE8E0] px-2 py-0.5 text-xs font-semibold text-[#5D534A]">
                            {item.quantity}
                          </span>
                        ) : null}

                        <span className="rounded-full bg-[#F4EEE7] px-2 py-0.5 text-xs text-[#6D6258]">
                          Ajouté par {item.addedByName || "Parent"}
                        </span>

                        <label className="ml-auto inline-flex items-center gap-2 text-xs font-semibold text-[#6D6258]">
                          Récurrent
                          <input
                            type="checkbox"
                            checked={item.isRecurring}
                            disabled={groceryAccess.readOnly}
                            onChange={(event) => onToggleRecurring(item, event.target.checked)}
                            className="h-4 w-4"
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
