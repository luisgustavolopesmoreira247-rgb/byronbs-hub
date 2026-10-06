import { useEffect, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { getFanSession } from "@/lib/fan-session";
import { Link } from "react-router";
import logo from "@/assets/logo.svg";

/* ------------------------------------------------------------------ */
/* Navigation — v1 sections are live; the rest is announced as "soon". */
/* ------------------------------------------------------------------ */

type NavItem = {
  label: string;
  href: string;
  soon?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Início", href: "#inicio" },
  { label: "Comunidade", href: "#comunidade" },
  { label: "Conteúdos", href: "#conteudos", soon: true },
  { label: "Eventos", href: "#eventos", soon: true },
  { label: "Ranking", href: "#ranking", soon: true },
  { label: "Redes Sociais", href: "#redes" },
];

/* ------------------------------------------------------------------ */
/* Social links — the second pillar of version 1.                      */
/* ------------------------------------------------------------------ */

type SocialLink = {
  name: string;
  handle: string;
  href: string;
  icon: React.ReactNode;
};

const iconProps = { className: "h-5 w-5", "aria-hidden": true } as const;

const SOCIAL_LINKS: SocialLink[] = [
  {
    name: "YouTube",
    handle: "@byronbs49",
    href: "https://youtube.com/@byronbs49?si=QKoem_cQrq0UAXOd",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" {...iconProps}>
        <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.4 31.4 0 0 0 0 12a31.4 31.4 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.4 31.4 0 0 0 24 12a31.4 31.4 0 0 0-.5-5.8ZM9.5 15.6V8.4l6.3 3.6-6.3 3.6Z" />
      </svg>
    ),
  },
  {
    name: "Instagram",
    handle: "@byronbs49",
    href: "https://www.instagram.com/byronbs49?stkn=MW5qMHE4Nmw0MDhtcw==",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...iconProps}>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    name: "TikTok",
    handle: "@byronbs25",
    href: "https://www.tiktok.com/@byronbs25",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" {...iconProps}>
        <path d="M16.6 2h-3v13.1a2.7 2.7 0 1 1-2.3-2.7v-3a5.7 5.7 0 1 0 5.3 5.7V8.6A6.8 6.8 0 0 0 20.5 10V7a3.9 3.9 0 0 1-3.9-3.9V2Z" />
      </svg>
    ),
  },
];

/* ------------------------------------------------------------------ */
/* Small shared pieces                                                 */
/* ------------------------------------------------------------------ */

function SectionLabel({ index, children }: { index: string; children: React.ReactNode }) {
  return (
    <p className="mb-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
      <span className="h-px w-8 bg-border" />
      <span className="text-brand">{index}</span>
      {children}
    </p>
  );
}

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, ease: "easeOut", delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState("#inicio");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const ids = ["inicio", "comunidade", "redes"];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(`#${entry.target.id}`);
        });
      },
      { rootMargin: "-40% 0px -50% 0px" },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 border-b bg-background/85 backdrop-blur-md transition-colors duration-300 ${
        scrolled ? "border-border" : "border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <a href="#inicio" className="group flex items-center gap-3" aria-label="ByronBS — início">
          <img
            src={logo}
            alt=""
            width={32}
            height={32}
            className="rounded-[9px] transition-transform duration-300 group-hover:-translate-y-0.5"
          />
          <span className="flex flex-col leading-none">
            <span className="text-[15px] font-bold tracking-tight">ByronBS</span>
            <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Comunidade
            </span>
          </span>
        </a>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Navegação principal">
          {NAV_ITEMS.map((item) =>
            item.soon ? (
              <span
                key={item.label}
                title="Em breve"
                className="cursor-default text-sm text-muted-foreground/55 transition-colors hover:text-muted-foreground"
              >
                {item.label}
              </span>
            ) : (
              <a
                key={item.label}
                href={item.href}
                className={`relative text-sm font-medium transition-colors hover:text-foreground ${
                  active === item.href ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {item.label}
                <span
                  className={`absolute -bottom-1.5 left-0 h-px bg-brand transition-all duration-300 ${
                    active === item.href ? "w-full" : "w-0"
                  }`}
                />
              </a>
            ),
          )}
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          className="grid h-10 w-10 place-items-center rounded-lg border border-border text-foreground transition-colors hover:bg-secondary md:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="overflow-hidden border-t border-border bg-background md:hidden"
          >
            <nav className="mx-auto max-w-5xl px-6 py-2" aria-label="Navegação móvel">
              {NAV_ITEMS.map((item) =>
                item.soon ? (
                  <span
                    key={item.label}
                    className="flex items-center justify-between border-b border-border/60 py-3.5 text-sm text-muted-foreground/55 last:border-b-0"
                  >
                    {item.label}
                    <span className="text-[10px] font-medium uppercase tracking-[0.18em]">
                      Em breve
                    </span>
                  </span>
                ) : (
                  <a
                    key={item.label}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between border-b border-border/60 py-3.5 text-sm font-medium text-foreground transition-colors last:border-b-0 hover:text-brand"
                  >
                    {item.label}
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                  </a>
                ),
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Hero — welcome message (indispensable item of v1)                   */
/* ------------------------------------------------------------------ */

function Hero() {
  // Visitors with a fan profile land straight in the chat.
  const [fanHomeHref] = useState(() => (getFanSession() ? "/chat" : "/fan"));

  return (
    <section id="inicio" className="relative overflow-hidden">
      <div className="hero-glow pointer-events-none absolute inset-x-0 top-0 h-[560px]" aria-hidden />

      <div className="relative mx-auto max-w-5xl px-6 pb-24 pt-20 sm:pt-28">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex items-center gap-3"
        >
          <img src={logo} alt="Logo ByronBS" width={56} height={56} className="rounded-2xl shadow-md" />
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            Comunidade oficial
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.08, ease: "easeOut" }}
          className="mt-10 max-w-4xl text-4xl font-extrabold uppercase leading-[1.04] tracking-tight text-balance sm:text-6xl lg:text-7xl"
        >
          Bem-vindo à comunidade de{" "}
          <span className="relative whitespace-nowrap text-brand">
            ByronBS
            <span className="absolute -bottom-1 left-0 h-1 w-full rounded-full bg-signal/70" />
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.16, ease: "easeOut" }}
          className="mt-7 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
        >
          O ponto de encontro dos fãs e seguidores do ByronBS. Tudo o que aparece aqui é publicado
          diretamente por ele — novidades, conteúdos e a energia de uma comunidade gamer ativa.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.24, ease: "easeOut" }}
          className="mt-10 flex flex-wrap items-center gap-3"
        >
          <Link
            to={fanHomeHref}
            className="group inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-br from-[#166a4a] via-brand to-[#0f4d37] px-7 text-sm font-bold text-white shadow-[0_14px_34px_-16px_rgba(18,61,44,0.9)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-14px_rgba(18,61,44,0.95)]"
          >
            ⭐ ME TORNAR FÃ
            <ArrowUpRight className="h-4 w-4 text-signal transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
          <a
            href="#redes"
            className="group inline-flex h-12 items-center gap-2 rounded-xl bg-foreground px-7 text-sm font-semibold text-background transition-colors duration-300 hover:bg-brand"
          >
            Ver redes sociais
            <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
          <a
            href="#comunidade"
            className="inline-flex h-12 items-center rounded-xl border border-border px-7 text-sm font-semibold text-foreground transition-colors duration-300 hover:border-brand hover:text-brand"
          >
            Conhecer a comunidade
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-20 flex items-center gap-4 border-t border-border pt-6 text-xs uppercase tracking-[0.2em] text-muted-foreground"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-signal" />
          Fãs · Seguidores · Comunidade gamer
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Comunidade — indispensable section of the home screen               */
/* ------------------------------------------------------------------ */

const PILLARS = [
  {
    title: "Tudo oficial",
    body: "Cada novidade e publicação vem direto do ByronBS, sem ruído e sem intermediários.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5" aria-hidden>
        <path d="M12 3l7 3v5c0 4.4-3 8.3-7 9.5-4-1.2-7-5.1-7-9.5V6l7-3Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
  {
    title: "Feita para os fãs",
    body: "Um espaço pensado para quem acompanha o ByronBS de perto e quer participar.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5" aria-hidden>
        <path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20" />
        <circle cx="9.5" cy="7.5" r="3.5" />
        <path d="M17 11a3.5 3.5 0 1 0-2.6-5.9M21 20v-1.5a4 4 0 0 0-3-3.8" />
      </svg>
    ),
  },
  {
    title: "Energia gamer",
    body: "Organizada, moderna e acolhedora — do jeito que uma comunidade gamer deveria ser.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5" aria-hidden>
        <path d="M7 12h4M9 10v4" />
        <path d="M15 11.5h.01M17.5 13.5h.01" />
        <rect x="2.5" y="6.5" width="19" height="11" rx="5.5" />
      </svg>
    ),
  },
];

function Community() {
  return (
    <section id="comunidade" className="border-t border-border">
      <div className="mx-auto max-w-5xl px-6 py-24">
        <Reveal>
          <SectionLabel index="01">Comunidade</SectionLabel>
        </Reveal>

        <div className="grid gap-8 md:grid-cols-12 md:items-end">
          <Reveal className="md:col-span-7">
            <h2 className="text-3xl font-bold leading-tight tracking-tight text-balance sm:text-4xl">
              A casa de quem acompanha o ByronBS
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="md:col-span-5">
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
              A Comunidade ByronBS reúne fãs e seguidores em um só lugar. Aqui você fica por dentro
              do que importa, com conteúdo publicado apenas pelo próprio ByronBS.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          {PILLARS.map((pillar, i) => (
            <Reveal key={pillar.title} delay={i * 0.08}>
              <article className="group h-full rounded-2xl border border-border bg-card/60 p-6 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-brand/50 hover:shadow-[0_18px_40px_-28px_rgba(18,61,44,0.55)]">
                <span className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-background text-brand transition-colors duration-300 group-hover:border-brand/50">
                  {pillar.icon}
                </span>
                <h3 className="mt-5 text-base font-semibold tracking-tight">{pillar.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{pillar.body}</p>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1}>
          <blockquote className="mt-14 border-l-2 border-signal/80 pl-6 text-lg font-medium leading-relaxed tracking-tight text-foreground/90 sm:text-xl">
            “Este é o lugar oficial da comunidade. Se é sobre o ByronBS, começa aqui.”
          </blockquote>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Redes sociais — second pillar of v1                                 */
/* ------------------------------------------------------------------ */

function Socials() {
  return (
    <section id="redes" className="border-t border-border">
      <div className="mx-auto max-w-5xl px-6 py-24">
        <Reveal>
          <SectionLabel index="02">Minhas redes sociais</SectionLabel>
        </Reveal>

        <div className="grid gap-8 md:grid-cols-12 md:items-end">
          <Reveal className="md:col-span-7">
            <h2 className="text-3xl font-bold leading-tight tracking-tight text-balance sm:text-4xl">
              Minhas Redes Sociais
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="md:col-span-5">
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
              Toque em um botão para abrir direto o perfil oficial do ByronBS na plataforma.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          {SOCIAL_LINKS.map((social, i) => (
            <Reveal key={social.name} delay={i * 0.08}>
              <motion.a
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ y: -6 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 320, damping: 22 }}
                className="group flex h-full flex-col items-start gap-5 rounded-2xl border border-border bg-card/60 p-6 backdrop-blur transition-colors duration-300 hover:border-brand/60 hover:bg-card hover:shadow-[0_22px_48px_-30px_rgba(18,61,44,0.6)]"
              >
                <span className="flex w-full items-center justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl border border-border bg-background text-foreground transition-colors duration-300 group-hover:border-brand group-hover:bg-brand group-hover:text-signal">
                    {social.icon}
                  </span>
                  <ArrowUpRight className="h-5 w-5 text-muted-foreground transition-all duration-300 group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-brand" />
                </span>
                <span className="w-full">
                  <span className="block text-base font-semibold tracking-tight">{social.name}</span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {social.handle}
                  </span>
                  <span className="mt-4 block h-0.5 w-10 rounded-full bg-signal transition-all duration-300 group-hover:w-full" />
                </span>
              </motion.a>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1}>
          <p className="mt-10 text-xs leading-relaxed text-muted-foreground">
            Desconfiou de um perfil que se diz oficial? Confira sempre pelos links desta página.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Footer                                                              */
/* ------------------------------------------------------------------ */

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <img src={logo} alt="" width={28} height={28} className="rounded-lg" />
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-tight">ByronBS</p>
            <p className="text-xs text-muted-foreground">Comunidade oficial de fãs</p>
          </div>
        </div>

        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground" aria-label="Rodapé">
          {NAV_ITEMS.filter((item) => !item.soon).map((item) => (
            <a key={item.label} href={item.href} className="transition-colors hover:text-foreground">
              {item.label}
            </a>
          ))}
        </nav>

        <p className="text-xs text-muted-foreground">© 2026 Comunidade ByronBS</p>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */

export default function Landing() {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.45 }}
        className="min-h-screen bg-background"
      >
        <Header />
        <main>
          <Hero />
          <Community />
          <Socials />
        </main>
        <Footer />
      </motion.div>
    </MotionConfig>
  );
}
