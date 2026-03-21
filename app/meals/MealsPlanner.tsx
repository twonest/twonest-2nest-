import React, { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { useFamily } from "@/components/FamilyProvider";

export default function MealsPlanner() {
  // Jours et types de repas
  const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
  const MEAL_TYPES = ["Déjeuner", "Dîner", "Souper"];

  const { activeFamilyId } = useFamily();
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date();
    const day = now.getDay() === 0 ? 6 : now.getDay() - 1; // Lundi = 0
    const monday = new Date(now);
    monday.setDate(now.getDate() - day);
    monday.setHours(0,0,0,0);
    return monday;
  });
  const [meals, setMeals] = useState<Record<string, Record<string, any>>>({});
  const [loading, setLoading] = useState(false);

  // Modale ajout/édition
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDay, setModalDay] = useState<string | null>(null);
  const [modalMealType, setModalMealType] = useState<string | null>(null);
  const [modalMealId, setModalMealId] = useState<string | null>(null);
  const [mealName, setMealName] = useState("");
  const [saving, setSaving] = useState(false);

  // Format date semaine
  function formatWeekLabel(date: Date) {
    const end = new Date(date);
    end.setDate(date.getDate() + 6);
    return `Semaine du ${date.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`;
  }

  // Charger les repas planifiés pour la semaine courante
  useEffect(() => {
    if (!activeFamilyId) return;
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const weekStartIso = weekStart.toISOString().slice(0, 10);
    supabase
      .from("meal_plans")
      .select("*")
      .eq("family_id", activeFamilyId)
      .eq("semaine_debut", weekStartIso)
      .then(({ data }) => {
        const byDay: Record<string, Record<string, any>> = {};
        for (const row of data ?? []) {
          if (!byDay[row.jour]) byDay[row.jour] = {};
          byDay[row.jour][row.type_repas] = row;
        }
        setMeals(byDay);
        setLoading(false);
      });
  }, [activeFamilyId, weekStart]);

  // Ouvre la modale pour ajout/édition
  function openMealModal(day: string, mealType: string, mealId?: string, name?: string) {
    setModalDay(day);
    setModalMealType(mealType);
    setModalMealId(mealId || null);
    setMealName(name || "");
    setModalOpen(true);
  }

  // Ferme la modale
  function closeMealModal() {
    setModalOpen(false);
    setModalDay(null);
    setModalMealType(null);
    setModalMealId(null);
    setMealName("");
    setSaving(false);
  }

  // Sauvegarde (ajout ou édition)
  async function saveMeal(e: React.FormEvent) {
    e.preventDefault();
    if (!activeFamilyId || !modalDay || !modalMealType || !mealName.trim()) return;
    setSaving(true);
    const supabase = getSupabaseBrowserClient();
    const weekStartIso = weekStart.toISOString().slice(0, 10);
    if (modalMealId) {
      // Edition
      await supabase.from("meal_plans").update({ nom_repas: mealName.trim() }).eq("id", modalMealId);
    } else {
      // Ajout
      await supabase.from("meal_plans").insert({
        family_id: activeFamilyId,
        semaine_debut: weekStartIso,
        jour: modalDay,
        type_repas: modalMealType,
        nom_repas: mealName.trim(),
      });
    }
    // Recharge les repas
    const { data } = await supabase
      .from("meal_plans")
      .select("*")
      .eq("family_id", activeFamilyId)
      .eq("semaine_debut", weekStartIso);
    const byDay: Record<string, Record<string, any>> = {};
    for (const row of data ?? []) {
      if (!byDay[row.jour]) byDay[row.jour] = {};
      byDay[row.jour][row.type_repas] = row;
    }
    setMeals(byDay);
    closeMealModal();
  }

  return (
    <div>
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mb-6">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold text-[#4F443A]">Repas & Épicerie</h2>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded-lg bg-[#7C6B5D] text-white px-4 py-2 font-semibold flex items-center gap-2 hover:bg-[#6C5D50]">
            🛒 Générer la liste d'épicerie
          </button>
        </div>
      </div>
      {/* Navigation semaine */}
      <div className="flex items-center justify-center gap-4 mb-4">
        <button className="text-[#7C6B5D] text-lg font-bold" onClick={() => setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d; })}>←</button>
        <span className="font-medium text-[#6B5D55]">{formatWeekLabel(weekStart)}</span>
        <button className="text-[#7C6B5D] text-lg font-bold" onClick={() => setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d; })}>→</button>
      </div>
      {/* GRILLE DE LA SEMAINE */}
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 rounded-xl bg-white shadow-sm">
          <thead>
            <tr>
              <th className="p-2 text-xs font-semibold text-[#A89080] bg-[#F8F5F1]">Jour</th>
              {MEAL_TYPES.map((mealType) => (
                <th key={mealType} className="p-2 text-xs font-semibold text-[#A89080] bg-[#F8F5F1]">{mealType}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day) => (
              <tr key={day} className="border-b last:border-b-0">
                <td className="p-2 font-semibold text-[#7C6B5D] bg-[#F8F5F1]">{day}</td>
                {MEAL_TYPES.map((mealType) => (
                  <td key={mealType} className="p-2 align-top min-w-[120px]">
                    {meals[day]?.[mealType] ? (
                      <div className="w-full h-16 rounded-lg border border-[#E8E1D8] bg-[#F8F5F1] flex flex-col items-center justify-center relative">
                        <span className="text-sm font-semibold text-[#4F443A]">{meals[day][mealType].nom_repas}</span>
                        <span
                          className="absolute top-1 right-2 text-[#A89080] cursor-pointer"
                          onClick={() => openMealModal(day, mealType, meals[day][mealType].id, meals[day][mealType].nom_repas)}
                        >✏️</span>
                      </div>
                    ) : (
                      <button
                        className="w-full h-16 rounded-lg border border-[#E8E1D8] bg-[#F8F5F1] text-[#A89080] flex flex-col items-center justify-center hover:bg-[#EFE7DD]"
                        onClick={() => openMealModal(day, mealType)}
                      >
                        <span className="text-sm">Ajouter</span>
                      </button>
                    )}
                        {/* MODALE AJOUT/EDITION REPAS */}
                        {modalOpen && (
                          <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#2C2420]/40 p-0 sm:items-center sm:p-6">
                            <div className="w-full max-w-md rounded-t-3xl border border-[#D7CCC1] bg-white p-5 sm:rounded-3xl">
                              <div className="mb-4 flex items-center justify-between">
                                <h3 className="text-lg font-bold text-[#2C2420]">{modalMealId ? "Modifier le repas" : "Ajouter un repas"}</h3>
                                <button type="button" onClick={closeMealModal} className="rounded-lg p-1 text-[#786D62] hover:bg-[#F2EBE3]">✕</button>
                              </div>
                              <form onSubmit={saveMeal} className="space-y-4">
                                <div>
                                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6D6258]">Nom du repas</label>
                                  <input
                                    required
                                    value={mealName}
                                    onChange={e => setMealName(e.target.value)}
                                    className="w-full rounded-xl border border-[#D8CCC0] bg-white px-3 py-2 text-sm text-[#3F3731]"
                                    placeholder="Ex: Lasagnes, Salade..."
                                    autoFocus
                                  />
                                </div>
                                <button
                                  type="submit"
                                  disabled={saving || !mealName.trim()}
                                  className="w-full rounded-xl bg-[#7C6B5D] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {saving ? (modalMealId ? "Modification..." : "Ajout...") : (modalMealId ? "Modifier" : "Ajouter")}
                                </button>
                              </form>
                            </div>
                          </div>
                        )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* RECETTES FAVORITES */}
      <div className="mt-10">
        <h3 className="text-lg font-bold text-[#4F443A] mb-3">Recettes favorites</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1,2,3].map((i) => (
            <div key={i} className="rounded-xl border border-[#E8E1D8] bg-white p-4 flex flex-col gap-2 shadow-sm">
              <div className="h-32 bg-[#F8F5F1] rounded-lg mb-2"></div>
              <div className="font-semibold text-[#7C6B5D]">Nom de la recette</div>
              <div className="text-xs text-[#A89080]">30 min · 4 pers.</div>
              <button className="mt-2 rounded-lg bg-[#EFE7DD] px-3 py-1 text-xs font-semibold text-[#7C6B5D] hover:bg-[#F2EBE3]">Planifier cette semaine</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
