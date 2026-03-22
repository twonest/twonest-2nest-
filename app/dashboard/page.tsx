"use client";
 
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarIcon, MessageSquare, DollarSign, FileText, Users, CheckSquare, ShoppingCart, UserCircle, Stethoscope, GraduationCap, Trash2 } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { useFamily } from "@/components/FamilyProvider";
 
// Utilitaires
function formatDateFr(
  date: Date,
  opts: Intl.DateTimeFormatOptions = { weekday: "long", year: "numeric", month: "long", day: "numeric" }
) {
  return date.toLocaleDateString("fr-FR", opts);
}
function formatShortDate(date: string) {
  return formatDateFr(new Date(date), { weekday: "short", day: "numeric", month: "short" });
}
function formatHour(date: string) {
  return new Date(date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
 
const ICONS: Record<string, any> = {
  "Médecin": Stethoscope,
  "École": GraduationCap,
  "Ordures": Trash2,
  "Recyclage": Trash2,
  "Calendar": CalendarIcon,
  "default": CalendarIcon,
};
 
export default function DashboardPage() {
  const { activeFamilyId, activeFamily, user: contextUser } = useFamily();
  const [profile, setProfile] = useState<any>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [todayEvents, setTodayEvents] = useState<any[]>([]);
  const [weekEvents, setWeekEvents] = useState<any[]>([]);
  const [swapRequests, setSwapRequests] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [children, setChildren] = useState<any[]>([]);
  const [modules, setModules] = useState<any>({});
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();
 
  // Chargement des données principales
  useEffect(() => {
    if (!activeFamilyId) {
  setLoading(false);
  return;
}
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const today = new Date();
    const todayIso = today.toISOString().slice(0, 10);
 
    // Correction : borne haute = début du lendemain
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowIso = tomorrow.toISOString().slice(0, 10);
 
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + 7);
    const weekEndIso = weekEnd.toISOString().slice(0, 10);
 
    async function fetchAll() {
      try {
        // Profil
        let { data: userProfile } = await supabase.from("profiles").select("*", { count: "exact" }).eq("user_id", contextUser?.id).maybeSingle();
        if (!userProfile && contextUser?.id) {
          userProfile = (await supabase.from("profiles").select("*").eq("id", contextUser.id).maybeSingle()).data;
        }
        setProfile(userProfile);
        setAvatarUrl(userProfile?.avatar_url || userProfile?.photo_url || null);
 
        // Enfants
        const { data: childrenRows } = await supabase.from("children").select("*").eq("family_id", activeFamilyId);
        setChildren(childrenRows || []);
 
        // Événements du jour — borne haute corrigée
        const { data: todayEv } = await supabase
          .from("events")
          .select("*")
          .eq("family_id", activeFamilyId)
          .gte("start_at", todayIso)
          .lt("start_at", tomorrowIso)
          .order("start_at");
        setTodayEvents(todayEv?.slice(0, 3) || []);
 
        // Événements semaine
        const { data: weekEv } = await supabase
          .from("events")
          .select("*")
          .eq("family_id", activeFamilyId)
          .gte("start_at", todayIso)
          .lte("start_at", weekEndIso + "T23:59:59")
          .order("start_at");
        setWeekEvents(weekEv?.slice(0, 5) || []);
 
        // Changements de garde du jour
        const { data: swaps } = await supabase
          .from("swap_requests")
          .select("*")
          .eq("family_id", activeFamilyId)
          .eq("date_originale", todayIso)
          .eq("statut", "en_attente");
        setSwapRequests(swaps || []);
 
        // Demandes en attente (hors soi)
        if (contextUser?.id) {
          const { data: pendings } = await supabase
            .from("swap_requests")
            .select("*")
            .eq("family_id", activeFamilyId)
            .eq("statut", "en_attente")
            .neq("demandeur_id", contextUser.id);
          setPendingRequests(pendings || []);
        }
 
        // Messages non lus
        let unreadMessages = 0;
        if (contextUser?.id) {
          const { count } = await supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("family_id", activeFamilyId)
            .neq("sender_id", contextUser.id)
            .is("read_at", null);
          unreadMessages = count || 0;
        }
 
        // Dépenses non remboursées
        const { data: expenses } = await supabase.from("expenses").select("*").eq("family_id", activeFamilyId).eq("rembourse", false);
 
        // Documents ce mois
        const month = today.toISOString().slice(0, 7);
        const { count: docsCount } = await supabase
          .from("documents")
          .select("id", { count: "exact", head: true })
          .eq("family_id", activeFamilyId)
          .gte("created_at", month + "-01");
 
        // Tâches en retard
        const nowIso = today.toISOString();
        const { count: overdueTasks } = await supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("family_id", activeFamilyId)
          .not("due_date", "is", null)
          .lt("due_date", nowIso)
          .is("completed_at", null);
 
        // Tâches à faire
        const { count: todoTasks } = await supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("family_id", activeFamilyId)
          .is("completed_at", null);
 
        // Items épicerie non cochés
        const { count: groceryCount } = await supabase
          .from("grocery_items")
          .select("id", { count: "exact", head: true })
          .eq("family_id", activeFamilyId)
          .eq("is_checked", false);
 
        // Collectes
        const { data: collectes } = await supabase.from("collectes").select("*").eq("family_id", activeFamilyId);
 
        setShifts([]); // TODO: calculer shifts à partir de work_cycles et work_cycle_days
 
        setModules({
          unreadMessages,
          expenses,
          docsCount: docsCount || 0,
          overdueTasks: overdueTasks || 0,
          todoTasks: todoTasks || 0,
          groceryCount: groceryCount || 0,
          collectes: collectes || [],
          children: childrenRows || [],
        });
        setLoading(false);
      } catch (e: any) {
        setError(e.message || "Erreur de chargement");
        setLoading(false);
      }
    }
 
    fetchAll();
    const interval = setInterval(fetchAll, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [activeFamilyId, contextUser]);
 
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F0EB]">
        <div className="animate-pulse text-[#A89080]">Chargement du tableau de bord…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F0EB]">
        <div className="text-[#A85C52]">{error}</div>
      </div>
    );
  }
 
  return (
    <div className="min-h-screen bg-[#F5F0EB] font-sans">
      <header className="sticky top-0 z-30 bg-white/95 border-b border-[#E1D6CB] px-6 py-8 flex items-center justify-between rounded-b-2xl shadow-sm">
        <div>
          <h1 className="text-4xl font-bold text-[#2C2420]">Bonjour {profile?.first_name || profile?.prenom || "Parent"}</h1>
          <div className="text-[#6B5D55] text-base mt-1">{formatDateFr(new Date())}</div>
          {activeFamily && (
            <span className="inline-block mt-2 px-3 py-1 rounded-full bg-[#F5F0EB] border border-[#A89080] text-[#7C6B5D] text-xs font-semibold">
              {activeFamily.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Profil" className="w-14 h-14 rounded-full border-2 border-[#E1D6CB] object-cover" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-[#E1D6CB] flex items-center justify-center">
              <UserCircle size={40} className="text-[#A89080]" />
            </div>
          )}
        </div>
      </header>
 
      <main className="mx-auto max-w-5xl px-4 py-10 space-y-10">
        {/* CARTE AUJOURD'HUI */}
        <section className="bg-white rounded-2xl shadow-sm border border-[#E1D6CB] p-8 mb-8">
          <h2 className="text-xl font-bold text-[#2C2420] mb-4">Aujourd'hui</h2>
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-1">
              <div className="font-semibold text-[#7C6B5D] mb-2">Événements du jour</div>
              {todayEvents.length === 0 ? (
                <div className="text-[#A89080]">Aucun événement aujourd'hui</div>
              ) : (
                <ul className="space-y-2">
                  {todayEvents.map((ev, i) => {
                    const Icon = ICONS[ev.type] || ICONS.default;
                    return (
                      <li key={ev.id || i} className="flex items-center gap-3">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#F5F0EB] border border-[#E1D6CB]">
                          <Icon size={20} className="text-[#7C6B5D]" />
                        </span>
                        <div>
                          <div className="font-medium text-[#2C2420]">{ev.title}</div>
                          <div className="text-xs text-[#A89080]">{formatHour(ev.start_at)}</div>
                          {ev.child_id && (
                            <div className="text-xs text-[#A89080]">{children.find(c => c.id === ev.child_id)?.first_name}</div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
 
            {swapRequests.length > 0 && (
              <div className="flex-1">
                <div className="font-semibold text-[#A85C52] mb-2">Changements de garde</div>
                {swapRequests.map((req, i) => (
                  <div key={req.id || i} className="bg-[#F5F0EB] border border-[#E1D6CB] rounded-xl p-4 mb-2">
                    <div className="text-[#A85C52] font-semibold mb-1">⚠️ Demande d'échange en attente</div>
                    <div className="text-sm text-[#2C2420] mb-2">
                      {formatShortDate(req.date_originale)} → {formatShortDate(req.date_proposee)}
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="px-4 py-2 rounded-lg bg-[#6B8F71] text-white font-semibold hover:bg-[#5A7A5E]"
                        onClick={async () => {
                          await getSupabaseBrowserClient().from("swap_requests").update({ statut: "acceptee" }).eq("id", req.id);
                          setSwapRequests(swapRequests.filter(r => r.id !== req.id));
                        }}
                      >
                        Accepter
                      </button>
                      <button
                        className="px-4 py-2 rounded-lg bg-[#A85C52] text-white font-semibold hover:bg-[#8B4B43]"
                        onClick={async () => {
                          await getSupabaseBrowserClient().from("swap_requests").update({ statut: "refusee" }).eq("id", req.id);
                          setSwapRequests(swapRequests.filter(r => r.id !== req.id));
                        }}
                      >
                        Refuser
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
 
        {/* SECTION SEMAINE */}
        <section className="bg-white rounded-2xl shadow-sm border border-[#E1D6CB] p-8 mb-8">
          <h2 className="text-xl font-bold text-[#2C2420] mb-4">Cette semaine</h2>
          {weekEvents.length === 0 ? (
            <div className="text-[#A89080]">Semaine tranquille ✨</div>
          ) : (
            <ul className="space-y-2">
              {weekEvents.map((ev, i) => {
                const Icon = ICONS[ev.type] || ICONS.default;
                return (
                  <li key={ev.id || i} className="flex items-center gap-3">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#F5F0EB] border border-[#E1D6CB]">
                      <Icon size={20} className="text-[#7C6B5D]" />
                    </span>
                    <div>
                      <div className="font-medium text-[#2C2420]">{ev.title}</div>
                      <div className="text-xs text-[#A89080]">{formatShortDate(ev.start_at)} · {formatHour(ev.start_at)}</div>
                      {ev.child_id && (
                        <div className="text-xs text-[#A89080]">{children.find(c => c.id === ev.child_id)?.first_name}</div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
 
        {/* GRILLE DE MODULES */}
        <section>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link href="/calendar" className="bg-white rounded-2xl border border-[#E1D6CB] shadow-sm p-6 flex flex-col gap-2 hover:shadow-md transition">
              <div className="flex items-center gap-3"><CalendarIcon className="text-[#7C6B5D]" /> <span className="font-semibold text-[#2C2420]">Calendrier</span></div>
              <div className="text-sm text-[#A89080]">{weekEvents.length} événements cette semaine</div>
            </Link>
            <Link href="/messages" className="bg-white rounded-2xl border border-[#E1D6CB] shadow-sm p-6 flex flex-col gap-2 hover:shadow-md transition">
              <div className="flex items-center gap-3"><MessageSquare className="text-[#7C6B5D]" /> <span className="font-semibold text-[#2C2420]">Messages</span></div>
              {modules.unreadMessages > 0 ? (
                <div className="text-sm text-[#A85C52] font-semibold">{modules.unreadMessages} messages non lus</div>
              ) : (
                <div className="text-sm text-[#6B8F71]">À jour</div>
              )}
            </Link>
            <Link href="/expenses" className="bg-white rounded-2xl border border-[#E1D6CB] shadow-sm p-6 flex flex-col gap-2 hover:shadow-md transition">
              <div className="flex items-center gap-3"><DollarSign className="text-[#7C6B5D]" /> <span className="font-semibold text-[#2C2420]">Dépenses</span></div>
              <div className="text-sm text-[#A89080]">{modules.expenses?.length || 0} dépenses non remboursées</div>
            </Link>
            <Link href="/documents" className="bg-white rounded-2xl border border-[#E1D6CB] shadow-sm p-6 flex flex-col gap-2 hover:shadow-md transition">
              <div className="flex items-center gap-3"><FileText className="text-[#7C6B5D]" /> <span className="font-semibold text-[#2C2420]">Documents</span></div>
              <div className="text-sm text-[#A89080]">{modules.docsCount} documents ce mois</div>
            </Link>
            <Link href="/children" className="bg-white rounded-2xl border border-[#E1D6CB] shadow-sm p-6 flex flex-col gap-2 hover:shadow-md transition">
              <div className="flex items-center gap-3"><Users className="text-[#7C6B5D]" /> <span className="font-semibold text-[#2C2420]">Enfants</span></div>
              <div className="text-sm text-[#A89080]">
                {modules.children?.length > 0 ? modules.children.map((c: any) => c.first_name).join(", ") : "Aucun enfant"}
              </div>
            </Link>
            <Link href="/calendar" className="bg-white rounded-2xl border border-[#E1D6CB] shadow-sm p-6 flex flex-col gap-2 hover:shadow-md transition">
              <div className="flex items-center gap-3"><Trash2 className="text-[#7C6B5D]" /> <span className="font-semibold text-[#2C2420]">Collectes</span></div>
              <div className="text-sm text-[#A89080]">Prochaine : à venir</div>
            </Link>
          </div>
        </section>
 
        {/* DEMANDES EN ATTENTE */}
        {pendingRequests.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm border border-[#E1D6CB] p-8 mb-8">
            <h2 className="text-xl font-bold text-[#2C2420] mb-4">Demandes en attente</h2>
            {pendingRequests.map((req, i) => (
              <div key={req.id || i} className="bg-[#F5F0EB] border border-[#E1D6CB] rounded-xl p-4 mb-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <div className="text-[#A85C52] font-semibold mb-1">Demande d'échange de garde</div>
                  <div className="text-sm text-[#2C2420] mb-2">
                    {formatShortDate(req.date_originale)} → {formatShortDate(req.date_proposee)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    className="px-4 py-2 rounded-lg bg-[#6B8F71] text-white font-semibold hover:bg-[#5A7A5E]"
                    onClick={async () => {
                      await getSupabaseBrowserClient().from("swap_requests").update({ statut: "acceptee" }).eq("id", req.id);
                      setPendingRequests(pendingRequests.filter(r => r.id !== req.id));
                    }}
                  >
                    Accepter
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg bg-[#A85C52] text-white font-semibold hover:bg-[#8B4B43]"
                    onClick={async () => {
                      await getSupabaseBrowserClient().from("swap_requests").update({ statut: "refusee" }).eq("id", req.id);
                      setPendingRequests(pendingRequests.filter(r => r.id !== req.id));
                    }}
                  >
                    Refuser
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}
 
        {/* SHIFTS DE LA SEMAINE */}
        {shifts.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm border border-[#E1D6CB] p-8 mb-8">
            <h2 className="text-xl font-bold text-[#2C2420] mb-4">Shifts de la semaine</h2>
            <ul className="space-y-2">
              {shifts.map((shift, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#F5F0EB] border border-[#E1D6CB]">
                    <UserCircle size={20} className="text-[#7C6B5D]" />
                  </span>
                  <div>
                    <div className="font-medium text-[#2C2420]">{shift.label}</div>
                    <div className="text-xs text-[#A89080]">{shift.time}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}