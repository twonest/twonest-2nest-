// lib/groceryApi.ts
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

const supabase = getSupabaseBrowserClient();

export type GroceryCategory =
  | "Fruits & Légumes"
  | "Viandes & Poissons"
  | "Produits laitiers"
  | "Boulangerie"
  | "Épicerie sèche"
  | "Surgelés"
  | "Boissons"
  | "Hygiène & Beauté"
  | "Maison & Entretien"
  | "Autre";

export const CATEGORIES: GroceryCategory[] = [
  "Fruits & Légumes",
  "Viandes & Poissons",
  "Produits laitiers",
  "Boulangerie",
  "Épicerie sèche",
  "Surgelés",
  "Boissons",
  "Hygiène & Beauté",
  "Maison & Entretien",
  "Autre",
];

export const CATEGORY_ICONS: Record<GroceryCategory, string> = {
  "Fruits & Légumes": "🥦",
  "Viandes & Poissons": "🍗",
  "Produits laitiers": "🥛",
  "Boulangerie": "🍞",
  "Épicerie sèche": "🥫",
  "Surgelés": "🧊",
  "Boissons": "🥤",
  "Hygiène & Beauté": "🧴",
  "Maison & Entretien": "🧹",
  "Autre": "🛒",
};

export interface GroceryList {
  id: string;
  family_id: string;
  week_start_date: string;
  created_by: string | null;
  created_at: string;
}

export interface GroceryItem {
  id: string;
  list_id: string;
  family_id: string;
  name: string;
  category: GroceryCategory;
  quantity: number | null;
  unit: string | null;
  is_checked: boolean;
  checked_by: string | null;
  checked_at: string | null;
  is_recurring: boolean;
  assigned_to: string | null;
  added_by: string | null;
  created_at: string;
  sort_order: number;
}

// Obtenir le lundi de la semaine d'une date donnée
export function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

// Récupérer ou créer une liste pour une semaine donnée
export async function fetchOrCreateGroceryList(
  familyId: string,
  weekStart: string,
  userId: string
): Promise<GroceryList> {
  const { data: existing } = await supabase
    .from("grocery_lists")
    .select("*")
    .eq("family_id", familyId)
    .eq("week_start_date", weekStart)
    .single();

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from("grocery_lists")
    .insert({ family_id: familyId, week_start_date: weekStart, created_by: userId })
    .select()
    .single();

  if (error) throw error;

  // Copier les articles récurrents de la semaine précédente
  await copyRecurringItems(familyId, weekStart, created.id, userId);

  return created;
}

// Copier les articles récurrents de la semaine précédente
async function copyRecurringItems(
  familyId: string,
  weekStart: string,
  newListId: string,
  userId: string
) {
  const prevWeek = new Date(weekStart);
  prevWeek.setDate(prevWeek.getDate() - 7);
  const prevWeekStr = prevWeek.toISOString().split("T")[0];

  const { data: prevList } = await supabase
    .from("grocery_lists")
    .select("id")
    .eq("family_id", familyId)
    .eq("week_start_date", prevWeekStr)
    .single();

  if (!prevList) return;

  const { data: recurringItems } = await supabase
    .from("grocery_items")
    .select("*")
    .eq("list_id", prevList.id)
    .eq("is_recurring", true);

  if (!recurringItems?.length) return;

  const newItems = recurringItems.map(({ id, list_id, checked_by, checked_at, is_checked, created_at, ...rest }) => ({
    ...rest,
    list_id: newListId,
    family_id: familyId,
    is_checked: false,
    added_by: userId,
  }));

  await supabase.from("grocery_items").insert(newItems);
}

// Récupérer les articles d'une liste
export async function fetchGroceryItems(listId: string): Promise<GroceryItem[]> {
  const { data, error } = await supabase
    .from("grocery_items")
    .select("*")
    .eq("list_id", listId)
    .order("is_checked", { ascending: true })
    .order("category")
    .order("sort_order");

  if (error) throw error;
  return data || [];
}

// Ajouter un article
export async function addGroceryItem(
  item: Omit<GroceryItem, "id" | "created_at">
): Promise<GroceryItem> {
  const { data, error } = await supabase
    .from("grocery_items")
    .insert(item)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Cocher / décocher un article
export async function toggleGroceryItem(
  itemId: string,
  isChecked: boolean,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from("grocery_items")
    .update({
      is_checked: isChecked,
      checked_by: isChecked ? userId : null,
      checked_at: isChecked ? new Date().toISOString() : null,
    })
    .eq("id", itemId);

  if (error) throw error;
}

// Supprimer un article
export async function deleteGroceryItem(itemId: string): Promise<void> {
  const { error } = await supabase.from("grocery_items").delete().eq("id", itemId);
  if (error) throw error;
}

// Basculer récurrent
export async function toggleRecurring(itemId: string, isRecurring: boolean): Promise<void> {
  const { error } = await supabase
    .from("grocery_items")
    .update({ is_recurring: isRecurring })
    .eq("id", itemId);
  if (error) throw error;
}

// Supprimer tous les articles cochés
export async function clearCheckedItems(listId: string): Promise<void> {
  const { error } = await supabase
    .from("grocery_items")
    .delete()
    .eq("list_id", listId)
    .eq("is_checked", true)
    .eq("is_recurring", false);
  if (error) throw error;
}