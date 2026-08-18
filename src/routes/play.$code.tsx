import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { GameCanvas } from "@/components/GameCanvas";
import type { CharacterId } from "@/lib/game/characters";

type Role = "host" | "guest";

export const Route = createFileRoute("/play/$code")({
  validateSearch: (search: Record<string, unknown>): { role: Role } => ({
    role: search["role"] === "guest" ? "guest" : "host",
  }),
  head: () => ({
    meta: [
      { title: "Match — Clash Arena" },
      { name: "description", content: "Fight your friend in the Clash Arena match lobby." },
      { property: "og:title", content: "Match — Clash Arena" },
      { property: "og:description", content: "Join the arena with a match code and fight." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlayPage,
});

function PlayPage() {
  const { code } = Route.useParams();
  const { role } = Route.useSearch();
  const [hostChar, setHostChar] = useState<CharacterId | null>(null);
  const [guestChar, setGuestChar] = useState<CharacterId | null>(null);
  const [missing, setMissing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data } = await supabase
        .from("matches")
        .select("host_character, guest_character")
        .eq("code", code)
        .maybeSingle();
      if (cancelled) return;
      if (!data) {
        setMissing(true);
        return;
      }
      setHostChar(data.host_character as CharacterId);
      setGuestChar((data.guest_character as CharacterId | null) ?? null);
    }

    void load();
    const poll = window.setInterval(() => void load(), 1500);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, [code]);

  const ready = hostChar !== null && guestChar !== null;

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link to="/" className="text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-foreground">
            ← Leave match
          </Link>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(code);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }}
            className="rounded-md border border-border px-4 py-2 font-display text-lg tracking-[0.4em] text-primary"
          >
            {copied ? "COPIED" : code}
          </button>
        </div>

        {missing && (
          <p className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground">
            No match exists with the code {code}.
          </p>
        )}

        {!missing && !ready && (
          <div className="rounded-xl border border-border bg-card p-14 text-center">
            <p className="font-display text-3xl tracking-wide text-foreground">Waiting for opponent…</p>
            <p className="mt-3 text-sm text-muted-foreground">
              Share the code <span className="text-primary">{code}</span> so they can join.
            </p>
          </div>
        )}

        {ready && <GameCanvas code={code} role={role} hostChar={hostChar} guestChar={guestChar} />}
      </div>
    </main>
  );
}
