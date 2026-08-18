import { CHARACTERS, type CharacterId } from "./characters";

export const WORLD = { width: 960, height: 540 };
export const GRAVITY = 0.6;

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
  hurtTimer: number;
}

export interface Projectile {
  owner: 0 | 1;
  x: number;
  y: number;
  vx: number;
  damage: number;
  life: number;
}

export interface GameState {
  players: [PlayerState, PlayerState];
  projectiles: Projectile[];
  winner: 0 | 1 | null;
  tick: number;
}

export const PLATFORMS = [
  { x: 0, y: 470, w: WORLD.width, h: 70 },
  { x: 120, y: 350, w: 200, h: 18 },
  { x: 640, y: 350, w: 200, h: 18 },
  { x: 380, y: 230, w: 200, h: 18 },
];

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
    hurtTimer: 0,
  };
}

export function createGame(hostChar: CharacterId, guestChar: CharacterId): GameState {
  return {
    players: [makePlayer(hostChar, 180, 1), makePlayer(guestChar, 740, -1)],
    projectiles: [],
    winner: null,
    tick: 0,
  };
}

function overlaps(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function stepPlayer(p: PlayerState, input: Input) {
  const c = CHARACTERS[p.character];
  if (p.attackCd > 0) p.attackCd--;
  if (p.specialCd > 0) p.specialCd--;
  if (p.attackTimer > 0) p.attackTimer--;
  if (p.hurtTimer > 0) p.hurtTimer--;

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
    if (
      p.vy >= 0 &&
      overlaps(p.x, p.y, PLAYER_W, PLAYER_H, plat.x, plat.y, plat.w, plat.h) &&
      p.y + PLAYER_H - p.vy <= plat.y + 4
    ) {
      p.y = plat.y - PLAYER_H;
      p.vy = 0;
      p.onGround = true;
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

export function step(state: GameState, inputs: [Input, Input]): GameState {
  if (state.winner !== null) return state;
  state.tick++;

  for (let i = 0; i < 2; i++) {
    const p = state.players[i]!;
    const input = inputs[i]!;
    const other = state.players[1 - i]!;
    const c = CHARACTERS[p.character];

    stepPlayer(p, input);

    if (input.attack && p.attackCd === 0) {
      p.attackCd = c.melee.cooldown;
      p.attackTimer = 10;
      const hx = p.facing === 1 ? p.x + PLAYER_W : p.x - c.melee.range;
      if (overlaps(hx, p.y, c.melee.range, PLAYER_H, other.x, other.y, PLAYER_W, PLAYER_H)) {
        damage(other, c.melee.damage, p.x);
      }
    }

    if (input.special && p.specialCd === 0) {
      p.specialCd = c.special.cooldown;
      if (c.special.projectile) {
        state.projectiles.push({
          owner: i as 0 | 1,
          x: p.x + (p.facing === 1 ? PLAYER_W : -12),
          y: p.y + 20,
          vx: p.facing * c.special.speed,
          damage: c.special.damage,
          life: 110,
        });
      } else {
        p.dashTimer = 12;
        p.vy = -3;
      }
    }

    if (p.dashTimer > 0 && overlaps(p.x, p.y, PLAYER_W, PLAYER_H, other.x, other.y, PLAYER_W, PLAYER_H)) {
      damage(other, c.special.damage, p.x);
      p.dashTimer = 0;
    }
  }

  state.projectiles = state.projectiles.filter((pr) => {
    pr.x += pr.vx;
    pr.life--;
    const target = state.players[1 - pr.owner]!;
    if (overlaps(pr.x, pr.y, 14, 10, target.x, target.y, PLAYER_W, PLAYER_H)) {
      damage(target, pr.damage, pr.x);
      return false;
    }
    return pr.life > 0 && pr.x > -40 && pr.x < WORLD.width + 40;
  });

  if (state.players[0].hp <= 0) state.winner = 1;
  else if (state.players[1].hp <= 0) state.winner = 0;

  return state;
}
