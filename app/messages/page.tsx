"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel, User } from "@supabase/supabase-js";
import { Paperclip, Send } from "lucide-react";
import AccessDeniedCard from "@/components/AccessDeniedCard";
import { useFamily } from "@/components/FamilyProvider";
import { getFeatureAccess } from "@/lib/family";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type MessageRow = {
 id?: string | number;
 sender_id?: string;
 family_id?: string;
 content?: string;
 attachment_url?: string;
 attachment_name?: string;
 attachment_type?: string;
 created_at?: string;
 read_at?: string | null;
};

type ChatMessage = {
 id: string;
 senderId: string;
 senderFirstName: string;
 familyId: string;
 content: string;
 attachmentUrl: string | null;
 attachmentName: string | null;
 attachmentType: string | null;
 createdAt: string;
 readAt: string | null;
 isMine: boolean;
};

type Toast = {
 message: string;
 variant: "success" | "error";
};

function formatDayLabel(value: string): string {
 const date = new Date(value);
 if (Number.isNaN(date.getTime())) {
	return value;
 }

 return date.toLocaleDateString("fr-CA", {
	weekday: "long",
	day: "2-digit",
	month: "long",
	year: "numeric",
 });
}

function formatTimeLabel(value: string): string {
 const date = new Date(value);
 if (Number.isNaN(date.getTime())) {
	return "";
 }

 return date.toLocaleTimeString("fr-CA", {
	hour: "2-digit",
	minute: "2-digit",
 });
}

function formatExactDateTime(value: string): string {
 const date = new Date(value);
 if (Number.isNaN(date.getTime())) {
	return value;
 }

 return date.toLocaleString("fr-CA", {
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
 });
}

function getDayKey(value: string): string {
 const date = new Date(value);
 if (Number.isNaN(date.getTime())) {
	return value;
 }

 const month = `${date.getMonth() + 1}`.padStart(2, "0");
 const day = `${date.getDate()}`.padStart(2, "0");
 return `${date.getFullYear()}-${month}-${day}`;
}

function extractMissingColumn(message: string): string | null {
 const match = message.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+does not exist/i);
 if (match?.[1]) {
	return match[1];
 }

 const cacheMatch = message.match(/Could not find the ['\"]?([a-zA-Z0-9_]+)['\"]? column/i);
 return cacheMatch?.[1] ?? null;
}

function deriveFirstName(profile: Record<string, unknown> | null, userId: string): string {
 if (!profile) {
	return userId.slice(0, 8);
 }

 const firstName =
	typeof profile.first_name === "string"
	 ? profile.first_name.trim()
	 : typeof profile.prenom === "string"
		? profile.prenom.trim()
		: "";

 if (firstName) {
	return firstName;
 }

 const email = typeof profile.email === "string" ? profile.email : "";
 if (email.includes("@")) {
	return email.split("@")[0];
 }

 return userId.slice(0, 8);
}

export default function MessagesPage() {
 const router = useRouter();
 const { activeFamilyId, user: familyUser, currentRole, currentPermissions } = useFamily();

 const [user, setUser] = useState<User | null>(familyUser);
 const [isLoading, setIsLoading] = useState(true);
 const [configError, setConfigError] = useState("");
 const [errorMessage, setErrorMessage] = useState("");
 const [text, setText] = useState("");
 const [isSending, setIsSending] = useState(false);
 const [selectedFile, setSelectedFile] = useState<File | null>(null);
 const [messages, setMessages] = useState<ChatMessage[]>([]);
 const [senderNameById, setSenderNameById] = useState<Record<string, string>>({});
 const [toast, setToast] = useState<Toast | null>(null);

 const fileInputRef = useRef<HTMLInputElement | null>(null);
 const bottomRef = useRef<HTMLDivElement | null>(null);
 const channelRef = useRef<RealtimeChannel | null>(null);

 const messagesAccess = currentRole
	? getFeatureAccess("messages", currentRole, currentPermissions)
	: { allowed: true, readOnly: false, reason: "" };

 const refreshMessages = async (currentUser: User, familyId: string, namesMap: Record<string, string> = senderNameById) => {
	const supabase = getSupabaseBrowserClient();
	const primary = await supabase
	 .from("messages")
	 .select("id, sender_id, family_id, content, attachment_url, attachment_name, attachment_type, created_at, read_at")
	 .eq("family_id", familyId)
	 .order("created_at", { ascending: true });

	let rows = ((primary.data ?? []) as MessageRow[]);
	let error = primary.error;

  if (error && extractMissingColumn(error.message) === "read_at") {
   const fallback = await supabase
	.from("messages")
	.select("id, sender_id, family_id, content, attachment_url, attachment_name, attachment_type, created_at")
	.eq("family_id", familyId)
	.order("created_at", { ascending: true });

	 rows = ((fallback.data ?? []) as MessageRow[]);
   error = fallback.error;
  }

	if (error) {
	 throw new Error(error.message);
	}

	const mapped = rows
	 .map((row): ChatMessage | null => {
		const id = row.id ? String(row.id) : "";
		const senderId = typeof row.sender_id === "string" ? row.sender_id : "";
		const rowFamilyId = typeof row.family_id === "string" ? row.family_id : "";
		const createdAt = typeof row.created_at === "string" ? row.created_at : "";
		if (!id || !senderId || !rowFamilyId || !createdAt) {
			return null;
		}

		return {
		 id,
		 senderId,
		senderFirstName: namesMap[senderId] ?? "Parent",
		 familyId: rowFamilyId,
		 content: typeof row.content === "string" ? row.content : "",
		 attachmentUrl: typeof row.attachment_url === "string" ? row.attachment_url : null,
		 attachmentName: typeof row.attachment_name === "string" ? row.attachment_name : null,
		 attachmentType: typeof row.attachment_type === "string" ? row.attachment_type : null,
		 createdAt,
		 readAt: typeof row.read_at === "string" ? row.read_at : null,
		 isMine: senderId === currentUser.id,
		};
	 })
	 .filter((item): item is ChatMessage => item !== null);

	setMessages(mapped);

	const unreadIncoming = mapped.filter((item) => !item.isMine && !item.readAt);
	if (unreadIncoming.length > 0) {
	 const unreadIds = unreadIncoming.map((item) => item.id);
	 const nowIso = new Date().toISOString();
	 await supabase.from("messages").update({ read_at: nowIso }).in("id", unreadIds).eq("family_id", familyId);
	 setMessages((current) =>
		current.map((item) => (unreadIds.includes(item.id) ? { ...item, readAt: nowIso } : item)),
	 );
	}
 };

 const refreshSenderNames = async (familyId: string): Promise<Record<string, string>> => {
	const supabase = getSupabaseBrowserClient();
	const { data: members } = await supabase
	 .from("family_members")
	 .select("user_id")
	 .eq("family_id", familyId)
	 .eq("status", "active");

	const ids = Array.from(
	 new Set(
		((members ?? []) as Array<Record<string, unknown>>)
		 .map((item) => (typeof item.user_id === "string" ? item.user_id : null))
		 .filter((item): item is string => Boolean(item)),
	 ),
	);

	if (ids.length === 0) {
	 setSenderNameById({});
		return {};
	}

	const { data: profiles } = await supabase
	 .from("profiles")
	 .select("user_id, first_name, prenom, email")
	 .in("user_id", ids);

	const map: Record<string, string> = {};
	for (const id of ids) {
	 const profile = ((profiles ?? []) as Array<Record<string, unknown>>).find((item) => item.user_id === id) ?? null;
	 map[id] = deriveFirstName(profile, id);
	}

	setSenderNameById(map);
	return map;
 };

 useEffect(() => {
	if (!toast) {
	 return;
	}
	const timeout = setTimeout(() => setToast(null), 3000);
	return () => clearTimeout(timeout);
 }, [toast]);

 useEffect(() => {
	bottomRef.current?.scrollIntoView({ behavior: "smooth" });
 }, [messages]);

 useEffect(() => {
	let cancelled = false;

	const init = async () => {
	 let supabase;

	 try {
		supabase = getSupabaseBrowserClient();
	 } catch (error) {
		setConfigError(error instanceof Error ? error.message : "Configuration Supabase manquante.");
		setIsLoading(false);
		return;
	 }

	 const { data } = await supabase.auth.getUser();
	 if (!data.user) {
		router.replace("/");
		return;
	 }

	 if (!activeFamilyId) {
		setErrorMessage("Aucun espace actif sélectionné.");
		setIsLoading(false);
		return;
	 }

	 setUser(data.user);

	 try {
		const namesMap = await refreshSenderNames(activeFamilyId);
		await refreshMessages(data.user, activeFamilyId, namesMap);
	 } catch (error) {
		setErrorMessage(error instanceof Error ? error.message : "Impossible de charger les messages.");
	 } finally {
		if (!cancelled) {
		 setIsLoading(false);
		}
	 }

	 channelRef.current?.unsubscribe();
	 channelRef.current = supabase
		.channel(`messages-family-${activeFamilyId}`)
		.on(
		 "postgres_changes",
		 {
			event: "*",
			schema: "public",
			table: "messages",
			filter: `family_id=eq.${activeFamilyId}`,
		 },
		 async () => {
			const namesMap = await refreshSenderNames(activeFamilyId);
			await refreshMessages(data.user as User, activeFamilyId, namesMap);
		 },
		)
		.subscribe();
	};

	void init();

	return () => {
	 cancelled = true;
	 channelRef.current?.unsubscribe();
	};
 }, [activeFamilyId, router]);

 const groupedItems = useMemo(() => {
	const items: Array<{ type: "day"; key: string; label: string } | { type: "message"; message: ChatMessage }> = [];
	let lastDay = "";

	for (const message of messages) {
	 const dayKey = getDayKey(message.createdAt);
	 if (dayKey !== lastDay) {
		items.push({ type: "day", key: dayKey, label: formatDayLabel(message.createdAt) });
		lastDay = dayKey;
	 }
	 items.push({ type: "message", message });
	}

	return items;
 }, [messages]);

 const onSelectAttachment = (event: ChangeEvent<HTMLInputElement>) => {
	const file = event.target.files?.[0] ?? null;
	setSelectedFile(file);
 };

 const uploadAttachment = async (file: File, senderId: string, familyId: string): Promise<{ url: string; name: string; type: string }> => {
	const supabase = getSupabaseBrowserClient();
	const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
	const path = `${familyId}/${senderId}/${Date.now()}-${safeName}`;

	const upload = await supabase.storage.from("messages").upload(path, file, { upsert: false });
	if (upload.error) {
	 throw new Error(`${upload.error.message}. Vérifie le bucket Storage 'messages'.`);
	}

	const { data } = supabase.storage.from("messages").getPublicUrl(path);
	return {
	 url: data.publicUrl,
	 name: file.name,
	 type: file.type || "application/octet-stream",
	};
 };

 const sendMessage = async () => {
	if (!user || !activeFamilyId) {
	 return;
	}

	const trimmed = text.trim();
	if (!trimmed && !selectedFile) {
	 return;
	}

	setIsSending(true);
	setErrorMessage("");

	try {
	 let attachmentUrl: string | null = null;
	 let attachmentName: string | null = null;
	 let attachmentType: string | null = null;

	 if (selectedFile) {
		const uploaded = await uploadAttachment(selectedFile, user.id, activeFamilyId);
		attachmentUrl = uploaded.url;
		attachmentName = uploaded.name;
		attachmentType = uploaded.type;
	 }

	 const supabase = getSupabaseBrowserClient();
	 let payload: Record<string, unknown> = {
		sender_id: user.id,
		family_id: activeFamilyId,
		content: trimmed || null,
		attachment_url: attachmentUrl,
		attachment_name: attachmentName,
		attachment_type: attachmentType,
	 };

	 for (let attempt = 0; attempt < 8; attempt += 1) {
		const result = await supabase.from("messages").insert(payload).select("id").maybeSingle();
		if (!result.error) {
		 setText("");
		 setSelectedFile(null);
		 if (fileInputRef.current) {
			fileInputRef.current.value = "";
		 }
		 return;
		}

		const missing = extractMissingColumn(result.error.message);
		if (missing && Object.prototype.hasOwnProperty.call(payload, missing)) {
		 const next = { ...payload };
		 delete next[missing];
		 payload = next;
		 continue;
		}

		throw new Error(result.error.message);
	 }
	} catch (error) {
	 setErrorMessage(error instanceof Error ? error.message : "Impossible d'envoyer le message.");
	 setToast({ message: "Échec de l'envoi.", variant: "error" });
	} finally {
	 setIsSending(false);
	}
 };

 const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
	event.preventDefault();
	await sendMessage();
 };

 if (configError) {
	return (
	 <div className="flex min-h-screen items-center justify-center bg-[#F5F0EB] px-6">
		<p className="max-w-xl text-center text-sm font-medium text-[#A85C52]">{configError}</p>
	 </div>
	);
 }

 if (!messagesAccess.allowed) {
	return <AccessDeniedCard title="Messages" message={messagesAccess.reason} />;
 }

 return (
	<div className="relative min-h-screen overflow-hidden bg-[#F5F0EB] px-4 py-6 sm:px-6">
	 <main className="mx-auto flex h-[calc(100vh-7rem)] w-full max-w-5xl flex-col rounded-3xl border border-[#D9D0C8] bg-white/90 shadow-[0_12px_40px_rgba(44,36,32,0.10)]">
		<header className="border-b border-[#E3D9CF] px-5 py-4">
		 <h1 className="text-xl font-semibold text-[#2C2420]">Conversation familiale</h1>
		 <p className="mt-1 text-sm text-[#6B5D55]">Messages horodatés et conservés pour le suivi de co-parentalité.</p>
		</header>

		<section className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
		 {isLoading ? (
			<p className="text-sm text-[#6B5D55]">Chargement des messages...</p>
		 ) : groupedItems.length === 0 ? (
			<p className="text-sm text-[#6B5D55]">Aucun message dans cet espace pour le moment.</p>
		 ) : (
			<div className="space-y-3">
			 {groupedItems.map((item) => {
				if (item.type === "day") {
				 return (
					<div key={item.key} className="flex justify-center">
					 <span className="rounded-full border border-[#D9D0C8] bg-[#F5F0EB] px-3 py-1 text-xs font-medium text-[#6B5D55]">
						{item.label}
					 </span>
					</div>
				 );
				}

				const message = item.message;
				const bubbleClass = message.isMine ? "bg-[#7C6B5D]" : "border border-[#D9D0C8] bg-[#FFFFFF]";

				return (
				 <div key={message.id} className={`flex ${message.isMine ? "justify-end" : "justify-start"}`}>
					<div className="max-w-[80%] sm:max-w-[70%]">
					 <div
						className={`rounded-2xl px-4 py-3 ${bubbleClass}`}
						style={
						 message.isMine
							? { backgroundColor: "#7C6B5D", color: "#FFFFFF" }
							: {
								backgroundColor: "#FFFFFF",
								color: "#2C2420",
								border: "1px solid #D9D0C8",
							 }
						}
					 >
								{message.content ? <p className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: 'inherit' }}>{message.content}</p> : null}
						{message.attachmentUrl && (
						 <a
							href={message.attachmentUrl}
							target="_blank"
							rel="noreferrer"
							className={`mt-2 block rounded-xl border px-3 py-2 text-sm ${message.isMine ? "border-white/40" : "border-[#CDBFB2]"}`}
							style={{ color: "inherit" }}
						 >
							{message.attachmentName ?? "Pièce jointe"}
						 </a>
						)}
					 </div>
					 <div
						className={`mt-1 px-1 ${message.isMine ? "text-right" : "text-left"}`}
						style={{ color: "#A89080", fontSize: "11px" }}
					 >
						<p style={{ color: "inherit" }}>{message.senderFirstName} · {formatExactDateTime(message.createdAt)}</p>
						{message.isMine && message.readAt && <p style={{ color: "inherit" }}>Lu à {formatTimeLabel(message.readAt)}</p>}
					 </div>
					</div>
				 </div>
				);
			 })}
			 <div ref={bottomRef} />
			</div>
		 )}
		</section>

		<footer className="border-t border-[#E3D9CF] bg-[#FFFFFF] px-4 py-4 sm:px-6">
		 {errorMessage && <p className="mb-2 text-sm text-[#A85C52]">{errorMessage}</p>}
		 {toast && (
			<p className={`mb-2 text-sm ${toast.variant === "error" ? "text-[#A85C52]" : "text-[#4A7A57]"}`}>
			 {toast.message}
			</p>
		 )}

		 <form onSubmit={onSubmit} className="flex items-end gap-2">
			<input
			 ref={fileInputRef}
			 type="file"
			 accept="image/*,.pdf"
			 onChange={onSelectAttachment}
			 className="hidden"
			 id="message-attachment"
			/>
			<button
			 type="button"
			 onClick={() => fileInputRef.current?.click()}
			 className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#D9D0C8] bg-white text-[#6B5D55] hover:bg-[#F5F0EB]"
			 aria-label="Joindre un fichier"
			>
			 <Paperclip size={18} />
			</button>

			<div className="flex-1 rounded-2xl border border-[#D9D0C8] bg-[#FFFFFF] px-3 py-2">
			 <textarea
				value={text}
				onChange={(event) => setText(event.target.value)}
				onKeyDown={(event) => {
				 if (event.key === "Enter" && !event.shiftKey) {
					event.preventDefault();
					void sendMessage();
				 }
				}}
				placeholder="Écrire un message..."
				rows={2}
				className="w-full resize-none bg-transparent text-sm text-[#2C2420] placeholder-[#A89080] outline-none"
			 />
			 {selectedFile && (
				<p className="mt-1 truncate text-xs text-[#6B5D55]">Pièce jointe: {selectedFile.name}</p>
			 )}
			</div>

			<button
			 type="submit"
			 disabled={isSending || (!text.trim() && !selectedFile)}
			 className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#7C6B5D] px-4 text-sm font-semibold text-white hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
			>
			 <Send size={16} />
			 Envoyer
			</button>
		 </form>

		 <p className="mt-2 text-xs text-[#8B7E74]">Messages non modifiables et non supprimables depuis l’interface.</p>
		</footer>
	 </main>
	</div>
 );
}
