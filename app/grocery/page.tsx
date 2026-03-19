"use client";

import { FormEvent, MouseEvent, TouchEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  Baby,
  Beef,
  Check,
  CheckCircle2,
  ChevronRight,
  CirclePlus,
  Droplets,
  FlaskConical,
  Milk,
  Package,
  Pill,
  Plus,
  ShoppingCart,
  Sparkles,
  Trash2,
  Wheat,
  Wind,
} from "lucide-react";
import { useFamily } from "@/components/FamilyProvider";
import { getFeatureAccess } from "@/lib/family";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type GroceryCategory =
  | "fruits_vegetables"
  | "meats_fish"
  | "dairy"
  | "bakery"
  | "dry_goods"
  | "frozen"
  | "drinks"
  | "household"
  | "hygiene_beauty"
  | "pharmacy"
  | "baby_kids"
  | "other";

type GroceryItem = {
  id: string;
  familyId: string;
  name: string;
  quantity: string | null;
  category: GroceryCategory;
  addedBy: string | null;
  addedByName: string | null;
  isChecked: boolean;
  isRecurring: boolean;
  checkedAt: string | null;
  checkedByName: string | null;
  createdAt: string;
};

type GroceryRow = Record<string, unknown>;

type CategoryConfig = {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

type ContextMenuState = {
  item: GroceryItem;
  x: number;
  y: number;
};

const CATEGORY_ORDER: GroceryCategory[] = [
  "fruits_vegetables",
  "meats_fish",
  "dairy",
  "bakery",
  "dry_goods",
  "frozen",
  "drinks",
  "household",
  "hygiene_beauty",
  "pharmacy",
  "baby_kids",
  "other",
];

const CATEGORY_CONFIG: Record<GroceryCategory, CategoryConfig> = {
  fruits_vegetables: { label: "Fruits et legumes", icon: Wind },
  meats_fish: { label: "Viandes et poissons", icon: Beef },
  dairy: { label: "Produits laitiers", icon: Milk },
  bakery: { label: "Boulangerie", icon: Wheat },
  dry_goods: { label: "Epicerie seche", icon: Package },
  frozen: { label: "Surgeles", icon: SnowflakeIcon },
  drinks: { label: "Boissons", icon: Droplets },
  household: { label: "Produits menagers", icon: Sparkles },
  hygiene_beauty: { label: "Hygiene et beaute", icon: FlaskConical },
  pharmacy: { label: "Pharmacie", icon: Pill },
  baby_kids: { label: "Bebe et enfants", icon: Baby },
  other: { label: "Autre", icon: ChevronRight },
};

function SnowflakeIcon({ size = 16, className }: { size?: number; className?: string }) {
  return <Wind size={size} className={className} />;
}

function safeText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeCategory(raw: string): GroceryCategory {
  const value = raw.toLowerCase().trim();
  if (CATEGORY_ORDER.includes(value as GroceryCategory)) {
    return value as GroceryCategory;
  }

  if (value === "fruits" || value === "vegetables") {
    return "fruits_vegetables";
  }
  if (value === "meat") {
    return "meats_fish";
  }
  if (value === "condiments") {
    return "dry_goods";
  }
  if (value === "drinks") {
    return "drinks";
  }
  return "other";
}

function formatDateShort(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "date inconnue";
  }
  return date.toLocaleDateString("fr-CA", { day: "2-digit", month: "long", year: "numeric" });
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "heure inconnue";
  }
  return `${date.toLocaleDateString("fr-CA", { day: "2-digit", month: "long" })} a ${date.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}`;
}

function guessCategory(name: string): GroceryCategory {
  const n = name.toLowerCase();

  if (n.match(/pomme|banane|raisin|orange|tomate|carotte|brocoli|salade|epinard|concombre|fruit|legume/)) {
    return "fruits_vegetables";
  }
  if (n.match(/boeuf|poulet|dinde|saumon|thon|viande|poisson|steak|porc/)) {
    return "meats_fish";
  }
  if (n.match(/lait|yaourt|fromage|beurre|creme|mozzarella/)) {
    return "dairy";
  }
  if (n.match(/pain|bagel|croissant|brioche|miche/)) {
    return "bakery";
  }
  if (n.match(/riz|pate|pates|farine|cereale|lentille|haricot|quinoa|huile/)) {
    return "dry_goods";
  }
  if (n.match(/surgele|pizza congelee|frite|legume congele|glace/)) {
    return "frozen";
  }
  if (n.match(/jus|eau|lait vegetal|cafe|the|boisson|soda/)) {
    return "drinks";
  }
  if (n.match(/detergent|savon menager|essuie|nettoyant|javel|liquide vaisselle/)) {
    return "household";
  }
  if (n.match(/shampoing|dentifrice|deodorant|creme|hygiene|beaute/)) {
    return "hygiene_beauty";
  }
  if (n.match(/ibuprofene|acetaminophene|pansement|vitamine|pharmacie/)) {
    return "pharmacy";
  }
  if (n.match(/couche|lingette|lait bebe|compote bebe|bebe|enfant/)) {
    return "baby_kids";
  }

  return "other";
}

function firstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return "Parent";
  }
  return trimmed.split(" ")[0] ?? "Parent";
}

export default function GroceryPage() {
  const router = useRouter();
  const { activeFamilyId, currentRole, currentPermissions } = useFamily();

  const inputRef = useRef<HTMLInputElement>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("Parent");
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inputName, setInputName] = useState("");
  const [inputQuantity, setInputQuantity] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isCreatingNewList, setIsCreatingNewList] = useState(false);
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);
  const [newListOpen, setNewListOpen] = useState(false);
  const [importRecurringOnNewList, setImportRecurringOnNewList] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [swipeOffsets, setSwipeOffsets] = useState<Record<string, number>>({});

  const groceryAccess = currentRole
    ? getFeatureAccess("grocery", currentRole, currentPermissions)
    : { allowed: true, readOnly: false, reason: "" };

  const refreshItems = async (familyId: string, client = getSupabaseBrowserClient()) => {
    const response = await client
      .from("grocery_items")
      .select("*")
      .eq("family_id", familyId)
      .order("created_at", { ascending: true });

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
          category: normalizeCategory(safeText(row.category)),
          addedBy: safeText(row.added_by) || null,
          addedByName: safeText(row.added_by_name) || null,
          isChecked: Boolean(row.is_checked),
          isRecurring: Boolean(row.is_recurring),
          checkedAt: safeText(row.checked_at) || null,
          checkedByName: safeText(row.checked_by_name) || null,
          createdAt: safeText(row.created_at) || new Date().toISOString(),
        };
      })
      .filter((item): item is GroceryItem => item !== null);

    setItems(mapped);
    setError("");
  };

  useEffect(() => {
    let cleanupRealtime: (() => void) | null = null;

    const init = async () => {
      let client;
      try {
        client = getSupabaseBrowserClient();
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Configuration Supabase manquante.");
        setLoading(false);
        return;
      }

      const auth = await client.auth.getUser();
      if (!auth.data.user) {
        router.replace("/");
        return;
      }

      setUser(auth.data.user);

      const profileResponse = await client
        .from("profiles")
        .select("first_name, last_name, prenom, nom, email")
        .eq("user_id", auth.data.user.id)
        .maybeSingle();

      const profile = (profileResponse.data ?? null) as Record<string, unknown> | null;
      const first = safeText(profile?.first_name ?? profile?.prenom).trim();
      const last = safeText(profile?.last_name ?? profile?.nom).trim();
      const fallbackName = safeText(profile?.email).split("@")[0] || "Parent";
      setDisplayName(`${first} ${last}`.trim() || fallbackName);

      if (!activeFamilyId) {
        setError("Aucun espace actif sélectionné.");
        setLoading(false);
        return;
      }

      await refreshItems(activeFamilyId, client);

      const channel = client
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
            await refreshItems(activeFamilyId, client);
          },
        )
        .subscribe();

      cleanupRealtime = () => {
        channel.unsubscribe();
      };

      setLoading(false);
    };

    void init();

    return () => {
      cleanupRealtime?.();
    };
  }, [activeFamilyId, router]);

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  const activeItems = useMemo(() => items.filter((item) => !item.isChecked), [items]);
  const checkedItems = useMemo(() => items.filter((item) => item.isChecked), [items]);
  const itemCount = activeItems.length;

  const createdByLabel = useMemo(() => {
    if (items.length === 0) {
      return null;
    }
    const first = [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    if (!first) {
      return null;
    }
    return `${first.addedByName || "Parent"} le ${formatDateShort(first.createdAt)}`;
  }, [items]);

  const latestCompletion = useMemo(() => {
    if (activeItems.length > 0 || checkedItems.length === 0) {
      return null;
    }
    const latest = [...checkedItems]
      .filter((item) => item.checkedAt)
      .sort((a, b) => (b.checkedAt || "").localeCompare(a.checkedAt || ""))[0];

    if (!latest || !latest.checkedAt) {
      return null;
    }

    return {
      by: latest.checkedByName || latest.addedByName || "Parent",
      at: latest.checkedAt,
    };
  }, [activeItems.length, checkedItems]);

  const grouped = useMemo(() => {
    const groups = new Map<GroceryCategory, { active: GroceryItem[]; checked: GroceryItem[] }>();
    for (const cat of CATEGORY_ORDER) {
      groups.set(cat, { active: [], checked: [] });
    }

    for (const item of items) {
      const bucket = groups.get(item.category) || { active: [], checked: [] };
      if (item.isChecked) {
        bucket.checked.push(item);
      } else {
        bucket.active.push(item);
      }
      groups.set(item.category, bucket);
    }

    return CATEGORY_ORDER
      .map((category) => ({ category, ...groups.get(category)! }))
      .filter((entry) => entry.active.length > 0 || entry.checked.length > 0);
  }, [items]);

  const recurringTemplates = useMemo(() => {
    const uniq = new Map<string, GroceryItem>();
    for (const item of items) {
      if (!item.isRecurring) {
        continue;
      }
      const key = `${item.name.toLowerCase()}|${item.quantity ?? ""}|${item.category}`;
      if (!uniq.has(key)) {
        uniq.set(key, item);
      }
    }
    return Array.from(uniq.values());
  }, [items]);

  const sendCoparentNotification = async (message: string) => {
    if (!activeFamilyId || !user) {
      return;
    }

    const client = getSupabaseBrowserClient();
    await client.from("messages").insert({
      family_id: activeFamilyId,
      sender_id: user.id,
      content: message,
    });
  };

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
      const client = getSupabaseBrowserClient();
      const result = await client.from("grocery_items").insert({
        family_id: activeFamilyId,
        name,
        quantity: inputQuantity.trim() || null,
        category: guessCategory(name),
        added_by: user.id,
        added_by_name: displayName,
        is_checked: false,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      setInputName("");
      setInputQuantity("");
      setStatusMessage("Item ajoute a la liste.");
      inputRef.current?.focus();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("twonest:grocery-added"));
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Impossible d'ajouter cet item.");
    } finally {
      setIsSaving(false);
    }
  };

  const updateCheckedState = async (item: GroceryItem, checked: boolean) => {
    const client = getSupabaseBrowserClient();
    const payload: Record<string, unknown> = {
      is_checked: checked,
      checked_at: checked ? new Date().toISOString() : null,
      checked_by_name: checked ? firstName(displayName) : null,
    };

    const response = await client.from("grocery_items").update(payload).eq("id", item.id);
    if (!response.error) {
      return;
    }

    // Backward compatibility if checked_by_name column is not created yet.
    const fallback = await client
      .from("grocery_items")
      .update({
        is_checked: checked,
        checked_at: checked ? new Date().toISOString() : null,
      })
      .eq("id", item.id);

    if (fallback.error) {
      throw new Error(fallback.error.message);
    }
  };

  const onToggleItem = async (item: GroceryItem, checked: boolean) => {
    if (groceryAccess.readOnly) {
      return;
    }
    try {
      await updateCheckedState(item, checked);
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Impossible de mettre a jour l'item.");
    }
  };

  const onDeleteItem = async (id: string) => {
    if (groceryAccess.readOnly) {
      return;
    }

    try {
      const client = getSupabaseBrowserClient();
      const response = await client.from("grocery_items").delete().eq("id", id);
      if (response.error) {
        throw new Error(response.error.message);
      }
      setStatusMessage("Item supprime.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Suppression impossible.");
    }
  };

  const onCompleteList = async () => {
    if (!activeFamilyId || groceryAccess.readOnly || activeItems.length === 0) {
      setConfirmCompleteOpen(false);
      return;
    }

    setIsCompleting(true);
    try {
      const client = getSupabaseBrowserClient();
      const completionDate = new Date().toISOString();

      const response = await client
        .from("grocery_items")
        .update({ is_checked: true, checked_at: completionDate, checked_by_name: firstName(displayName) })
        .eq("family_id", activeFamilyId)
        .eq("is_checked", false);

      if (response.error) {
        const fallback = await client
          .from("grocery_items")
          .update({ is_checked: true, checked_at: completionDate })
          .eq("family_id", activeFamilyId)
          .eq("is_checked", false);
        if (fallback.error) {
          throw new Error(fallback.error.message);
        }
      }

      await sendCoparentNotification(`${firstName(displayName)} a termine l'epicerie ! 🛒`);
      setStatusMessage(`${firstName(displayName)} a complete l'epicerie le ${formatDateTime(completionDate)}`);
      setConfirmCompleteOpen(false);
    } catch (completeError) {
      setError(completeError instanceof Error ? completeError.message : "Impossible de completer la liste.");
    } finally {
      setIsCompleting(false);
    }
  };

  const addAllRecurringItems = async () => {
    if (!activeFamilyId || !user || groceryAccess.readOnly || recurringTemplates.length === 0) {
      return;
    }

    const existingKeys = new Set(activeItems.map((item) => `${item.name.toLowerCase()}|${item.category}`));
    const toInsert = recurringTemplates
      .filter((item) => !existingKeys.has(`${item.name.toLowerCase()}|${item.category}`))
      .map((item) => ({
        family_id: activeFamilyId,
        name: item.name,
        quantity: item.quantity,
        category: item.category,
        is_checked: false,
        is_recurring: true,
        added_by: user.id,
        added_by_name: displayName,
      }));

    if (toInsert.length === 0) {
      setStatusMessage("Tous les recurrents sont deja dans la liste.");
      return;
    }

    const client = getSupabaseBrowserClient();
    const response = await client.from("grocery_items").insert(toInsert);
    if (response.error) {
      setError(response.error.message);
      return;
    }

    setStatusMessage(`${toInsert.length} item(s) recurrents ajoutes.`);
  };

  const onCreateNewList = async () => {
    if (!activeFamilyId || groceryAccess.readOnly) {
      setNewListOpen(false);
      return;
    }

    setIsCreatingNewList(true);
    try {
      const client = getSupabaseBrowserClient();
      if (activeItems.length > 0) {
        const archive = await client
          .from("grocery_items")
          .update({ is_checked: true, checked_at: new Date().toISOString(), checked_by_name: firstName(displayName) })
          .eq("family_id", activeFamilyId)
          .eq("is_checked", false);

        if (archive.error) {
          const fallback = await client
            .from("grocery_items")
            .update({ is_checked: true, checked_at: new Date().toISOString() })
            .eq("family_id", activeFamilyId)
            .eq("is_checked", false);
          if (fallback.error) {
            throw new Error(fallback.error.message);
          }
        }
      }

      if (importRecurringOnNewList) {
        await addAllRecurringItems();
      }

      setStatusMessage("Nouvelle liste creee.");
      setNewListOpen(false);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Creation de nouvelle liste impossible.");
    } finally {
      setIsCreatingNewList(false);
    }
  };

  const onSetRecurring = async (item: GroceryItem, recurring: boolean) => {
    const client = getSupabaseBrowserClient();
    const response = await client.from("grocery_items").update({ is_recurring: recurring }).eq("id", item.id);
    if (response.error) {
      setError(response.error.message);
      return;
    }
    setContextMenu(null);
    setStatusMessage(recurring ? "Item marque comme recurrent." : "Item retire des recurrents.");
  };

  const onEditQuantity = async (item: GroceryItem) => {
    const next = window.prompt("Modifier la quantite", item.quantity ?? "");
    if (next === null) {
      return;
    }
    const client = getSupabaseBrowserClient();
    const response = await client.from("grocery_items").update({ quantity: next.trim() || null }).eq("id", item.id);
    if (response.error) {
      setError(response.error.message);
      return;
    }
    setContextMenu(null);
  };

  const openLongPressMenu = (item: GroceryItem, x: number, y: number) => {
    setContextMenu({ item, x, y });
  };

  const startLongPress = (item: GroceryItem, x: number, y: number) => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
    }
    longPressRef.current = setTimeout(() => {
      openLongPressMenu(item, x, y);
    }, 450);
  };

  const stopLongPress = () => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };

  const onSwipeMove = (itemId: string, deltaX: number) => {
    const clamped = Math.max(-120, Math.min(0, deltaX));
    setSwipeOffsets((prev) => ({ ...prev, [itemId]: clamped }));
  };

  const onSwipeEnd = (itemId: string) => {
    const offset = swipeOffsets[itemId] ?? 0;
    if (offset <= -90) {
      void onDeleteItem(itemId);
    }
    setSwipeOffsets((prev) => ({ ...prev, [itemId]: 0 }));
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F0EB] px-6">
        <p className="text-sm font-medium text-[#6B5D55]">Chargement de la liste...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F0EB] pb-32">
      <section className="sticky top-0 z-30 border-b border-[#DED6CF] bg-[#F5F0EB]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-[#2C2420]">Liste d'epicerie</h1>
              <p className="mt-1 text-sm text-[#6B5D55]">{itemCount} items a acheter</p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewListOpen(true)}
                disabled={groceryAccess.readOnly || isCreatingNewList}
                className="rounded-full border border-[#D9D0C8] bg-white px-4 py-2 text-xs font-semibold text-[#6B5D55] transition hover:bg-[#F9F7F3] disabled:opacity-60"
              >
                Nouvelle liste
              </button>
              <button
                type="button"
                onClick={() => setConfirmCompleteOpen(true)}
                disabled={groceryAccess.readOnly || itemCount === 0 || isCompleting}
                className="inline-flex items-center gap-1 rounded-full bg-[#6B8F71] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#5D7F63] disabled:opacity-60"
              >
                <CheckCircle2 size={14} />
                Liste complete
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-[#DED6CF] bg-white px-4 py-3">
            {itemCount > 0 ? (
              <p className="text-sm text-[#6B5D55]">Liste creee par {createdByLabel ?? "Parent"}</p>
            ) : latestCompletion ? (
              <p className="rounded-lg bg-[#E6F0E8] px-3 py-2 text-sm font-medium text-[#52725A]">
                Epicerie completee par {latestCompletion.by} aujourd'hui a {new Date(latestCompletion.at).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}
              </p>
            ) : (
              <p className="text-sm text-[#6B5D55]">Aucun item actif pour le moment.</p>
            )}
          </div>

          {(statusMessage || error) && (
            <div className="mt-3">
              {statusMessage && <p className="text-xs font-medium text-[#6B8F71]">{statusMessage}</p>}
              {error && <p className="text-xs font-medium text-[#A85C52]">{error}</p>}
            </div>
          )}
        </div>
      </section>

      <main className="mx-auto max-w-4xl space-y-5 px-4 py-5 sm:px-6">
        {grouped.length === 0 ? (
          <div className="rounded-2xl border border-[#DED6CF] bg-white p-10 text-center">
            <ShoppingCart size={26} className="mx-auto text-[#A89080]" />
            <p className="mt-3 text-sm font-semibold text-[#2C2420]">Liste vide</p>
            <p className="text-sm text-[#6B5D55]">Ajoutez un item en bas de l'ecran.</p>
          </div>
        ) : (
          grouped.map((group) => {
            const config = CATEGORY_CONFIG[group.category];
            const Icon = config.icon;
            return (
              <section key={group.category} className="overflow-hidden rounded-2xl border border-[#DED6CF] bg-white shadow-[0_1px_3px_rgba(44,36,32,0.05)]">
                <header className="flex items-center justify-between border-b border-[#EFE7E1] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Icon size={16} className="text-[#7C6B5D]" />
                    <h2 className="text-sm font-semibold text-[#2C2420]">{config.label}</h2>
                  </div>
                  <span className="text-xs text-[#A89080]">{group.active.length} restants</span>
                </header>

                <div>
                  {[...group.active, ...group.checked].map((item) => {
                    const translate = swipeOffsets[item.id] ?? 0;
                    return (
                      <div key={item.id} className="relative border-b border-[#F4EEEA] last:border-b-0">
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                          <button
                            type="button"
                            onClick={() => onDeleteItem(item.id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#FCECE8] text-[#B05A4B]"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        <div
                          className="bg-white px-4 py-3 transition-transform duration-200"
                          style={{ transform: `translateX(${translate}px)` }}
                          onContextMenu={(event: MouseEvent<HTMLDivElement>) => {
                            event.preventDefault();
                            openLongPressMenu(item, event.clientX, event.clientY);
                          }}
                          onMouseDown={(event) => startLongPress(item, event.clientX, event.clientY)}
                          onMouseUp={stopLongPress}
                          onMouseLeave={stopLongPress}
                          onTouchStart={(event: TouchEvent<HTMLDivElement>) => {
                            const touch = event.touches[0];
                            const startX = touch.clientX;
                            startLongPress(item, touch.clientX, touch.clientY);
                            (event.currentTarget as HTMLDivElement).dataset.touchStartX = String(startX);
                          }}
                          onTouchMove={(event: TouchEvent<HTMLDivElement>) => {
                            const touchStartRaw = (event.currentTarget as HTMLDivElement).dataset.touchStartX;
                            if (!touchStartRaw) {
                              return;
                            }
                            const startX = Number(touchStartRaw);
                            const delta = event.touches[0].clientX - startX;
                            onSwipeMove(item.id, delta);
                          }}
                          onTouchEnd={() => {
                            stopLongPress();
                            onSwipeEnd(item.id);
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              onClick={() => onToggleItem(item, !item.isChecked)}
                              disabled={groceryAccess.readOnly}
                              className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border transition ${
                                item.isChecked
                                  ? "border-[#7C6B5D] bg-[#7C6B5D] text-white"
                                  : "border-[#CFC4BA] bg-white text-transparent hover:border-[#7C6B5D]"
                              }`}
                            >
                              <Check size={13} />
                            </button>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className={`text-sm ${item.isChecked ? "text-[#A89080] line-through" : "text-[#2C2420]"}`}>{item.name}</p>
                                {item.quantity && <span className="text-xs text-[#A89080]">{item.quantity}</span>}
                              </div>
                              {item.isChecked && (
                                <p className="mt-1 text-[11px] text-[#A89080]">Coche par {item.checkedByName || item.addedByName || "Parent"}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}

        <section className="rounded-2xl border border-[#DED6CF] bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CirclePlus size={16} className="text-[#7C6B5D]" />
              <h3 className="text-sm font-semibold text-[#2C2420]">Recurrents</h3>
            </div>
            <button
              type="button"
              onClick={() => void addAllRecurringItems()}
              disabled={groceryAccess.readOnly || recurringTemplates.length === 0}
              className="rounded-full border border-[#D9D0C8] bg-[#F9F7F3] px-3 py-1 text-xs font-semibold text-[#6B5D55] disabled:opacity-60"
            >
              Ajouter tous a la liste
            </button>
          </div>

          {recurringTemplates.length === 0 ? (
            <p className="mt-3 text-xs text-[#8C7A6E]">Longpress sur un item pour le rendre recurrent.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {recurringTemplates.map((item) => (
                <div key={`rec-${item.id}`} className="flex items-center justify-between rounded-lg border border-[#EFE7E1] px-3 py-2">
                  <div>
                    <p className="text-sm text-[#2C2420]">{item.name}</p>
                    <p className="text-xs text-[#A89080]">{CATEGORY_CONFIG[item.category].label}</p>
                  </div>
                  {item.quantity && <span className="text-xs text-[#A89080]">{item.quantity}</span>}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {!groceryAccess.readOnly && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#DED6CF] bg-white/95 backdrop-blur-sm">
          <form onSubmit={onAddItem} className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-3 sm:px-6">
            <input
              ref={inputRef}
              value={inputName}
              onChange={(event) => setInputName(event.target.value)}
              placeholder="Ajouter un item..."
              disabled={isSaving}
              className="h-11 flex-1 rounded-full border border-[#D9D0C8] bg-[#F9F7F3] px-4 text-sm text-[#2C2420] outline-none transition focus:border-[#7C6B5D]"
            />
            <input
              value={inputQuantity}
              onChange={(event) => setInputQuantity(event.target.value)}
              placeholder="Qt"
              disabled={isSaving}
              className="h-11 w-16 rounded-full border border-[#D9D0C8] bg-[#F9F7F3] px-3 text-xs text-[#2C2420] outline-none"
            />
            <button
              type="submit"
              disabled={isSaving || !inputName.trim()}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#7C6B5D] text-white transition hover:bg-[#6D5D51] disabled:opacity-60"
            >
              <Plus size={18} />
            </button>
          </form>
        </div>
      )}

      {confirmCompleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#20181066] p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#DED6CF] bg-white p-5">
            <h4 className="text-base font-semibold text-[#2C2420]">Confirmer que l'epicerie est faite ?</h4>
            <p className="mt-2 text-sm text-[#6B5D55]">Tous les items seront coches et archives.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmCompleteOpen(false)}
                className="rounded-full border border-[#D9D0C8] px-4 py-2 text-sm text-[#6B5D55]"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void onCompleteList()}
                disabled={isCompleting}
                className="rounded-full bg-[#6B8F71] px-4 py-2 text-sm font-semibold text-white"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {newListOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#20181066] p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#DED6CF] bg-white p-5">
            <h4 className="text-base font-semibold text-[#2C2420]">Creer une nouvelle liste</h4>
            <p className="mt-2 text-sm text-[#6B5D55]">La liste actuelle sera archivee.</p>
            <label className="mt-4 flex items-center gap-2 text-sm text-[#6B5D55]">
              <input
                type="checkbox"
                checked={importRecurringOnNewList}
                onChange={(event) => setImportRecurringOnNewList(event.target.checked)}
              />
              Reimporter les recurrents
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewListOpen(false)}
                className="rounded-full border border-[#D9D0C8] px-4 py-2 text-sm text-[#6B5D55]"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void onCreateNewList()}
                disabled={isCreatingNewList}
                className="rounded-full bg-[#7C6B5D] px-4 py-2 text-sm font-semibold text-white"
              >
                Demarrer
              </button>
            </div>
          </div>
        </div>
      )}

      {contextMenu && (
        <div
          className="fixed z-50 w-52 overflow-hidden rounded-xl border border-[#DED6CF] bg-white shadow-[0_10px_30px_rgba(44,36,32,0.15)]"
          style={{ left: Math.min(contextMenu.x, window.innerWidth - 220), top: Math.min(contextMenu.y, window.innerHeight - 180) }}
        >
          <button
            type="button"
            onClick={() => void onSetRecurring(contextMenu.item, !contextMenu.item.isRecurring)}
            className="block w-full px-4 py-3 text-left text-sm text-[#2C2420] hover:bg-[#F9F7F3]"
          >
            {contextMenu.item.isRecurring ? "Retirer recurrent" : "Rendre recurrent"}
          </button>
          <button
            type="button"
            onClick={() => void onEditQuantity(contextMenu.item)}
            className="block w-full px-4 py-3 text-left text-sm text-[#2C2420] hover:bg-[#F9F7F3]"
          >
            Modifier la quantite
          </button>
          <button
            type="button"
            onClick={() => void onDeleteItem(contextMenu.item.id)}
            className="block w-full px-4 py-3 text-left text-sm text-[#A85C52] hover:bg-[#FDEEEA]"
          >
            Supprimer
          </button>
        </div>
      )}
    </div>
  );
}
