"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { Check, Trash2, Plus, ShoppingCart } from "lucide-react";
import { useFamily } from "@/components/FamilyProvider";
import { getFeatureAccess } from "@/lib/family";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type GroceryItem = {
  id: string;
  familyId: string;
  name: string;
  quantity: string | null;
  addedBy: string | null;
  addedByName: string | null;
  isChecked: boolean;
  createdAt: string;
  category: string;
};

type GroceryRow = Record<string, unknown>;

const CATEGORY_LABELS: Record<string, string> = {
  fruits: "Fruits",
  vegetables: "Légumes",
  dairy: "Produits laitiers",
  meat: "Viandes & Poissons",
  breadpasta: "Pain & Pâtes",
  frozen: "Surgelés",
  condiments: "Condiments",
  drinks: "Boissons",
  other: "Autre",
};

const CATEGORY_COLORS: Record<string, string> = {
  fruits: "#E85D4B",
  vegetables: "#8DC149",
  dairy: "#A89080",
  meat: "#C87A5B",
  breadpasta: "#D4A574",
  frozen: "#4BA3D0",
  condiments: "#9B8B7E",
  drinks: "#7B9DC9",
  other: "#7C6B5D",
};

function safeText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function getCategoryFromName(itemName: string): string {
  const name = itemName.toLowerCase();
  if (name.match(/apple|banana|orange|strawberry|berry|grape|pear|melon|fruit|abricot|mandarine|citron/)) {
    return "fruits";
  }
  if (name.match(/carrot|broccoli|lettuce|tomato|spinach|pepper|onion|vegetable|carotte|tomate|épinard|courge|radis/)) {
    return "vegetables";
  }
  if (name.match(/milk|cheese|yogurt|butter|cream|dairy|lait|fromage|yaourt|beurre/)) {
    return "dairy";
  }
  if (name.match(/chicken|beef|pork|fish|meat|salmon|poulet|boeuf|porc|poisson|côte|steak/)) {
    return "meat";
  }
  if (name.match(/bread|pasta|rice|noodle|cereal|grain|pain|pâtes|riz|nouilles|céréale/)) {
    return "breadpasta";
  }
  if (name.match(/frozen|ice|popsicle|surgelé|glaçon/)) {
    return "frozen";
  }
  if (name.match(/sauce|oil|vinegar|spice|salt|condiment|sauce|huile|vinaigre|épice|sel/)) {
    return "condiments";
  }
  if (name.match(/juice|soda|water|coffee|tea|drink|jus|soda|eau|café|thé|boisson/)) {
    return "drinks";
  }
  return "other";
}

export default function GroceryPage() {
  const router = useRouter();
  const { activeFamilyId, currentRole, currentPermissions } = useFamily();
  const inputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("Parent");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [inputName, setInputName] = useState("");
  const [inputQuantity, setInputQuantity] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const groceryAccess = currentRole
    ? getFeatureAccess("grocery", currentRole, currentPermissions)
    : { allowed: true, readOnly: false, reason: "" };

  const refreshItems = async (familyId: string) => {
    const supabase = getSupabaseBrowserClient();
    const response = await supabase
      .from("grocery_items")
      .select("*")
      .eq("family_id", familyId)
      .eq("is_checked", false)
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
          addedBy: safeText(row.added_by) || null,
          addedByName: safeText(row.added_by_name) || null,
          isChecked: Boolean(row.is_checked),
          createdAt: safeText(row.created_at) || new Date().toISOString(),
          category: safeText(row.category) || "other",
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
      const category = getCategoryFromName(name);
      
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
      inputRef.current?.focus();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Impossible d'ajouter cet item.");
    } finally {
      setIsSaving(false);
    }
  };

  const onToggleItem = async (item: GroceryItem, checked: boolean) => {
    if (!activeFamilyId || groceryAccess.readOnly) {
      return;
    }

    try {
      const supabase = getSupabaseBrowserClient();
      if (checked) {
        await supabase.from("grocery_items").update({ is_checked: true, checked_at: new Date().toISOString() }).eq("id", item.id);
      } else {
        await supabase.from("grocery_items").delete().eq("id", item.id);
      }
      await refreshItems(activeFamilyId);
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Impossible de mettre à jour l'item.");
    }
  };

  const onDeleteItem = async (itemId: string) => {
    if (!activeFamilyId || groceryAccess.readOnly) {
      return;
    }

    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.from("grocery_items").delete().eq("id", itemId);
      await refreshItems(activeFamilyId);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Impossible de supprimer l'item.");
    }
  };

  const onClearAll = async () => {
    if (!activeFamilyId || groceryAccess.readOnly) {
      return;
    }

    if (!window.confirm("Êtes-vous sûr de vouloir vider toute la liste ?")) {
      return;
    }

    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.from("grocery_items").delete().eq("family_id", activeFamilyId).eq("is_checked", false);
      await refreshItems(activeFamilyId);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Impossible de vider la liste.");
    }
  };

  // Group items by category
  const groupedItems = items.reduce(
    (acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    },
    {} as Record<string, GroceryItem[]>,
  );

  const sortedCategories = Object.keys(groupedItems).sort(
    (a, b) => Object.keys(CATEGORY_LABELS).indexOf(a) - Object.keys(CATEGORY_LABELS).indexOf(b),
  );

  const itemCount = items.length;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F0EB] px-6">
        <p className="text-sm font-medium text-[#6B5D55]">Chargement de votre épicerie...</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#F5F0EB] pb-32">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-[#E1D6CB] bg-white/95 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7C6B5D]/10">
                <ShoppingCart size={20} className="text-[#7C6B5D]" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-[#2C2420]">Épicerie</h1>
                <p className="text-xs text-[#A89080]">
                  {itemCount === 0 ? "Liste vide" : `${itemCount} ${itemCount === 1 ? "item" : "items"} à acheter`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {itemCount > 0 && !groceryAccess.readOnly && (
                <button
                  onClick={onClearAll}
                  className="flex items-center gap-2 rounded-lg border border-[#D9D0C8] bg-white px-3 py-2 text-xs font-semibold text-[#6B5D55] transition hover:bg-[#F9F7F3]"
                >
                  <Trash2 size={14} />
                  Vider
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="mx-auto max-w-3xl px-6 py-8">
        {error && (
          <div className="mb-6 rounded-xl border border-[#E6C8BD] bg-[#FBEFEB] px-4 py-3 text-sm text-[#A85C52]">
            {error}
          </div>
        )}

        {items.length === 0 ? (
          <div className="rounded-2xl border border-[#D9D0C8] bg-white p-12 text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#F5F0EB]">
                <ShoppingCart size={32} className="text-[#A89080]" />
              </div>
            </div>
            <p className="text-lg font-semibold text-[#2C2420]">Liste vide</p>
            <p className="mt-1 text-sm text-[#6B5D55]">Ajoute les articles que vous devez acheter</p>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedCategories.map((category) => (
              <div key={category} className="rounded-2xl border border-[#D9D0C8] bg-white overflow-hidden">
                {/* Category Header */}
                <div className="border-b border-[#E1D6CB] bg-[#F9F7F3] px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-full"
                        style={{ backgroundColor: `${CATEGORY_COLORS[category]}20` }}
                      >
                        <span className="text-base" style={{ color: CATEGORY_COLORS[category] }}>
                          ●
                        </span>
                      </div>
                      <h2 className="font-semibold text-[#2C2420]">{CATEGORY_LABELS[category]}</h2>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-medium text-[#6B5D55] border border-[#D9D0C8]">
                      {groupedItems[category].length}
                    </span>
                  </div>
                </div>

                {/* Items */}
                <div className="divide-y divide-[#E1D6CB]">
                  {groupedItems[category].map((item, index) => (
                    <div
                      key={item.id}
                      className="group flex items-center gap-4 px-6 py-4 transition hover:bg-[#F9F7F3]"
                    >
                      {/* Checkbox */}
                      <button
                        onClick={() => onToggleItem(item, true)}
                        disabled={groceryAccess.readOnly}
                        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-[#D9D0C8] bg-white transition hover:border-[#7C6B5D] hover:bg-[#7C6B5D]/5 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Cocher l'item"
                      >
                        <Check size={14} className="text-transparent group-hover:text-[#7C6B5D]" />
                      </button>

                      {/* Item Content */}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[#2C2420]">{item.name}</p>
                        {item.quantity && (
                          <p className="mt-1 text-sm text-[#A89080]">{item.quantity}</p>
                        )}
                      </div>

                      {/* Delete Button */}
                      <button
                        onClick={() => onDeleteItem(item.id)}
                        disabled={groceryAccess.readOnly}
                        className="flex-shrink-0 text-[#D9D0C8] transition hover:text-[#A85C52] group-hover:opacity-100 opacity-0 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Supprimer"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Fixed Bottom Bar */}
      {!groceryAccess.readOnly && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-[#D9D0C8] bg-white/95 backdrop-blur-sm shadow-lg shadow-black/5">
          <form onSubmit={onAddItem} className="mx-auto max-w-3xl px-6 py-4 flex items-center gap-3">
            <input
              ref={inputRef}
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              placeholder="Ajouter un item..."
              disabled={isSaving}
              className="flex-1 rounded-full border border-[#D9D0C8] bg-[#F9F7F3] px-5 py-3 text-sm text-[#2C2420] outline-none transition focus:border-[#7C6B5D] focus:ring-2 focus:ring-[#7C6B5D]/20 placeholder:text-[#A89080] disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isSaving || !inputName.trim()}
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#7C6B5D] text-white transition hover:bg-[#6E5F51] disabled:cursor-not-allowed disabled:opacity-50"
              title="Envoyer"
            >
              <Plus size={20} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
