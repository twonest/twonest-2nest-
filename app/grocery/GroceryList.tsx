// Squelette UI de la nouvelle liste d'épicerie, mobile-first, sans logique métier
export default function GroceryList() {
  return (
    <div>
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-[#4F443A]">Épicerie</h2>
          <div className="text-[#A89080] text-sm">Semaine du 12 mars</div>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded-lg bg-[#7C6B5D] text-white px-4 py-2 font-semibold flex items-center gap-2 hover:bg-[#6C5D50]">
            ✅ Courses terminées !
          </button>
        </div>
      </div>
      {/* Compteur items */}
      <div className="mb-4 text-[#7C6B5D] text-sm font-medium">8 items · 3 cochés</div>
      {/* LISTE PAR RAYON */}
      <div className="space-y-4">
        {["Fruits et légumes", "Viandes et poissons", "Produits laitiers"].map((rayon, idx) => (
          <div key={rayon} className="rounded-xl border border-[#E8E1D8] bg-white p-4 shadow-sm">
            <div className="font-semibold text-[#7C6B5D] mb-2 flex items-center gap-2">
              {idx === 0 && "🥦"}
              {idx === 1 && "🥩"}
              {idx === 2 && "🥛"}
              {rayon} <span className="text-xs text-[#A89080]">(3 items)</span>
            </div>
            <ul className="divide-y divide-[#F2EBE3]">
              {[1,2,3].map((i) => (
                <li key={i} className="flex items-center justify-between py-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="form-checkbox rounded-full border-[#D9CDC1] w-5 h-5 text-[#7C6B5D]" />
                    <span className="text-[#4F443A] font-medium">Nom de l'item</span>
                    <span className="ml-2 text-xs text-[#A89080]">🍽️</span>
                  </label>
                  <span className="text-xs text-[#A89080]">1 barquette</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {/* BARRE D'AJOUT RAPIDE */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E8E1D8] p-3 flex gap-2 items-center max-w-3xl mx-auto">
        <input type="text" placeholder="Ajouter un item..." className="flex-1 rounded-lg border border-[#E8E1D8] px-3 py-2 text-[#4F443A] bg-[#F8F5F1]" />
        <button className="rounded-lg bg-[#7C6B5D] text-white px-4 py-2 font-semibold hover:bg-[#6C5D50]">Ajouter</button>
      </div>
    </div>
  );
}
