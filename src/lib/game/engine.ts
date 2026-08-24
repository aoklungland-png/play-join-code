import { CHARACTERS, type CharacterId } from "./characters";

export const WORLD = { width: 1200, height: 640 };
export const GRAVITY = 0.6;
/** Ticks the death animation plays before the match resolves. */
export const DEATH_DURATION = 80;


export interface Input {
  left: boolean;
  right: boolean;
  up: boolean;
  attack: boolean;
  special: boolean;
}

export const EMPTY_INPUT: Input = {
  left: false,
  right: false,
  up: false,
  attack: false,
  special: false,
};

export interface PlayerState {
  character: CharacterId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  hp: number;
  onGround: boolean;
  attackTimer: number;
  attackCd: number;
  specialCd: number;
  dashTimer: number;
  auraTimer: number;
  hurtTimer: number;
  /** Cough wind-up/recovery animation timer (JJ) */
  coughTimer: number;
  /** Blink flash timer */
  blinkTimer: number;
  /** Counts up while the death animation plays (0 = alive) */
  deathTimer: number;
}


export interface Projectile {
  owner: 0 | 1;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  life: number;
  kind: "acid" | "shock";
}

export interface GameState {
  players: [PlayerState, PlayerState];
  projectiles: Projectile[];
  winner: 0 | 1 | null;
  tick: number;
}

export type PlatformKind = "solid" | "bounce" | "hazard";

export interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: PlatformKind;
  /** Horizontal patrol movement */
  move?: { range: number; speed: number; phase: number };
}

export const PLATFORMS: Platform[] = [
  // main ground
  { x: 0, y: 600, w: WORLD.width, h: 40, kind: "solid" },
  // acid pits burned into both ends of the floor
  { x: 40, y: 588, w: 150, h: 14, kind: "hazard" },
  { x: 1010, y: 588, w: 150, h: 14, kind: "hazard" },
  // bounce pads
  { x: 300, y: 574, w: 84, h: 26, kind: "bounce" },
  { x: 816, y: 574, w: 84, h: 26, kind: "bounce" },
  // central raised arena
  { x: 460, y: 470, w: 280, h: 20, kind: "solid" },
  // floating side islands
  { x: 90, y: 340, w: 210, h: 18, kind: "solid" },
  { x: 900, y: 340, w: 210, h: 18, kind: "solid" },
  // moving lifts
  { x: 320, y: 250, w: 140, h: 16, kind: "solid", move: { range: 210, speed: 0.012, phase: 0 } },
  { x: 740, y: 250, w: 140, h: 16, kind: "solid", move: { range: 210, speed: 0.012, phase: Math.PI } },
  // top perch
  { x: 520, y: 150, w: 170, h: 18, kind: "solid" },
];


/** Platform X offset at a given tick (moving platforms patrol horizontally). */
export function platformX(p: Platform, tick: number) {
  if (!p.move) return p.x;
  return p.x + (Math.sin(tick * p.move.speed + p.move.phase) * p.move.range) / 2;
}

export const PLAYER_W = 34;
export const PLAYER_H = 54;

function makePlayer(character: CharacterId, x: number, facing: 1 | -1): PlayerState {
  return {
    character,
    x,
    y: 300,
    vx: 0,
    vy: 0,
    facing,
    hp: CHARACTERS[character].maxHp,
    onGround: false,
    attackTimer: 0,
    attackCd: 0,
    specialCd: 0,
    dashTimer: 0,
    auraTimer: 0,
    hurtTimer: 0,
    coughTimer: 0,
    blinkTimer: 0,
    deathTimer: 0,

  };
}

export function createGame(hostChar: CharacterId, guestChar: CharacterId): GameState {
  return {
    players: [makePlayer(hostChar, 200, 1), makePlayer(guestChar, WORLD.width - 240, -1)],
    projectiles: [],
    winner: null,
    tick: 0,
  };
}

function overlaps(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function stepPlayer(p: PlayerState, input: Input, tick: number) {
  const c = CHARACTERS[p.character];
  if (p.attackCd > 0) p.attackCd--;
  if (p.specialCd > 0) p.specialCd--;
  if (p.attackTimer > 0) p.attackTimer--;
  if (p.hurtTimer > 0) p.hurtTimer--;
  if (p.auraTimer > 0) p.auraTimer--;
  if (p.coughTimer > 0) p.coughTimer--;
  if (p.blinkTimer > 0) p.blinkTimer--;

  if (p.dashTimer > 0) {
    p.dashTimer--;
    p.vx = p.facing * c.special.speed;
  } else {
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    p.vx = dir * c.speed;
    if (dir !== 0) p.facing = dir > 0 ? 1 : -1;
  }

  if (input.up && p.onGround) {
    p.vy = -c.jump;
    p.onGround = false;
  }

  p.vy = Math.min(p.vy + GRAVITY, 18);
  p.x += p.vx;
  p.y += p.vy;

  p.x = Math.max(0, Math.min(WORLD.width - PLAYER_W, p.x));

  p.onGround = false;
  for (const plat of PLATFORMS) {
    const px = platformX(plat, tick);
    if (
      p.vy >= 0 &&
      overlaps(p.x, p.y, PLAYER_W, PLAYER_H, px, plat.y, plat.w, plat.h) &&
      p.y + PLAYER_H - p.vy <= plat.y + 6
    ) {
      p.y = plat.y - PLAYER_H;
      p.onGround = true;
      if (plat.kind === "bounce") {
        p.vy = -Math.max(20, c.jump * 1.35);
        p.onGround = false;
      } else {
        p.vy = 0;
      }
      if (plat.move) {
        // carry the player with the moving platform
        p.x += platformX(plat, tick) - platformX(plat, tick - 1);
      }
      if (plat.kind === "hazard" && tick % 18 === 0) {
        p.hp = Math.max(0, p.hp - 3);
      }
    }
  }

  if (p.y > WORLD.height + 200) {
    p.hp = 0;
  }
}

function damage(target: PlayerState, amount: number, fromX: number) {
  if (target.hurtTimer > 0) return;
  target.hp = Math.max(0, target.hp - amount);
  target.hurtTimer = 18;
  target.vx = target.x < fromX ? -7 : 7;
  target.vy = -5;
}

/** Damage over time (poison) — ignores invulnerability and applies no knockback. */
function poisonTick(target: PlayerState, amount: number) {
  target.hp = Math.max(0, target.hp - amount);
}

export function step(state: GameState, inputs: [Input, Input]): GameState {
  if (state.winner !== null) return state;
  state.tick++;

  for (let i = 0; i < 2; i++) {
    const p = state.players[i]!;
    const dying = p.hp <= 0 || p.deathTimer > 0;
    const input = dying ? EMPTY_INPUT : inputs[i]!;
    const other = state.players[1 - i]!;
    const c = CHARACTERS[p.character];

    if (dying) {
      p.deathTimer++;
      p.auraTimer = 0;
      p.dashTimer = 0;
      p.attackTimer = 0;
      p.vx *= 0.9;
      p.vy = Math.min(p.vy + GRAVITY, 18);
      p.x += p.vx;
      p.y += p.vy;
      if (p.y + PLAYER_H > 600) {
        p.y = 600 - PLAYER_H;
        p.vy = 0;
      }
      continue;
    }

    stepPlayer(p, input, state.tick);


    if (input.attack && p.attackCd === 0) {
      p.attackCd = c.melee.cooldown;
      p.attackTimer = 10;
      if (c.melee.projectile) {
        p.coughTimer = 22;
        state.projectiles.push({
          owner: i as 0 | 1,
          x: p.x + (p.facing === 1 ? PLAYER_W : -16),
          y: p.y + 14,
          vx: p.facing * c.melee.projectile.speed,
          vy: 0,
          damage: c.melee.damage,
          life: c.melee.projectile.life,
          kind: "acid",
        });
      } else {
        const hx = p.facing === 1 ? p.x + PLAYER_W : p.x - c.melee.range;
        if (overlaps(hx, p.y, c.melee.range, PLAYER_H, other.x, other.y, PLAYER_W, PLAYER_H)) {
          damage(other, c.melee.damage, p.x);
        }
      }
    }

    if (input.special && p.specialCd === 0) {
      p.specialCd = c.special.cooldown;
      if (c.special.kind === "aura") {
        p.auraTimer = c.special.duration;
      } else if (c.special.kind === "slam") {
        p.vy = 6;
        for (const dir of [1, -1] as const) {
          state.projectiles.push({
            owner: i as 0 | 1,
            x: p.x + (dir === 1 ? PLAYER_W : -14),
            y: p.y + PLAYER_H - 16,
            vx: dir * c.special.speed,
            vy: 0,
            damage: c.special.damage,
            life: 70,
            kind: "shock",
          });
        }
      } else if (c.special.kind === "blink") {
        const dist = c.special.distance ?? 150;
        p.x = Math.max(0, Math.min(WORLD.width - PLAYER_W, p.x + p.facing * dist));
        p.blinkTimer = 14;
      } else {
        p.dashTimer = c.special.duration;
        p.vy = -2;
      }
    }

    // Poison aura ticks damage on anyone standing close by
    if (p.auraTimer > 0 && state.tick % 12 === 0) {
      const cx = p.x + PLAYER_W / 2;
      const cy = p.y + PLAYER_H / 2;
      const ox = other.x + PLAYER_W / 2;
      const oy = other.y + PLAYER_H / 2;
      if (Math.hypot(cx - ox, cy - oy) < c.special.radius) {
        poisonTick(other, c.special.damage);
      }
    }

    if (p.dashTimer > 0 && overlaps(p.x, p.y, PLAYER_W, PLAYER_H, other.x, other.y, PLAYER_W, PLAYER_H)) {
      damage(other, c.special.damage, p.x);
    }
  }

  state.projectiles = state.projectiles.filter((pr) => {
    pr.x += pr.vx;
    pr.y += pr.vy;
    if (pr.kind === "acid") pr.vy = Math.min(pr.vy + 0.12, 6);
    pr.life--;
    const target = state.players[1 - pr.owner]!;
    if (overlaps(pr.x, pr.y, 16, 16, target.x, target.y, PLAYER_W, PLAYER_H)) {
      damage(target, pr.damage, pr.x);
      return false;
    }
    return pr.life > 0 && pr.x > -40 && pr.x < WORLD.width + 40 && pr.y < WORLD.height + 40;
  });

  if (state.players[0].deathTimer >= DEATH_DURATION) state.winner = 1;
  else if (state.players[1].deathTimer >= DEATH_DURATION) state.winner = 0;


  return state;
}
