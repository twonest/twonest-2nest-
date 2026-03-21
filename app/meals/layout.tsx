import { UtensilsCrossed } from "lucide-react";
import Link from "next/link";

export default function MealsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8F5F1]">
      <header className="flex items-center justify-between px-4 py-3 border-b border-[#E8E1D8] bg-white sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="text-[#7C6B5D]" size={24} />
          <h1 className="text-xl font-bold text-[#4F443A]">Repas & Épicerie</h1>
        </div>
        <nav className="flex gap-2">
          <Link href="/meals" className="px-3 py-1.5 rounded-lg font-medium text-[#7C6B5D] hover:bg-[#F2EBE3]">Menu</Link>
          <Link href="/grocery" className="px-3 py-1.5 rounded-lg font-medium text-[#7C6B5D] hover:bg-[#F2EBE3]">Épicerie</Link>
        </nav>
      </header>
      <main className="max-w-3xl mx-auto w-full p-2 sm:p-6">{children}</main>
    </div>
  );
}
