import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Loader2, Star } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getFanSession, setFanSession } from "@/lib/fan-session";
import logo from "@/assets/logo.svg";

/**
 * /fan — “Me tornar fã”.
 *
 * Asks for a name/apelido only, then generates an exclusive, never-repeated
 * fan number (#10, #20, …) via the Convex counter. Dark green/yellow gamer
 * identity lives inside the `.dark` + `.fan-scope` wrapper.
 */
export default function FanSignup() {
  const navigate = useNavigate();
  const join = useMutation(api.fans.join);

  const existing = getFanSession();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ name: string; fanNumber: number } | null>(
    existing ? { name: existing.name, fanNumber: existing.fanNumber } : null,
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await join({ name });
      setFanSession(res);
      setCreated({ name: res.name, fanNumber: res.fanNumber });
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^.*?Uncaught /, "") : "Não foi possível criar seu perfil.");
    } finally {
      setBusy(false);
    }
  }

  /* ---------------- already a fan / just created ---------------- */
  if (created) {
    return (
      <main className="dark fan-scope min-h-screen text-foreground">
        <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-16">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="glass-card w-full rounded-3xl p-8 text-center"
          >
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl yellow-chip">
              <Star className="h-7 w-7 fill-current" />
            </div>
            <h1 className="mt-6 text-2xl font-bold tracking-tight">
              {existing ? "Você já é fã" : "Bem-vindo à comunidade,"} {created.name}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">Seu número de fã exclusivo:</p>

            <motion.p
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.15 }}
              className="mt-4 bg-gradient-to-br from-[#f5c542] to-[#e0ab2b] bg-clip-text text-6xl font-extrabold tracking-tight text-transparent"
            >
              #{created.fanNumber}
            </motion.p>

            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Guarde este número — é como um telefone da Comunidade ByronBS. É assim que outros
              membros te adicionam no chat. Ele não revela nenhum dado pessoal seu.
            </p>

            <button
              type="button"
              onClick={() => navigate("/chat")}
              className="brand-gradient-btn mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-all hover:-translate-y-0.5"
            >
              Entrar no Chat da Comunidade
              <ArrowRight className="h-4 w-4" />
            </button>

            <Link
              to="/"
              className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar para a página inicial
            </Link>
          </motion.div>
        </div>
      </main>
    );
  }

  /* ---------------- signup form ---------------- */
  return (
    <main className="dark fan-scope min-h-screen text-foreground">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-1.5 self-start text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Página inicial
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="glass-card rounded-3xl p-8"
        >
          <div className="flex items-center gap-3">
            <img src={logo} alt="" width={44} height={44} className="rounded-xl" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">
                Comunidade ByronBS
              </p>
              <h1 className="text-xl font-bold tracking-tight">Me tornar fã</h1>
            </div>
          </div>

          <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
            Informe apenas um nome ou apelido. Na sequência, o sistema gera um{" "}
            <span className="text-foreground">número de fã exclusivo</span> para você — único e
            impossível de se repetir.
          </p>

          <form onSubmit={handleSubmit} className="mt-7">
            <label htmlFor="fan-name" className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Nome / apelido
            </label>
            <input
              id="fan-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: João"
              autoComplete="nickname"
              maxLength={24}
              className="mt-2 h-12 w-full rounded-xl border border-white/12 bg-white/5 px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-brand/70"
            />

            {error && (
              <p className="mt-3 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || name.trim().length < 2}
              className="brand-gradient-btn mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gerando seu número…
                </>
              ) : (
                <>
                  <Star className="h-4 w-4 fill-current" />
                  Criar meu perfil de fã
                </>
              )}
            </button>
          </form>

          <ul className="mt-6 space-y-2 text-[11px] leading-relaxed text-muted-foreground">
            <li>• Sem senha, sem e-mail, sem telefone — só um apelido.</li>
            <li>• O número de fã é um identificador interno do site.</li>
            <li>• Você pode remover contatos e denunciar quem abusar do chat.</li>
          </ul>
        </motion.div>
      </div>
    </main>
  );
}
