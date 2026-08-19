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

type Role = "host" | "guest";

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

function drawHuman(
  ctx: CanvasRenderingContext2D,
  p: GameState["players"][number],
  tick: number,
) {
  const c = CHARACTERS[p.character];
  const look = c.look;
  const h = PLAYER_H * look.height;
  const w = PLAYER_W * look.build;
  const baseX = p.x + PLAYER_W / 2;
  const baseY = p.y + PLAYER_H; // feet
  const headR = w * 0.28;
  const torsoH = h * 0.36;
  const legH = h * 0.34;
  const neckY = baseY - legH - torsoH;
  const jiggle = p.auraTimer > 0 ? Math.sin(tick * 0.6) * 3 : 0;

  const walk = Math.abs(p.vx) > 0.4 ? Math.sin(tick * 0.35) : 0;

  // legs
  ctx.strokeStyle = look.pants;
  ctx.lineWidth = w * 0.24;
  ctx.lineCap = "round";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(baseX + jiggle * 0.4, baseY - legH);
    ctx.lineTo(baseX + side * (w * 0.18) + walk * side * 6 + jiggle * 0.4, baseY);
    ctx.stroke();
  }

  // torso
  ctx.fillStyle = look.shirt;
  ctx.beginPath();
  ctx.roundRect(
    baseX - w * 0.3 + jiggle,
    neckY,
    w * 0.6,
    torsoH,
    w * 0.18,
  );
  ctx.fill();

  // arms
  ctx.strokeStyle = look.skin;
  ctx.lineWidth = w * 0.18;
  const punching = p.attackTimer > 0;
  for (const side of [-1, 1]) {
    const shoulderX = baseX + side * w * 0.3 + jiggle;
    const shoulderY = neckY + torsoH * 0.18;
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    if (punching && side === p.facing) {
      ctx.lineTo(shoulderX + p.facing * c.melee.range * 0.55, shoulderY + 2);
    } else {
      ctx.lineTo(shoulderX + side * w * 0.16 - walk * side * 5, shoulderY + torsoH * 0.75);
    }
    ctx.stroke();
  }

  // head + hair
  const headY = neckY - headR - 2;
  ctx.fillStyle = look.skin;
  ctx.beginPath();
  ctx.arc(baseX + jiggle, headY, headR, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = look.hair;
  ctx.beginPath();
  ctx.arc(baseX + jiggle, headY - headR * 0.18, headR, Math.PI, Math.PI * 2);
  ctx.fill();

  // eye
  ctx.fillStyle = "#1a1a22";
  ctx.beginPath();
  ctx.arc(baseX + jiggle + p.facing * headR * 0.4, headY + headR * 0.1, 1.8, 0, Math.PI * 2);
  ctx.fill();
}

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

  // poison auras (behind fighters)
  state.players.forEach((p) => {
    if (p.auraTimer <= 0) return;
    const c = CHARACTERS[p.character];
    const cx = p.x + PLAYER_W / 2;
    const cy = p.y + PLAYER_H / 2;
    const r = c.special.radius * (0.9 + Math.sin(state.tick * 0.2) * 0.06);
    const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, r);
    g.addColorStop(0, "rgba(140,240,120,0.35)");
    g.addColorStop(1, "rgba(80,200,90,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  });

  for (const pr of state.projectiles) {
    ctx.fillStyle = "#ffd06b";
    ctx.beginPath();
    ctx.arc(pr.x + 8, pr.y + 8, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  state.players.forEach((p) => {
    ctx.globalAlpha = p.hurtTimer > 0 && p.hurtTimer % 6 < 3 ? 0.45 : 1;
    if (p.dashTimer > 0) {
      ctx.globalAlpha *= 0.5;
      ctx.save();
      ctx.translate(-p.facing * 16, 0);
      drawHuman(ctx, p, state.tick);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    drawHuman(ctx, p, state.tick);
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

  const you = role === "host" ? 0 : 1;
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
        Move A/D · Jump W · Attack J · Special K
      </p>
    </div>
  );
}
