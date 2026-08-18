import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { GameCanvas } from "@/components/GameCanvas";
import { CHARACTER_LIST, type CharacterId } from "@/lib/game/characters";

export const Route = createFileRoute("/practice")({
  head: () => ({
    meta: [
      { title: "Practice Arena — Clash Arena Training" },
      {
        name: "description",
        content:
          "Train offline in the practice arena: test both fighters, their moves and specials against a training dummy, no opponent needed.",
      },
      { property: "og:title", content: "Practice Arena — Clash Arena Training" },
      {
        property: "og:description",
        content: "Solo training mode to learn every character's attacks and specials.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Practice,
});

function Practice() {
  const [character, setCharacter] = useState<CharacterId>("blaze");
  const dummy: CharacterId = character === "blaze" ? "frost" : "blaze";

  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-primary">Offline training</p>
            <h1 className="font-display text-4xl tracking-wide text-foreground">Practice Arena</h1>
          </div>
          <Link
            to="/"
            className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            Back to menu
          </Link>
        </div>

        <div className="mb-6 flex flex-wrap gap-3">
          {CHARACTER_LIST.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCharacter(c.id)}
              className={`rounded-lg border px-4 py-2 font-display text-lg tracking-wide transition-all ${
                c.id === character
                  ? "border-primary bg-card text-foreground shadow-arena"
                  : "border-border bg-card/50 text-muted-foreground hover:border-primary/50"
              }`}
            >
              {c.name}
              <span className="ml-2 text-xs uppercase tracking-widest text-primary">
                {c.special.name}
              </span>
            </button>
          ))}
        </div>

        <GameCanvas
          key={character}
          code="practice"
          role="solo"
          hostChar={character}
          guestChar={dummy}
        />

        <p className="mt-4 text-center text-sm text-muted-foreground">
          The second fighter is a training dummy that never moves. Press R to reset the arena.
        </p>
      </div>
    </main>
  );
}
