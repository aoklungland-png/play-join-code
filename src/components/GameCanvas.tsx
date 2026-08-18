import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CHARACTERS, type CharacterId } from "@/lib/game/characters";
import {
  EMPTY_INPUT,
  PLATFORMS,
  PLAYER_H,
  PLAYER_W,
  WORLD,
  createGame,
  step,
  type GameState,
  type Input,
} from "@/lib/game/engine";

type Role = "host" | "guest" | "solo";

const KEYS: Record<string, keyof Input> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  KeyA: "left",
  KeyD: "right",
  KeyW: "up",
  Space: "up",
  KeyJ: "attack",
  KeyK: "special",
  ShiftLeft: "special",
};

function draw(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.clearRect(0, 0, WORLD.width, WORLD.height);

  const sky = ctx.createLinearGradient(0, 0, 0, WORLD.height);
  sky.addColorStop(0, "#141826");
  sky.addColorStop(1, "#241c22");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  ctx.fillStyle = "rgba(255,255,255,0.06)";
  for (const p of PLATFORMS) ctx.fillRect(p.x, p.y, p.w, p.h);
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  for (const p of PLATFORMS) ctx.fillRect(p.x, p.y, p.w, 3);

  for (const pr of state.projectiles) {
    ctx.fillStyle = "#9be7ff";
    ctx.fillRect(pr.x, pr.y, 14, 10);
  }

  state.players.forEach((p) => {
    const c = CHARACTERS[p.character];
    ctx.globalAlpha = p.hurtTimer > 0 && p.hurtTimer % 6 < 3 ? 0.45 : 1;
    ctx.fillStyle = c.color;
    ctx.fillRect(p.x, p.y, PLAYER_W, PLAYER_H);
    ctx.fillStyle = c.accent;
    ctx.fillRect(p.x + (p.facing === 1 ? PLAYER_W - 10 : 2), p.y + 10, 8, 8);
    if (p.attackTimer > 0) {
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      const hx = p.facing === 1 ? p.x + PLAYER_W : p.x - c.melee.range;
      ctx.fillRect(hx, p.y + 14, c.melee.range, 16);
    }
    ctx.globalAlpha = 1;
  });
}

export function GameCanvas({
  code,
  role,
  hostChar,
  guestChar,
}: {
  code: string;
  role: Role;
  hostChar: CharacterId;
  guestChar: CharacterId;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<Input>({ ...EMPTY_INPUT });
  const remoteInputRef = useRef<Input>({ ...EMPTY_INPUT });
  const stateRef = useRef<GameState>(createGame(hostChar, guestChar));
  const [hud, setHud] = useState({ hp0: 100, hp1: 100, winner: null as 0 | 1 | null });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = KEYS[e.code];
      if (!k) return;
      e.preventDefault();
      inputRef.current[k] = true;
    };
    const up = (e: KeyboardEvent) => {
      const k = KEYS[e.code];
      if (!k) return;
      inputRef.current[k] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    stateRef.current = createGame(hostChar, guestChar);
    const solo = role === "solo";

    if (solo) {
      const reset = (e: KeyboardEvent) => {
        if (e.code === "KeyR") stateRef.current = createGame(hostChar, guestChar);
      };
      window.addEventListener("keydown", reset);
      let raf = 0;
      let last = performance.now();
      let acc = 0;
      const ctx = canvasRef.current?.getContext("2d") ?? null;
      const loop = (now: number) => {
        acc += Math.min(now - last, 100);
        last = now;
        while (acc >= 1000 / 60) {
          acc -= 1000 / 60;
          step(stateRef.current, [inputRef.current, { ...EMPTY_INPUT }]);
        }
        const s = stateRef.current;
        if (ctx) draw(ctx, s);
        setHud((prev) =>
          prev.hp0 === s.players[0].hp && prev.hp1 === s.players[1].hp && prev.winner === s.winner
            ? prev
            : { hp0: s.players[0].hp, hp1: s.players[1].hp, winner: s.winner },
        );
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      return () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("keydown", reset);
      };
    }

    const channel = supabase.channel(`match-${code}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "input" }, ({ payload }) => {
        remoteInputRef.current = payload as Input;
      })
      .on("broadcast", { event: "state" }, ({ payload }) => {
        stateRef.current = payload as GameState;
      })
      .subscribe();

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let lastSent = "";
    const ctx = canvasRef.current?.getContext("2d") ?? null;

    const loop = (now: number) => {
      acc += Math.min(now - last, 100);
      last = now;

      while (acc >= 1000 / 60) {
        acc -= 1000 / 60;
        if (role === "host") {
          const s = stateRef.current;
          step(s, [inputRef.current, remoteInputRef.current]);
          if (s.tick % 2 === 0) {
            void channel.send({ type: "broadcast", event: "state", payload: s });
          }
        } else {
          const serialized = JSON.stringify(inputRef.current);
          if (serialized !== lastSent) {
            lastSent = serialized;
            void channel.send({
              type: "broadcast",
              event: "input",
              payload: inputRef.current,
            });
          }
        }
      }

      const s = stateRef.current;
      if (ctx) draw(ctx, s);
      setHud((prev) =>
        prev.hp0 === s.players[0].hp && prev.hp1 === s.players[1].hp && prev.winner === s.winner
          ? prev
          : { hp0: s.players[0].hp, hp1: s.players[1].hp, winner: s.winner },
      );
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      supabase.removeChannel(channel);
    };
  }, [code, role, hostChar, guestChar]);

  const you = role === "guest" ? 1 : 0;
  const chars: CharacterId[] = [hostChar, guestChar];

  return (
    <div className="w-full">
      <div className="mb-3 flex items-end justify-between gap-4">
        {[0, 1].map((i) => {
          const c = CHARACTERS[chars[i]!];
          const hp = i === 0 ? hud.hp0 : hud.hp1;
          return (
            <div key={i} className={i === 1 ? "flex-1 text-right" : "flex-1"}>
              <p className="font-display text-lg tracking-wide text-foreground">
                {c.name} {you === i && <span className="text-primary">(you)</span>}
              </p>
              <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-[width] duration-150"
                  style={{
                    width: `${(hp / c.maxHp) * 100}%`,
                    background: c.color,
                    marginLeft: i === 1 ? "auto" : undefined,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-arena">
        <canvas
          ref={canvasRef}
          width={WORLD.width}
          height={WORLD.height}
          className="block w-full"
        />
        {hud.winner !== null && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80">
            <p className="font-display text-5xl tracking-wider text-primary">
              {hud.winner === you ? "VICTORY" : "DEFEATED"}
            </p>
            <p className="text-sm text-muted-foreground">
              {CHARACTERS[chars[hud.winner]!].name} wins the match
            </p>
          </div>
        )}
      </div>

      <p className="mt-3 text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Move A/D · Jump W · Attack J · Special K{role === "solo" ? " · Reset R" : ""}
      </p>
    </div>
  );
}
