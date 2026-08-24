import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CHARACTERS, type CharacterId } from "@/lib/game/characters";
import {
  DEATH_DURATION,
  EMPTY_INPUT,
  PLATFORMS,
  PLAYER_H,
  PLAYER_W,
  WORLD,
  createGame,
  platformX,
  step,
  type GameState,
  type Input,
  type PlayerState,
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

/* ------------------------------------------------------------------ */
/* Particles (purely visual, never networked)                          */
/* ------------------------------------------------------------------ */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
}

const MAX_PARTICLES = 260;

function spawn(list: Particle[], p: Particle) {
  if (list.length >= MAX_PARTICLES) list.shift();
  list.push(p);
}

function burst(
  list: Particle[],
  x: number,
  y: number,
  count: number,
  color: string,
  power = 4,
  gravity = 0.12,
) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = power * (0.35 + Math.random() * 0.9);
    spawn(list, {
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - power * 0.3,
      life: 26 + Math.random() * 22,
      maxLife: 48,
      size: 1.5 + Math.random() * 2.6,
      color,
      gravity,
    });
  }
}

function stepParticles(list: Particle[]) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i]!;
    p.x += p.vx;
    p.y += p.vy;
    p.vy += p.gravity;
    p.vx *= 0.985;
    p.life--;
    if (p.life <= 0) list.splice(i, 1);
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, list: Particle[]) {
  for (const p of list) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.maxLife));
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------------ */
/* Background (pre-rendered once)                                      */
/* ------------------------------------------------------------------ */

function ridge(
  ctx: CanvasRenderingContext2D,
  baseY: number,
  height: number,
  color: string,
  seed: number,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, baseY);
  let x = 0;
  let up = true;
  let n = seed;
  const rnd = () => {
    n = (n * 9301 + 49297) % 233280;
    return n / 233280;
  };
  while (x < WORLD.width) {
    const w = 90 + rnd() * 160;
    const peak = baseY - (up ? height * (0.5 + rnd() * 0.5) : height * 0.2);
    ctx.lineTo(x + w / 2, peak);
    ctx.lineTo(x + w, baseY - height * 0.12);
    x += w;
    up = !up;
  }
  ctx.lineTo(WORLD.width, baseY);
  ctx.closePath();
  ctx.fill();
}

function stonePlatform(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, "#4b3f5e");
  g.addColorStop(1, "#231c30");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 6);
  ctx.fill();

  // mossy top
  const top = ctx.createLinearGradient(0, y - 2, 0, y + 7);
  top.addColorStop(0, "#8ce88a");
  top.addColorStop(1, "#3c9b58");
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.roundRect(x, y - 2, w, 7, 4);
  ctx.fill();

  // glow rim
  ctx.strokeStyle = "rgba(180,255,220,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 2, y - 2.5);
  ctx.lineTo(x + w - 2, y - 2.5);
  ctx.stroke();

  // cracks
  ctx.strokeStyle = "rgba(0,0,0,0.28)";
  for (let i = 0; i < Math.floor(w / 60); i++) {
    const cx = x + 20 + i * 60;
    ctx.beginPath();
    ctx.moveTo(cx, y + 6);
    ctx.lineTo(cx + 5, y + h - 3);
    ctx.stroke();
  }
}

function buildBackground(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = WORLD.width;
  c.height = WORLD.height;
  const ctx = c.getContext("2d")!;

  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, WORLD.height);
  sky.addColorStop(0, "#2a1250");
  sky.addColorStop(0.45, "#6d2b6b");
  sky.addColorStop(0.72, "#d4574a");
  sky.addColorStop(1, "#f4a martial".slice(0, 7));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  // stars
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  for (let i = 0; i < 90; i++) {
    const x = (i * 137.5) % WORLD.width;
    const y = (i * 71.3) % 280;
    ctx.globalAlpha = 0.2 + ((i * 37) % 60) / 100;
    ctx.fillRect(x, y, 1.6, 1.6);
  }
  ctx.globalAlpha = 1;

  // sun disc + halo
  const sunX = WORLD.width * 0.5;
  const sunY = 330;
  const halo = ctx.createRadialGradient(sunX, sunY, 30, sunX, sunY, 300);
  halo.addColorStop(0, "rgba(255,214,140,0.55)");
  halo.addColorStop(1, "rgba(255,150,90,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  const sun = ctx.createLinearGradient(0, sunY - 120, 0, sunY + 120);
  sun.addColorStop(0, "#fff3c4");
  sun.addColorStop(1, "#ff9a4d");
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 110, 0, Math.PI * 2);
  ctx.fill();

  // clouds
  const cloud = (x: number, y: number, s: number, alpha: number) => {
    ctx.fillStyle = `rgba(255,205,225,${alpha})`;
    for (const [dx, dy, r] of [
      [0, 0, 34],
      [30, 6, 26],
      [-32, 8, 24],
      [12, -14, 24],
    ] as const) {
      ctx.beginPath();
      ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  cloud(180, 130, 1.1, 0.22);
  cloud(1000, 100, 0.9, 0.18);
  cloud(640, 80, 0.7, 0.14);

  // mountain ridges (far to near)
  ridge(ctx, 470, 190, "#4a2a5c", 17);
  ridge(ctx, 520, 150, "#361f47", 91);

  // ruined towers
  ctx.fillStyle = "#241635";
  for (const [x, w, h] of [
    [120, 46, 210],
    [176, 26, 140],
    [980, 40, 190],
    [1035, 24, 120],
  ] as const) {
    ctx.fillRect(x, 560 - h, w, h);
    ctx.fillStyle = "rgba(255,190,120,0.5)";
    for (let i = 0; i < 3; i++) ctx.fillRect(x + 10, 560 - h + 24 + i * 40, 9, 13);
    ctx.fillStyle = "#241635";
  }

  // haze band
  const haze = ctx.createLinearGradient(0, 430, 0, 600);
  haze.addColorStop(0, "rgba(255,150,120,0)");
  haze.addColorStop(1, "rgba(60,20,60,0.65)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, 430, WORLD.width, 200);

  // static platforms (solid, non-moving)
  for (const p of PLATFORMS) {
    if (p.move || p.kind !== "solid") continue;
    stonePlatform(ctx, p.x, p.y, p.w, p.h);
  }

  // vignette
  const vig = ctx.createRadialGradient(
    WORLD.width / 2,
    WORLD.height / 2,
    WORLD.height * 0.35,
    WORLD.width / 2,
    WORLD.height / 2,
    WORLD.height,
  );
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  return c;
}

/* ------------------------------------------------------------------ */
/* Fighter rendering                                                   */
/* ------------------------------------------------------------------ */

function limb(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  color: string,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((n >> 16) & 255) + amount);
  const g = clamp(((n >> 8) & 255) + amount);
  const b = clamp((n & 255) + amount);
  return `rgb(${r},${g},${b})`;
}

function drawFighter(ctx: CanvasRenderingContext2D, p: PlayerState, tick: number) {
  const c = CHARACTERS[p.character];
  const look = c.look;
  const dying = p.deathTimer > 0;
  const deathT = Math.min(1, p.deathTimer / DEATH_DURATION);

  const h = PLAYER_H * look.height;
  const w = PLAYER_W * look.build;
  const baseX = p.x + PLAYER_W / 2;
  const baseY = p.y + PLAYER_H;

  // ground shadow
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(baseX, baseY + 2, w * 0.42, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.save();
  if (dying) {
    ctx.globalAlpha = Math.max(0, 1 - deathT * 1.1);
    ctx.translate(baseX, baseY);
    ctx.rotate(p.facing * -1.4 * Math.min(1, deathT * 2.2));
    ctx.translate(-baseX, -baseY);
  }

  const breathe = Math.sin(tick * 0.08) * 0.8;
  const walkPhase = Math.abs(p.vx) > 0.4 ? Math.sin(tick * 0.34) : 0;
  const airborne = !p.onGround;
  const punch = p.attackTimer > 0;
  const cough = p.coughTimer > 0;
  const hurt = p.hurtTimer > 0;
  const lean = (p.dashTimer > 0 ? 6 : 0) + (hurt ? -p.facing * 3 : 0);

  const legH = h * 0.34;
  const torsoH = h * 0.36;
  const hipY = baseY - legH;
  const neckY = hipY - torsoH + breathe;
  const headR = w * 0.29;
  const headY = neckY - headR - 3 + (cough ? 3 : 0);
  const tilt = lean + (cough ? p.facing * 4 : 0);

  // legs (hip -> knee -> foot)
  const legColor = look.pants;
  for (const side of [-1, 1] as const) {
    const sw = walkPhase * side;
    const hipX = baseX + side * w * 0.14 + tilt * 0.4;
    const kneeX = hipX + sw * 7 + (airborne ? p.facing * 5 : 0);
    const kneeY = hipY + legH * 0.5 - (airborne ? legH * 0.18 : 0);
    const footX = hipX + sw * 13 + (airborne ? p.facing * 8 : 0);
    const footY = airborne ? baseY - legH * 0.15 : baseY;
    limb(ctx, hipX, hipY, kneeX, kneeY, footX, footY, w * 0.2, legColor);
    // shoe
    ctx.fillStyle = "#1b1b24";
    ctx.beginPath();
    ctx.roundRect(footX - w * 0.16 + p.facing * w * 0.06, footY - 3.5, w * 0.3, 5.5, 2.5);
    ctx.fill();
  }

  // torso with collar + belt
  const shirtTop = shade(look.shirt, 26);
  const g = ctx.createLinearGradient(0, neckY, 0, hipY);
  g.addColorStop(0, shirtTop);
  g.addColorStop(1, shade(look.shirt, -34));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(baseX - w * 0.31 + tilt, neckY, w * 0.62, torsoH + 4, w * 0.2);
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(baseX - w * 0.31 + tilt, hipY - 5, w * 0.62, 5);
  ctx.fillStyle = c.accent;
  ctx.fillRect(baseX - w * 0.09 + tilt, hipY - 5, w * 0.18, 5);

  // arms (shoulder -> elbow -> hand)
  const skin = look.skin;
  for (const side of [-1, 1] as const) {
    const shoulderX = baseX + side * w * 0.3 + tilt;
    const shoulderY = neckY + torsoH * 0.16;
    const front = side === p.facing;
    let elbowX: number;
    let elbowY: number;
    let handX: number;
    let handY: number;
    if (punch && front) {
      const t = p.attackTimer / 10;
      const reach = c.melee.range * (0.35 + (1 - t) * 0.4);
      elbowX = shoulderX + p.facing * reach * 0.5;
      elbowY = shoulderY + 1;
      handX = shoulderX + p.facing * reach;
      handY = shoulderY;
    } else if (cough) {
      elbowX = shoulderX + p.facing * w * 0.18;
      elbowY = shoulderY + torsoH * 0.35;
      handX = baseX + p.facing * w * 0.3 + tilt;
      handY = headY + headR * 0.5;
    } else if (airborne) {
      elbowX = shoulderX + side * w * 0.22;
      elbowY = shoulderY + torsoH * 0.2;
      handX = shoulderX + side * w * 0.3;
      handY = shoulderY - torsoH * 0.35;
    } else {
      const sw = -walkPhase * side;
      elbowX = shoulderX + side * w * 0.16 + sw * 4;
      elbowY = shoulderY + torsoH * 0.42;
      handX = shoulderX + side * w * 0.12 + sw * 9;
      handY = shoulderY + torsoH * 0.82;
    }
    limb(ctx, shoulderX, shoulderY, elbowX, elbowY, handX, handY, w * 0.16, skin);
    // sleeve
    ctx.strokeStyle = shade(look.shirt, -10);
    ctx.lineWidth = w * 0.18;
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(shoulderX + (elbowX - shoulderX) * 0.5, shoulderY + (elbowY - shoulderY) * 0.5);
    ctx.stroke();
    // hand
    ctx.fillStyle = shade(skin, -12);
    ctx.beginPath();
    ctx.arc(handX, handY, w * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  // neck + head
  ctx.strokeStyle = shade(skin, -20);
  ctx.lineWidth = w * 0.16;
  ctx.beginPath();
  ctx.moveTo(baseX + tilt, neckY + 2);
  ctx.lineTo(baseX + tilt * 1.1, headY + headR * 0.6);
  ctx.stroke();

  const hx = baseX + tilt * 1.1;
  const headGrad = ctx.createRadialGradient(
    hx - headR * 0.3,
    headY - headR * 0.3,
    headR * 0.2,
    hx,
    headY,
    headR,
  );
  headGrad.addColorStop(0, shade(skin, 22));
  headGrad.addColorStop(1, shade(skin, -18));
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.ellipse(hx, headY, headR * 0.92, headR, 0, 0, Math.PI * 2);
  ctx.fill();

  // ear
  ctx.fillStyle = shade(skin, -22);
  ctx.beginPath();
  ctx.arc(hx - p.facing * headR * 0.85, headY + 1, headR * 0.2, 0, Math.PI * 2);
  ctx.fill();

  // hair
  ctx.fillStyle = look.hair;
  ctx.beginPath();
  ctx.ellipse(hx, headY - headR * 0.28, headR * 1.02, headR * 0.85, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(
    hx - p.facing * headR * 0.55,
    headY - headR * 0.05,
    headR * 0.34,
    headR * 0.55,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  if (look.height > 1.1) {
    // tall ginger mop tuft
    ctx.beginPath();
    ctx.ellipse(hx + p.facing * headR * 0.2, headY - headR * 0.95, headR * 0.45, headR * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // face
  const eyeX = hx + p.facing * headR * 0.34;
  const eyeY = headY + headR * 0.02;
  ctx.fillStyle = "#fdfdff";
  ctx.beginPath();
  ctx.ellipse(eyeX, eyeY, headR * 0.19, headR * (hurt ? 0.09 : 0.16), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a1a22";
  ctx.beginPath();
  ctx.arc(eyeX + p.facing * headR * 0.05, eyeY, headR * 0.09, 0, Math.PI * 2);
  ctx.fill();
  // brow
  ctx.strokeStyle = look.hair;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(eyeX - headR * 0.2, eyeY - headR * (hurt ? 0.2 : 0.3));
  ctx.lineTo(eyeX + headR * 0.24, eyeY - headR * (hurt ? 0.34 : 0.26));
  ctx.stroke();
  // mouth
  ctx.strokeStyle = "rgba(70,30,35,0.8)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  if (cough || hurt) {
    ctx.ellipse(hx + p.facing * headR * 0.3, headY + headR * 0.45, headR * 0.18, headR * 0.2, 0, 0, Math.PI * 2);
  } else {
    ctx.moveTo(hx + p.facing * headR * 0.12, headY + headR * 0.45);
    ctx.lineTo(hx + p.facing * headR * 0.48, headY + headR * 0.42);
  }
  ctx.stroke();

  ctx.restore();
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------------ */
/* Frame render                                                        */
/* ------------------------------------------------------------------ */

function drawDynamicPlatforms(ctx: CanvasRenderingContext2D, tick: number) {
  for (const plat of PLATFORMS) {
    const x = platformX(plat, tick);
    if (plat.kind === "hazard") {
      const g = ctx.createLinearGradient(0, plat.y - 6, 0, plat.y + plat.h);
      g.addColorStop(0, "#c9ff6b");
      g.addColorStop(1, "#3f8f2c");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(x, plat.y, plat.w, plat.h, 6);
      ctx.fill();
      ctx.fillStyle = "rgba(210,255,150,0.75)";
      for (let i = 0; i < 5; i++) {
        const bx = x + 14 + i * (plat.w / 5);
        const by = plat.y + 4 + Math.sin(tick * 0.12 + i) * 3;
        ctx.beginPath();
        ctx.arc(bx, by, 2.4 + Math.sin(tick * 0.2 + i) * 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
      const glow = ctx.createRadialGradient(
        x + plat.w / 2,
        plat.y,
        4,
        x + plat.w / 2,
        plat.y,
        plat.w * 0.6,
      );
      glow.addColorStop(0, "rgba(170,255,120,0.35)");
      glow.addColorStop(1, "rgba(170,255,120,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(x - 30, plat.y - 50, plat.w + 60, 80);
    } else if (plat.kind === "bounce") {
      const squash = Math.abs(Math.sin(tick * 0.1)) * 3;
      ctx.fillStyle = "#2b2140";
      ctx.beginPath();
      ctx.roundRect(x, plat.y + 10, plat.w, plat.h - 10, 4);
      ctx.fill();
      const g = ctx.createLinearGradient(0, plat.y, 0, plat.y + 14);
      g.addColorStop(0, "#7ff2ff");
      g.addColorStop(1, "#2a8ecf");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(x - 3, plat.y + squash, plat.w + 6, 12, 6);
      ctx.fill();
      ctx.strokeStyle = "rgba(180,255,255,0.6)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 4, plat.y + squash + 3);
      ctx.lineTo(x + plat.w - 4, plat.y + squash + 3);
      ctx.stroke();
    } else if (plat.move) {
      // chain
      ctx.strokeStyle = "rgba(255,220,180,0.25)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + plat.w / 2, 0);
      ctx.lineTo(x + plat.w / 2, plat.y);
      ctx.stroke();
      stonePlatform(ctx, x, plat.y, plat.w, plat.h);
      const glow = ctx.createLinearGradient(0, plat.y, 0, plat.y + 26);
      glow.addColorStop(0, "rgba(255,190,120,0.35)");
      glow.addColorStop(1, "rgba(255,190,120,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(x, plat.y + plat.h, plat.w, 26);
    }
  }
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
    let shake = 0;
    const particles: Particle[] = [];
    const prevHp: [number, number] = [
      stateRef.current.players[0].hp,
      stateRef.current.players[1].hp,
    ];
    const deathBurst: [boolean, boolean] = [false, false];
    const bg = buildBackground();
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

      // visual reactions to state changes
      s.players.forEach((p, i) => {
        const cx = p.x + PLAYER_W / 2;
        const cy = p.y + PLAYER_H / 2;
        if (p.hp < prevHp[i]!) {
          const dmg = prevHp[i]! - p.hp;
          burst(particles, cx, cy, Math.min(18, 4 + dmg), "#ff6b6b", 3 + dmg * 0.2);
          shake = Math.min(14, shake + dmg * 0.5);
        }
        prevHp[i] = p.hp;
        if (p.deathTimer > 0 && !deathBurst[i]) {
          deathBurst[i] = true;
          burst(particles, cx, cy, 46, CHARACTERS[p.character].color, 6, 0.06);
          burst(particles, cx, cy, 24, "#ffffff", 4, 0.02);
          shake = 16;
        }
        if (p.deathTimer === 0) deathBurst[i] = false;
        if (p.auraTimer > 0 && s.tick % 3 === 0) {
          const a = Math.random() * Math.PI * 2;
          const r = CHARACTERS[p.character].special.radius * 0.8;
          spawn(particles, {
            x: cx + Math.cos(a) * r,
            y: cy + Math.sin(a) * r,
            vx: -Math.cos(a) * 0.7,
            vy: -0.5,
            life: 30,
            maxLife: 30,
            size: 2 + Math.random() * 2,
            color: "#a8f57e",
            gravity: -0.02,
          });
        }
        if (p.dashTimer > 0) {
          burst(particles, cx, cy, 2, "#bff0ff", 1.6, 0);
        }
        if (p.blinkTimer > 0 && p.blinkTimer > 10) {
          burst(particles, cx, cy, 8, "#d9b3ff", 3, 0);
        }
      });
      // ambient embers
      if (s.tick % 6 === 0) {
        spawn(particles, {
          x: Math.random() * WORLD.width,
          y: WORLD.height - 20,
          vx: (Math.random() - 0.5) * 0.4,
          vy: -0.5 - Math.random(),
          life: 90,
          maxLife: 110,
          size: 1 + Math.random() * 1.4,
          color: "#ffc26b",
          gravity: -0.004,
        });
      }
      stepParticles(particles);
      shake *= 0.86;

      if (ctx) {
        ctx.save();
        if (shake > 0.4) {
          ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
        }
        ctx.drawImage(bg, 0, 0);
        drawDynamicPlatforms(ctx, s.tick);

        // poison auras behind fighters
        for (const p of s.players) {
          if (p.auraTimer <= 0) continue;
          const c = CHARACTERS[p.character];
          const cx = p.x + PLAYER_W / 2;
          const cy = p.y + PLAYER_H / 2;
          const r = c.special.radius * (0.9 + Math.sin(s.tick * 0.2) * 0.06);
          const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, r);
          g.addColorStop(0, "rgba(150,245,120,0.4)");
          g.addColorStop(1, "rgba(80,200,90,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();
        }

        // dash after-images
        for (const p of s.players) {
          if (p.dashTimer <= 0) continue;
          for (let k = 1; k <= 3; k++) {
            ctx.globalAlpha = 0.18 * (4 - k);
            ctx.save();
            ctx.translate(-p.facing * 14 * k, 0);
            drawFighter(ctx, p, s.tick);
            ctx.restore();
          }
          ctx.globalAlpha = 1;
        }

        for (const p of s.players) {
          ctx.globalAlpha = p.hurtTimer > 0 && p.hurtTimer % 6 < 3 ? 0.5 : 1;
          drawFighter(ctx, p, s.tick);
          ctx.globalAlpha = 1;
        }

        // projectiles
        for (const pr of s.projectiles) {
          const acid = pr.kind === "acid";
          const g = ctx.createRadialGradient(pr.x + 8, pr.y + 8, 1, pr.x + 8, pr.y + 8, 16);
          g.addColorStop(0, acid ? "#eaffb0" : "#ffe9a8");
          g.addColorStop(0.5, acid ? "#8de24f" : "#ffb347");
          g.addColorStop(1, acid ? "rgba(120,220,80,0)" : "rgba(255,150,60,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(pr.x + 8, pr.y + 8, 15, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = acid ? "#c8ff7a" : "#ffd06b";
          ctx.beginPath();
          ctx.arc(pr.x + 8, pr.y + 8, 6, 0, Math.PI * 2);
          ctx.fill();
        }

        drawParticles(ctx, particles);
        ctx.restore();
      }

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
  const won = hud.winner === you;

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
          <div
            className="absolute inset-0 flex animate-fade-in flex-col items-center justify-center gap-2"
            style={{
              background: won
                ? "radial-gradient(circle at 50% 45%, rgba(255,200,90,0.28), rgba(10,8,16,0.9))"
                : "radial-gradient(circle at 50% 45%, rgba(220,60,60,0.28), rgba(10,8,16,0.92))",
            }}
          >
            <p
              className="animate-scale-in font-display text-6xl tracking-[0.15em]"
              style={{
                color: won ? "#ffd479" : "#ff6b6b",
                textShadow: won ? "0 0 40px rgba(255,190,90,0.7)" : "0 0 40px rgba(255,80,80,0.6)",
              }}
            >
              {won ? "VICTORY" : "DEFEATED"}
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
