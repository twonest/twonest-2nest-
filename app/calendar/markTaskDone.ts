// Action rapide : marquer la tâche comme faite
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
export async function markTaskDone(taskId: string, refreshTasks: any, setTaskContextMenu: any, setToast: any, currentFamilyId: any) {
  try {
    const supabase = getSupabaseBrowserClient();
    await supabase.from("tasks").update({ status: "done", completed_at: new Date().toISOString() }).eq("id", taskId);
    await refreshTasks(supabase, currentFamilyId);
    setTaskContextMenu(null);
    setToast({ message: "Tâche marquée comme faite.", variant: "success" });
  } catch (error) {
    setToast({ message: "Erreur lors de la mise à jour.", variant: "error" });
  }
}
