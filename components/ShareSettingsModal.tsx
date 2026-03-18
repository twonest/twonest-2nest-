"use client";

import { useState, useEffect } from "react";
import { X, Settings } from "lucide-react";

type ExpenseCategory = "Médical" | "Scolaire" | "Vêtements" | "Activités" | "Nourriture" | "Autre";

type ShareRatios = {
  [key in ExpenseCategory]: {
    parent1Pct: number;
    parent2Pct: number;
  };
};

type ShareSettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (ratios: ShareRatios) => Promise<void>;
  initialRatios: ShareRatios;
  parentNames: { parent1: string; parent2: string };
};

const CATEGORIES: ExpenseCategory[] = ["Médical", "Scolaire", "Vêtements", "Activités", "Nourriture", "Autre"];

export default function ShareSettingsModal({
  isOpen,
  onClose,
  onSave,
  initialRatios,
  parentNames,
}: ShareSettingsModalProps) {
  const [ratios, setRatios] = useState<ShareRatios>(initialRatios);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setRatios(initialRatios);
    setError("");
  }, [initialRatios, isOpen]);

  const handleParent1Change = (category: ExpenseCategory, value: number) => {
    const parent1Pct = Math.max(0, Math.min(100, value));
    const parent2Pct = 100 - parent1Pct;

    setRatios((prev) => ({
      ...prev,
      [category]: {
        parent1Pct,
        parent2Pct,
      },
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError("");

    try {
      await onSave(ratios);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la sauvegarde");
      setIsSaving(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#2A211B66] p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-2xl rounded-t-2xl border border-[#E0D6CB] bg-[#FBF8F4] p-4 shadow-[0_20px_45px_rgba(32,24,18,0.18)] sm:rounded-2xl sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings size={20} className="text-[#7C6B5D]" />
            <h2 className="text-xl font-semibold text-[#2C2420]">Paramètres de partage</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E0D6CB] bg-white text-[#6B5D55]"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <p className="mb-4 rounded-xl border border-[#E3D9CE] bg-[#F8E8E4] px-4 py-3 text-sm text-[#A85C52]">
            {error}
          </p>
        )}

        <div className="mb-4 max-h-96 overflow-y-auto rounded-xl border border-[#E3D9CE] bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E3D9CE] bg-[#F2E9DE]">
                <th className="px-3 py-3 text-left font-semibold text-[#5E5148]">Catégorie</th>
                <th className="px-3 py-3 text-center font-semibold text-[#5E5148]">{parentNames.parent1}</th>
                <th className="px-3 py-3 text-center font-semibold text-[#5E5148]">{parentNames.parent2}</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((category, idx) => (
                <tr
                  key={category}
                  className={`border-b border-[#E3D9CE] last:border-b-0 ${idx % 2 === 0 ? "bg-white" : "bg-[#F9F7F4]"}`}
                >
                  <td className="px-3 py-3 font-medium text-[#4E4036]">{category}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={ratios[category].parent1Pct}
                        onChange={(e) => handleParent1Change(category, Number(e.target.value))}
                        className="w-20 accent-[#7C6B5D]"
                      />
                      <span className="w-10 text-right font-semibold text-[#2C2420]">
                        {ratios[category].parent1Pct}%
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <span className="w-10 text-right font-semibold text-[#2C2420]">
                        {ratios[category].parent2Pct}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mb-4 rounded-xl border border-[#E3D9CE] bg-[#F2E9DE] px-3 py-2 text-xs text-[#6B5D55]">
          💡 Les pourcentages s'ajustent automatiquement à 100%. Modifiez {parentNames.parent1} pour ajuster la répartition.
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-[#E0D6CB] bg-white px-4 py-3 text-sm font-semibold text-[#5E5148] transition hover:bg-[#F5EEE6]"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 rounded-xl bg-[#7C6B5D] px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(44,36,32,0.12)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSaving ? "Sauvegarde..." : "💾 Sauvegarder"}
          </button>
        </div>
      </div>
    </div>
  );
}
