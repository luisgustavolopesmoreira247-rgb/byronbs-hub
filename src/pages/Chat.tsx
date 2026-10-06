import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Ban,
  Flag,
  Loader2,
  Mic,
  Paperclip,
  Plus,
  Send,
  ShieldAlert,
  Star,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { Navigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getFanSession, clearFanSession } from "@/lib/fan-session";
import logo from "@/assets/logo.svg";

type Session = NonNullable<ReturnType<typeof getFanSession>>;
type Contact = {
  fanId: Id<"fans">;
  name: string;
  fanNumber: number;
  isOfficial: boolean;
  lastMessage: { kind: string; body: string; fromMe: boolean; createdAt: number } | null;
  unread: number;
};
type Message = {
  id: Id<"messages">;
  fromId: Id<"fans">;
  mine: boolean;
  kind: "text" | "image" | "audio";
  body: string;
  url: string | null;
  createdAt: number;
};

/* ---------- small shared pieces ---------- */

function Avatar({ name, size = "h-11 w-11", official = false }: { name: string; size?: string; official?: boolean }) {
  const letter = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      className={`relative grid ${size} shrink-0 place-items-center rounded-2xl font-bold ${
        official
          ? "yellow-chip text-sm"
          : "bg-gradient-to-br from-brand to-[#0f4d37] text-white text-sm"
      }`}
    >
      {official ? <Star className="h-5 w-5 fill-current" /> : letter}
    </span>
  );
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function previewOf(c: Contact) {
  if (!c.lastMessage) return "Nenhuma mensagem ainda";
  const prefix = c.lastMessage.fromMe ? "Você: " : "";
  if (c.lastMessage.kind === "image") return `${prefix}📷 Foto`;
  if (c.lastMessage.kind === "audio") return `${prefix}🎤 Áudio`;
  return `${prefix}${c.lastMessage.body}`;
}

/* ---------- main page ---------- */

export default function Chat() {
  const [session] = useState<Session | null>(() => getFanSession());

  const contactsData = useQuery(
    api.chat.listContacts,
    session ? { fanId: session.fanId, secret: session.secret } : "skip",
  );
  const blockedList = useQuery(
    api.chat.listBlocked,
    session ? { fanId: session.fanId, secret: session.secret } : "skip",
  );

  const [selectedId, setSelectedId] = useState<Id<"fans"> | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);

  const markRead = useMutation(api.chat.markRead);
  const blockUser = useMutation(api.chat.blockUser);
  const unblockUser = useMutation(api.chat.unblockUser);
  const reportUser = useMutation(api.chat.reportUser);
  const removeContact = useMutation(api.chat.removeContact);

  const sessionArgs = useMemo(
    () => (session ? { fanId: session.fanId, secret: session.secret } : null),
    [session],
  );

  const contacts = useMemo(() => contactsData?.contacts ?? [], [contactsData]);
  const selected = useMemo(
    () => contacts.find((c) => c.fanId === selectedId) ?? null,
    [contacts, selectedId],
  );
  const blockedIds = useMemo(() => new Set((blockedList ?? []).map((b) => b.fanId)), [blockedList]);

  /* New-message notifications: toast when unread grows outside the open chat. */
  const prevUnread = useRef<Record<string, number> | null>(null);
  useEffect(() => {
    if (!contactsData) return;
    // First snapshot only seeds the baseline — no toast on page load.
    const seeded = prevUnread.current !== null;
    const next: Record<string, number> = {};
    for (const c of contactsData.contacts) {
      next[c.fanId] = c.unread;
      const before = prevUnread.current?.[c.fanId] ?? 0;
      if (seeded && c.unread > before && c.fanId !== selectedId) {
        toast(`${c.isOfficial ? "⭐" : "💬"} ${c.name} (#${c.fanNumber})`, {
          description: previewOf(c),
        });
      }
    }
    prevUnread.current = next;
  }, [contactsData, selectedId]);

  /* Mark conversation read while it is open (data-change triggers only). */
  const unreadTotal = useMemo(
    () => (contactsData?.contacts ?? []).reduce((sum, c) => sum + c.unread, 0),
    [contactsData],
  );
  useEffect(() => {
    if (!sessionArgs || !selectedId) return;
    const t = setTimeout(() => {
      void markRead({ ...sessionArgs, contactId: selectedId }).catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [selectedId, sessionArgs, markRead, unreadTotal]);

  if (!session) return <Navigate to="/fan" replace />;

  return (
    <main className="dark fan-scope flex h-[100dvh] flex-col text-foreground">
      {/* header */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/8 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <img src={logo} alt="" width={34} height={34} className="rounded-lg" />
          <div className="leading-tight">
            <h1 className="text-sm font-bold tracking-tight sm:text-base">💬 Chat da Comunidade</h1>
            <p className="text-[11px] text-muted-foreground">Comunidade ByronBS</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="yellow-chip hidden rounded-full px-3 py-1 text-xs font-bold sm:inline-block">
            Você é #{contactsData?.myFanNumber ?? session.fanNumber}
          </span>
          <button
            type="button"
            onClick={() => {
              clearFanSession();
              window.location.href = "/fan";
            }}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-white/25 hover:text-foreground"
          >
            Sair
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ---------- contact list ---------- */}
        <aside
          className={`flex w-full flex-col border-r border-white/8 md:w-[340px] ${
            selectedId ? "hidden md:flex" : "flex"
          }`}
        >
          <div className="flex items-center justify-between px-4 pt-4">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Conversas recentes
            </span>
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="brand-gradient-btn inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-transform hover:-translate-y-0.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar contato
            </button>
          </div>

          <nav className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-4">
            {contactsData === undefined && (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {contactsData !== undefined && contacts.length === 0 && (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                Nenhum contato ainda. Adicione um membro pelo número de fã.
              </p>
            )}
            {contacts.map((c) => (
              <ContactRow
                key={c.fanId}
                contact={c}
                active={c.fanId === selectedId}
                blocked={blockedIds.has(c.fanId)}
                onClick={() => setSelectedId(c.fanId)}
              />
            ))}
          </nav>

          <button
            type="button"
            onClick={() => setShowBlocked((v) => !v)}
            className="mx-4 mb-4 inline-flex items-center gap-2 self-start rounded-lg border border-white/10 px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-white/25 hover:text-foreground"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            Bloqueados ({(blockedList ?? []).length})
          </button>
          <AnimatePresence>
            {showBlocked && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mx-4 mb-4 space-y-2 rounded-xl border border-white/8 bg-white/5 p-3">
                  {(blockedList ?? []).length === 0 && (
                    <p className="text-[11px] text-muted-foreground">Nenhum membro bloqueado.</p>
                  )}
                  {(blockedList ?? []).map((b) => (
                    <div key={b.fanId} className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs">
                        {b.name} <span className="text-muted-foreground">#{b.fanNumber}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          sessionArgs &&
                          unblockUser({ ...sessionArgs, contactId: b.fanId }).catch(() => {})
                        }
                        className="text-[11px] font-semibold text-brand hover:underline"
                      >
                        Desbloquear
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </aside>

        {/* ---------- conversation ---------- */}
        <section className={`min-w-0 flex-1 ${selectedId ? "flex" : "hidden md:flex"}`}>
          {selected && sessionArgs ? (
            <Conversation
              key={selected.fanId}
              session={session}
              contact={selected}
              blocked={blockedIds.has(selected.fanId)}
              onBack={() => setSelectedId(null)}
              onBlock={() => {
                blockUser({ ...sessionArgs, contactId: selected.fanId })
                  .then(() => toast(`#${selected.fanNumber} foi bloqueado.`))
                  .catch(() => {});
              }}
              onUnblock={() => {
                unblockUser({ ...sessionArgs, contactId: selected.fanId }).catch(() => {});
              }}
              onReport={(reason) => {
                reportUser({ ...sessionArgs, contactId: selected.fanId, reason })
                  .then(() => toast("Denúncia enviada para a moderação. Obrigado!"))
                  .catch(() => {});
              }}
              onRemove={() => {
                removeContact({ ...sessionArgs, contactId: selected.fanId })
                  .then(() => {
                    setSelectedId(null);
                    toast("Contato removido.");
                  })
                  .catch(() => {});
              }}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <div className="grid h-16 w-16 place-items-center rounded-3xl yellow-chip">
                <Star className="h-8 w-8 fill-current" />
              </div>
              <p className="text-lg font-semibold">💬 Chat da Comunidade</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Escolha uma conversa na lista ou adicione um membro pelo número de fã para começar.
              </p>
            </div>
          )}
        </section>
      </div>

      <AnimatePresence>
        {showAdd && sessionArgs && (
          <AddContactDialog
            session={session}
            onClose={() => setShowAdd(false)}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

/* ---------- contact row ---------- */

function ContactRow({
  contact,
  active,
  blocked,
  onClick,
}: {
  contact: Contact;
  active: boolean;
  blocked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${
        active ? "bg-white/10" : "hover:bg-white/6"
      }`}
    >
      <Avatar name={contact.name} official={contact.isOfficial} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold">{contact.name}</span>
          <span className="shrink-0 text-[11px] text-muted-foreground">#{contact.fanNumber}</span>
          {contact.isOfficial && (
            <span className="rounded bg-signal/20 px-1 py-px text-[9px] font-bold uppercase text-signal">
              Criador
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {blocked ? "Bloqueado" : previewOf(contact)}
        </span>
      </span>
      {contact.unread > 0 && !blocked && (
        <span className="yellow-chip grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-bold">
          {contact.unread}
        </span>
      )}
    </button>
  );
}

/* ---------- conversation pane ---------- */

function Conversation({
  session,
  contact,
  blocked,
  onBack,
  onBlock,
  onUnblock,
  onReport,
  onRemove,
}: {
  session: Session;
  contact: Contact;
  blocked: boolean;
  onBack: () => void;
  onBlock: () => void;
  onUnblock: () => void;
  onReport: (reason: string) => void;
  onRemove: () => void;
}) {
  const sessionArgs = { fanId: session.fanId, secret: session.secret };
  const messages = useQuery(api.chat.listMessages, {
    ...sessionArgs,
    contactId: contact.fanId,
  });
  const markRead = useMutation(api.chat.markRead);
  const sendMessage = useMutation(api.chat.sendMessage);
  const generateUploadUrl = useMutation(api.chat.generateUploadUrl);

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [confirm, setConfirm] = useState<"block" | "remove" | "report" | null>(null);
  const [reportReason, setReportReason] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  const stableArgs = useMemo(
    () => ({ fanId: session.fanId, secret: session.secret }),
    [session.fanId, session.secret],
  );
  useEffect(() => {
    const t = setTimeout(() => {
      void markRead({ ...stableArgs, contactId: contact.fanId }).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [messages?.length, contact.fanId, stableArgs, markRead]);

  async function sendCurrent(kind: "text" | "image" | "audio", payload?: { body?: string; storageId?: Id<"_storage"> }) {
    if (blocked) {
      toast("Desbloqueie este membro para conversar.");
      return;
    }
    setSending(true);
    try {
      await sendMessage({
        ...stableArgs,
        contactId: contact.fanId,
        kind,
        body: payload?.body,
        storageId: payload?.storageId,
      });
      setText("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message.replace(/^Uncaught Error:\s*/, "") : "Falha ao enviar.");
    } finally {
      setSending(false);
    }
  }

  function handleSendText(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    void sendCurrent("text", { body });
  }

  async function handlePickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx. 8 MB).");
      return;
    }
    setSending(true);
    try {
      const url = await generateUploadUrl(stableArgs);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type || "image/jpeg" },
        body: file,
      });
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      await sendCurrent("image", { storageId });
    } catch {
      toast.error("Não foi possível enviar a foto.");
      setSending(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      {/* conversation header */}
      <div className="relative flex shrink-0 items-center gap-3 border-b border-white/8 px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground md:hidden"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Avatar name={contact.name} official={contact.isOfficial} size="h-10 w-10" />
        <div className="min-w-0 leading-tight">
          <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
            {contact.isOfficial && "⭐"} {contact.name}
            <span className="text-[11px] font-normal text-muted-foreground">#{contact.fanNumber}</span>
          </p>
          <p className="text-[11px] text-muted-foreground">
            {contact.isOfficial
              ? "Criador da comunidade"
              : blocked
                ? "Bloqueado"
                : "Membro da Comunidade ByronBS"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowMenu((v) => !v)}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground"
            aria-label="Opções da conversa"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </button>
        </div>
        <AnimatePresence>
          {showMenu && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="glass-card absolute right-3 top-14 z-20 w-52 overflow-hidden rounded-xl p-1 shadow-2xl"
            >
              <MenuItem icon={<Trash2 className="h-3.5 w-3.5" />} label="Remover contato" onClick={() => { setShowMenu(false); setConfirm("remove"); }} />
              {blocked ? (
                <MenuItem icon={<Ban className="h-3.5 w-3.5" />} label="Desbloquear" onClick={() => { setShowMenu(false); onUnblock(); }} />
              ) : (
                <>
                  <MenuItem icon={<Ban className="h-3.5 w-3.5" />} label="Bloquear membro" onClick={() => { setShowMenu(false); setConfirm("block"); }} />
                  <MenuItem icon={<Flag className="h-3.5 w-3.5" />} label="Denunciar" onClick={() => { setShowMenu(false); setConfirm("report"); }} />
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* messages */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-5">
        {messages === undefined && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {messages?.length === 0 && (
          <div className="mx-auto max-w-xs rounded-2xl border border-white/8 bg-white/5 p-4 text-center">
            <p className="text-sm font-semibold">Diga olá 👋</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Você está conversando com {contact.isOfficial ? "o criador da comunidade" : contact.name}.
            </p>
          </div>
        )}
        {messages?.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* composer */}
      <div className="shrink-0 border-t border-white/8 px-3 py-3 sm:px-4">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePickImage}
        />
        <form onSubmit={handleSendText} className="flex items-end gap-2">
          <button
            type="button"
            disabled={blocked || sending}
            onClick={() => fileRef.current?.click()}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 text-muted-foreground transition-colors hover:border-brand/60 hover:text-brand disabled:opacity-40"
            aria-label="Anexar foto"
            title="Anexar foto"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendText(e);
              }
            }}
            rows={1}
            disabled={blocked}
            placeholder={blocked ? "Membro bloqueado" : "Escreva uma mensagem…"}
            className="max-h-32 min-h-10 flex-1 resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-brand/60"
          />
          <VoiceButton
            disabled={blocked || sending}
            onRecorded={(id) => void sendCurrent("audio", { storageId: id })}
            makeUrl={() => generateUploadUrl(stableArgs)}
          />
          <button
            type="submit"
            disabled={blocked || sending || !text.trim()}
            className="brand-gradient-btn grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white transition-transform hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0"
            aria-label="Enviar mensagem"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      </div>

      {/* confirm dialogs */}
      <AnimatePresence>
        {confirm && (
          <ConfirmDialog
            kind={confirm}
            name={contact.name}
            fanNumber={contact.fanNumber}
            reason={reportReason}
            onReasonChange={setReportReason}
            onCancel={() => setConfirm(null)}
            onConfirm={() => {
              if (confirm === "block") onBlock();
              else if (confirm === "remove") onRemove();
              else onReport(reportReason);
              setConfirm(null);
              setReportReason("");
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- message bubble ---------- */

function MessageBubble({ message }: { message: Message }) {
  const mine = message.mine;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className={`flex ${mine ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm sm:max-w-[60%] ${
          mine
            ? "brand-gradient-btn rounded-br-md text-white"
            : "glass-card rounded-bl-md text-foreground"
        }`}
      >
        {message.kind === "text" && (
          <p className="whitespace-pre-wrap break-words leading-relaxed">{message.body}</p>
        )}
        {message.kind === "image" && message.url && (
          <a href={message.url} target="_blank" rel="noopener noreferrer">
            <img
              src={message.url}
              alt="Foto enviada"
              loading="lazy"
              className="max-h-64 w-full rounded-xl object-cover"
            />
          </a>
        )}
        {message.kind === "image" && !message.url && (
          <p className="text-xs opacity-80">📷 Foto</p>
        )}
        {message.kind === "audio" && message.url && <AudioPlayer url={message.url} />}
        {message.kind === "audio" && !message.url && (
          <p className="text-xs opacity-80">🎤 Áudio</p>
        )}
        <p className={`mt-1 text-[10px] ${mine ? "text-white/70" : "text-muted-foreground"}`}>
          {formatTime(message.createdAt)}
        </p>
      </div>
    </motion.div>
  );
}

/* ---------- audio playback + recording ---------- */

function AudioPlayer({ url }: { url: string }) {
  return <audio controls preload="metadata" src={url} className="mt-0.5 w-56 max-w-full" />;
}

function VoiceButton({
  disabled,
  makeUrl,
  onRecorded,
}: {
  disabled: boolean;
  makeUrl: () => Promise<string>;
  onRecorded: (storageId: Id<"_storage">) => void;
}) {
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);

  async function start() {
    if (disabled || recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        if (blob.size < 400) return; // essentially empty recording
        try {
          const url = await makeUrl();
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": blob.type },
            body: blob,
          });
          const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
          onRecorded(storageId);
        } catch {
          toast.error("Não foi possível enviar o áudio.");
        }
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      toast.error("Não foi possível acessar o microfone.");
    }
  }

  function stop() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  if (recording) {
    return (
      <button
        type="button"
        onClick={stop}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-500/90 text-white"
        aria-label="Parar gravação"
        title="Parar e enviar áudio"
      >
        <span className="rec-dot h-3 w-3 rounded-full bg-white" />
      </button>
    );
  }
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={start}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 text-muted-foreground transition-colors hover:border-brand/60 hover:text-brand disabled:opacity-40"
      aria-label="Gravar áudio"
      title="Enviar mensagem de áudio"
    >
      <Mic className="h-4 w-4" />
    </button>
  );
}

/* ---------- menu / dialogs ---------- */

function MenuItem({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs text-foreground transition-colors hover:bg-white/8"
    >
      {icon}
      {label}
    </button>
  );
}

function Backdrop({ onClick }: { onClick: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClick}
      className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
    />
  );
}

function ConfirmDialog({
  kind,
  name,
  fanNumber,
  reason,
  onReasonChange,
  onCancel,
  onConfirm,
}: {
  kind: "block" | "remove" | "report";
  name: string;
  fanNumber: number;
  reason: string;
  onReasonChange: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const copy = {
    block: {
      title: `Bloquear ${name}?`,
      body: "Ele não poderá te enviar mensagens e some da sua lista. Você pode desbloquear depois.",
      action: "Bloquear",
    },
    remove: {
      title: `Remover ${name} (#${fanNumber})?`,
      body: "O contato sai da sua lista. O histórico fica salvo e você pode adicioná-lo de novo.",
      action: "Remover",
    },
    report: {
      title: `Denunciar ${name} (#${fanNumber})?`,
      body: "Sua denúncia vai direto para a moderação da Comunidade ByronBS.",
      action: "Enviar denúncia",
    },
  }[kind];

  return (
    <>
      <Backdrop onClick={onCancel} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="glass-card fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 shadow-2xl"
      >
        <h2 className="text-base font-bold tracking-tight">{copy.title}</h2>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{copy.body}</p>
        {kind === "report" && (
          <textarea
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            rows={3}
            maxLength={300}
            placeholder="Motivo (opcional): spam, assédio, conteúdo inadequado…"
            className="mt-4 w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-brand/60"
          />
        )}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 flex-1 rounded-xl border border-white/12 text-sm font-semibold text-foreground transition-colors hover:bg-white/8"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-10 flex-1 rounded-xl bg-red-500/90 text-sm font-semibold text-white transition-colors hover:bg-red-500"
          >
            {copy.action}
          </button>
        </div>
      </motion.div>
    </>
  );
}

function AddContactDialog({ session, onClose }: { session: Session; onClose: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const addContact = useMutation(api.chat.addContact);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    const digits = value.replace(/[^0-9]/g, "");
    if (!digits) {
      setError("Digite o número do fã, por exemplo: 20");
      return;
    }
    setBusy(true);
    try {
      const res = await addContact({
        fanId: session.fanId,
        secret: session.secret,
        number: Number(digits),
      });
      toast(`${res.name} (#${res.fanNumber}) adicionado aos seus contatos!`);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message.replace(/^Uncaught Error:\s*/, "")
          : "Não foi possível adicionar o contato.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Backdrop onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="glass-card fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold tracking-tight">➕ Adicionar contato</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Digite o número de fã do membro (ex.: 20 para #20).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleAdd} className="mt-5">
          <div className="flex items-center gap-2 rounded-xl border border-white/12 bg-white/5 px-3 focus-within:border-brand/70">
            <span className="text-lg font-bold text-signal">#</span>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              inputMode="numeric"
              autoFocus
              placeholder="Digite o número do fã"
              className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
          </div>
          {error && (
            <p className="mt-3 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="brand-gradient-btn mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            Adicionar aos contatos
          </button>
        </form>

        <p className="mt-4 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Números inexistentes não são adicionados. O número de fã é interno ao site e não revela
          dados pessoais de ninguém.
        </p>
      </motion.div>
    </>
  );
}
