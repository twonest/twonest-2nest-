import { useState, useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type ExpenseCategory = "Médical" | "Scolaire" | "Vêtements" | "Activités" | "Nourriture" | "Autre";

type ShareRatios = {
  [key in ExpenseCategory]: {
    parent1Pct: number;
    parent2Pct: number;
  };
};

const DEFAULT_RATIOS: ShareRatios = {
  Médical: { parent1Pct: 50, parent2Pct: 50 },
  Scolaire: { parent1Pct: 50, parent2Pct: 50 },
  Vêtements: { parent1Pct: 50, parent2Pct: 50 },
  Activités: { parent1Pct: 50, parent2Pct: 50 },
  Nourriture: { parent1Pct: 50, parent2Pct: 50 },
  Autre: { parent1Pct: 50, parent2Pct: 50 },
};

export function useShareRatios(familyId: string | null) {
  const [ratios, setRatios] = useState<ShareRatios>(DEFAULT_RATIOS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!familyId) {
      setRatios(DEFAULT_RATIOS);
      setIsLoading(false);
      return;
    }

    const loadRatios = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error: fetchError } = await supabase
          .from("partage_regles")
          .select("*")
          .order("category");

        if (fetchError) {
          setError(fetchError.message);
          setRatios(DEFAULT_RATIOS);
          setIsLoading(false);
          return;
        }

        if (Array.isArray(data) && data.length > 0) {
          const newRatios = { ...DEFAULT_RATIOS };

          for (const row of data) {
            const category = row.category as ExpenseCategory;
            if (category in newRatios) {
              newRatios[category] = {
                parent1Pct: Number(row.parent1_pct) || 50,
                parent2Pct: Number(row.parent2_pct) || 50,
              };
            }
          }

          setRatios(newRatios);
        } else {
          setRatios(DEFAULT_RATIOS);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors du chargement des ratios");
        setRatios(DEFAULT_RATIOS);
      } finally {
        setIsLoading(false);
      }
    };

    loadRatios();
  }, [familyId]);

  const saveRatios = async (newRatios: ShareRatios): Promise<void> => {
    try {
      const supabase = getSupabaseBrowserClient();
      const CATEGORIES: ExpenseCategory[] = ["Médical", "Scolaire", "Vêtements", "Activités", "Nourriture", "Autre"];

      for (const category of CATEGORIES) {
        const ratio = newRatios[category];

        // Utiliser l'UPSERT pour éviter les problèmes de RLS
        const { error: upsertError } = await supabase
          .from("partage_regles")
          .upsert(
            {
              category,
              parent1_pct: ratio.parent1Pct,
              parent2_pct: ratio.parent2Pct,
            },
            { onConflict: "category" }
          );

        if (upsertError) {
          throw upsertError;
        }
      }

      setRatios(newRatios);
      setError("");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erreur lors de la sauvegarde des ratios";
      setError(errorMessage);
      throw err;
    }
  };

  const calculateSplit = (amount: number, category: ExpenseCategory) => {
    const ratio = ratios[category];
    const parent1Share = Math.round((amount * ratio.parent1Pct) / 100 * 100) / 100;
    const parent2Share = Math.round((amount - parent1Share) * 100) / 100;

    return {
      parent1Share,
      parent2Share,
    };
  };

  return {
    ratios,
    isLoading,
    error,
    saveRatios,
    calculateSplit,
  };
}
