import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { CHARACTER_LIST, type CharacterId } from "@/lib/game/characters";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Clash Arena — Online Platform Fighter" },
      {
        name: "description",
        content:
          "Pick a fighter, create a match code and battle a friend online in a fast 2-player platform fighting game.",
      },
      { property: "og:title", content: "Clash Arena — Online Platform Fighter" },
      {
        property: "og:description",
        content: "Create a game code, share it, and fight your friend in the arena.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function Home() {
  const navigate = useNavigate();
  const [character, setCharacter] = useState<CharacterId>("jiggly");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createGame() {
    setBusy(true);
    setError(null);
    const code = makeCode();
    const { error: err } = await supabase
      .from("matches")
      .insert({ code, host_character: character, status: "waiting" });
    setBusy(false);
    if (err) {
      setError("Could not create the game. Try again.");
      return;
    }
    void navigate({ to: "/play/$code", params: { code }, search: { role: "host" } });
  }

  async function joinGame() {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) {
      setError("Enter the 5-character game code.");
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("matches")
      .select("id, status")
      .eq("code", code)
      .maybeSingle();
    if (err || !data) {
      setBusy(false);
      setError("No game found with that code.");
      return;
    }
    await supabase
      .from("matches")
      .update({ guest_character: character, status: "playing" })
      .eq("id", data.id);
    setBusy(false);
    void navigate({ to: "/play/$code", params: { code }, search: { role: "guest" } });
  }

  return (
    <main className="min-h-screen bg-background px-6 py-14">
      <div className="mx-auto max-w-4xl">
        <header className="text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-primary">2-player online brawler</p>
          <h1 className="mt-3 font-display text-6xl tracking-wide text-foreground sm:text-7xl">
            Clash Arena
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
            Choose your fighter, create a match code and send it to a friend. First to knock the other
            out wins.
          </p>
        </header>

        <section className="mt-12">
          <h2 className="mb-4 font-display text-2xl tracking-wide text-foreground">Choose fighter</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {CHARACTER_LIST.map((c) => {
              const active = c.id === character;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCharacter(c.id)}
                  className={`rounded-xl border p-5 text-left transition-all ${
                    active
                      ? "border-primary bg-card shadow-arena"
                      : "border-border bg-card/50 hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="h-10 w-8 rounded-sm"
                      style={{ background: c.color, boxShadow: `0 0 24px ${c.color}66` }}
                    />
                    <span className="font-display text-2xl tracking-wide text-foreground">{c.name}</span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{c.tagline}</p>
                  <p className="mt-3 text-xs uppercase tracking-widest text-primary">
                    Special · {c.special.name}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-display text-2xl tracking-wide text-foreground">Create a game</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We generate a code you can share with your opponent.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void createGame()}
              className="mt-5 w-full rounded-md bg-primary px-4 py-3 font-display text-lg tracking-wider text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Create match
            </button>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-display text-2xl tracking-wide text-foreground">Join a game</h2>
            <p className="mt-2 text-sm text-muted-foreground">Type the code you were given.</p>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={5}
              placeholder="ABC12"
              className="mt-5 w-full rounded-md border border-input bg-background px-4 py-3 text-center font-display text-2xl tracking-[0.4em] text-foreground outline-none focus:border-primary"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void joinGame()}
              className="mt-3 w-full rounded-md border border-primary px-4 py-3 font-display text-lg tracking-wider text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
            >
              Join match
            </button>
          </div>
        </section>

        {error && <p className="mt-6 text-center text-sm text-destructive">{error}</p>}
      </div>
    </main>
  );
}
