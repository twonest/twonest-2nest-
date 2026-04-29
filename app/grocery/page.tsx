"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  RefreshCw,
  ShoppingCart,
  Check,
  X,
  User,
  Loader,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { useFamily } from "@/components/FamilyProvider";
import {
  CATEGORIES,
  CATEGORY_ICONS,
  GroceryItem,
  GroceryList,
  addGroceryItem,
  clearCheckedItems,
  deleteGroceryItem,
  fetchGroceryItems,
  fetchOrCreateGroceryList,
  getWeekStart,
  toggleGroceryItem,
  toggleRecurring,
  type GroceryCategory,
} from "@/lib/groceryApi";

const supabase = getSupabaseBrowserClient();

export default function GroceryPage() {
  const router = useRouter();
  const { family } = useFamily();
  const [user, setUser] = useState<any>(null);
  const [currentList, setCurrentList] = useState<GroceryList | null>(null);
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState<string>(getWeekStart(new Date()));
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  // Formulaire d'ajout
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<GroceryCategory>("Épicerie sèche");
  const [newQty, setNewQty] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newRecurring, setNewRecurring] = useState(false);
  const [newAssigned, setNewAssigned] = useState("");
  const [adding, setAdding] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Charger l'utilisateur
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  // Charger les profils de la famille
  useEffect(() => {
    if (!family?.id) return;
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("family_id", family.id)
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {};
          data.forEach((p) => (map[p.id] = p.full_name));
          setProfiles(map);
        }
      });
  }, [family?.id]);

  // Charger la liste et les articles
  const loadList = useCallback(async () => {
    if (!family?.id || !user?.id) return;
    setLoading(true);
    try {
      const list = await fetchOrCreateGroceryList(family.id, weekStart, user.id);
      setCurrentList(list);
      const groceryItems = await fetchGroceryItems(list.id);
      setItems(groceryItems);
    } catch (err) {
      console.error("Erreur chargement épicerie:", err);
    } finally {
      setLoading(false);
    }
  }, [family?.id, user?.id, weekStart]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  // Realtime Supabase
  useEffect(() => {
    if (!currentList?.id) return;
    const channel = supabase
      .channel(`grocery_items_${currentList.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "grocery_items", filter: `list_id=eq.${currentList.id}` },
        () => loadList()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentList?.id, loadList]);

  // Navigation semaine
  const changeWeek = (direction: number) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + direction * 7);
    setWeekStart(getWeekStart(date));
  };

  const formatWeekLabel = () => {
    const start = new Date(weekStart);
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" };
    return `${start.toLocaleDateString("fr-CA", opts)} – ${end.toLocaleDateString("fr-CA", opts)}`;
  };

  const isCurrentWeek = weekStart === getWeekStart(new Date());

  // Grouper par catégorie
  const grouped = CATEGORIES.reduce((acc, cat) => {
    const catItems = items.filter((i) => i.category === cat);
    if (catItems.length > 0) acc[cat] = catItems;
    return acc;
  }, {} as Record<string, GroceryItem[]>);

  // Statistiques
  const totalItems = items.length;
  const checkedItems = items.filter((i) => i.is_checked).length;
  const progress = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;

  // Ajouter un article
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !currentList || !user) return;
    setAdding(true);
    try {
      await addGroceryItem({
        list_id: currentList.id,
        family_id: family!.id,
        name: newName.trim(),
        category: newCategory,
        quantity: newQty ? parseFloat(newQty) : null,
        unit: newUnit || null,
        is_checked: false,
        checked_by: null,
        checked_at: null,
        is_recurring: newRecurring,
        assigned_to: newAssigned || null,
        added_by: user.id,
        sort_order: items.length,
      });
      setNewName("");
      setNewQty("");
      setNewUnit("");
      setNewRecurring(false);
      setNewAssigned("");
      await loadList();
      inputRef.current?.focus();
    } catch (err) {
      console.error("Erreur ajout article:", err);
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (item: GroceryItem) => {
    if (!user) return;
    // Optimistic update
    setItems((prev) =>
      prev.map((i) => i.id === item.id ? { ...i, is_checked: !i.is_checked } : i)
    );
    await toggleGroceryItem(item.id, !item.is_checked, user.id);
  };

  const handleDelete = async (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    await deleteGroceryItem(itemId);
  };

  const handleToggleRecurring = async (item: GroceryItem) => {
    setItems((prev) =>
      prev.map((i) => i.id === item.id ? { ...i, is_recurring: !i.is_recurring } : i)
    );
    await toggleRecurring(item.id, !item.is_recurring);
  };

  const handleClearChecked = async () => {
    if (!currentList) return;
    await clearCheckedItems(currentList.id);
    await loadList();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
            <ShoppingCart className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Liste d'épicerie</h1>
            <p className="text-sm text-gray-500">Partagée avec la famille</p>
          </div>
        </div>

        {/* Navigation semaine */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => changeWeek(-1)}
              className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>

            <div className="text-center">
              <p className="font-semibold text-gray-900 text-sm">{formatWeekLabel()}</p>
              {isCurrentWeek && (
                <span className="text-xs text-green-600 font-medium">✦ Cette semaine</span>
              )}
            </div>

            <button
              onClick={() => changeWeek(1)}
              className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {/* Barre de progression */}
          {totalItems > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{checkedItems}/{totalItems} articles</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {progress === 100 && (
                <p className="text-center text-xs text-green-600 font-medium mt-1">
                  🎉 Liste complétée !
                </p>
              )}
            </div>
          )}
        </div>

        {/* Bouton ajouter */}
        <button
          onClick={() => { setShowForm(!showForm); setTimeout(() => inputRef.current?.focus(), 100); }}
          className="w-full bg-green-600 hover:bg-green-700 text-white rounded-2xl py-3 px-4 flex items-center justify-center gap-2 font-medium transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          Ajouter un article
        </button>

        {/* Formulaire d'ajout */}
        {showForm && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
            <form onSubmit={handleAdd} className="space-y-3">
              <input
                ref={inputRef}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nom de l'article..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              />

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as GroceryCategory)}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {CATEGORY_ICONS[cat]} {cat}
                    </option>
                  ))}
                </select>

                <div className="flex gap-1">
                  <input
                    type="number"
                    value={newQty}
                    onChange={(e) => setNewQty(e.target.value)}
                    placeholder="Qté"
                    className="w-20 border border-gray-200 rounded-xl px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <input
                    type="text"
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    placeholder="Unité"
                    className="flex-1 border border-gray-200 rounded-xl px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newAssigned}
                  onChange={(e) => setNewAssigned(e.target.value)}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Assigner à...</option>
                  {Object.entries(profiles).map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </select>

                <label className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={newRecurring}
                    onChange={(e) => setNewRecurring(e.target.checked)}
                    className="rounded accent-green-600"
                  />
                  <span className="text-sm text-gray-700">
                    <RefreshCw className="w-3 h-3 inline mr-1 text-green-600" />
                    Récurrent
                  </span>
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={adding || !newName.trim()}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-xl py-2 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  {adding ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Ajouter
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 bg-gray-100 hover:bg-gray-200 rounded-xl py-2 text-sm text-gray-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Liste des articles */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader className="w-6 h-6 text-green-600 animate-spin" />
          </div>
        ) : totalItems === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <ShoppingCart className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Aucun article pour cette semaine</p>
            <p className="text-gray-400 text-xs mt-1">Appuyez sur "Ajouter un article" pour commencer</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([category, catItems]) => (
              <div key={category} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {/* En-tête catégorie */}
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                  <span className="text-base">{CATEGORY_ICONS[category as GroceryCategory]}</span>
                  <span className="text-sm font-semibold text-gray-700">{category}</span>
                  <span className="ml-auto text-xs text-gray-400">
                    {catItems.filter((i) => i.is_checked).length}/{catItems.length}
                  </span>
                </div>

                {/* Articles */}
                <ul className="divide-y divide-gray-50">
                  {catItems.map((item) => (
                    <li
                      key={item.id}
                      className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                        item.is_checked ? "bg-gray-50" : "hover:bg-green-50/30"
                      }`}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={() => handleToggle(item)}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          item.is_checked
                            ? "bg-green-500 border-green-500"
                            : "border-gray-300 hover:border-green-400"
                        }`}
                      >
                        {item.is_checked && <Check className="w-3 h-3 text-white" />}
                      </button>

                      {/* Nom + détails */}
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm font-medium ${item.is_checked ? "line-through text-gray-400" : "text-gray-800"}`}>
                          {item.quantity && <span className="text-gray-500 mr-1">{item.quantity}{item.unit}</span>}
                          {item.name}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          {item.assigned_to && profiles[item.assigned_to] && (
                            <span className="text-xs text-blue-600 flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {profiles[item.assigned_to]}
                            </span>
                          )}
                          {item.is_recurring && (
                            <span className="text-xs text-green-600 flex items-center gap-1">
                              <RefreshCw className="w-3 h-3" />
                              Récurrent
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleRecurring(item)}
                          title={item.is_recurring ? "Retirer des récurrents" : "Ajouter aux récurrents"}
                          className={`p-1.5 rounded-lg transition-colors ${
                            item.is_recurring ? "text-green-600 bg-green-50" : "text-gray-300 hover:text-green-500"
                          }`}
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {/* Nettoyer les articles cochés */}
            {checkedItems > 0 && (
              <button
                onClick={handleClearChecked}
                className="w-full py-3 rounded-2xl border border-dashed border-gray-300 text-sm text-gray-500 hover:text-red-500 hover:border-red-300 transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Supprimer les {checkedItems} article{checkedItems > 1 ? "s" : ""} cochés
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
