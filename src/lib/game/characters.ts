export type CharacterId = "jiggly" | "tobi" | "sausen" | "jj";

export type SpecialKind = "aura" | "slam" | "blitz" | "blink";

export interface Character {
  id: CharacterId;
  name: string;
  tagline: string;
  color: string;
  accent: string;
  /** Look, used by the canvas renderer to draw a human figure */
  look: {
    skin: string;
    hair: string;
    shirt: string;
    pants: string;
    height: number; // 0.85 - 1.15 multiplier
    build: number; // 0.85 - 1.2 body width multiplier
  };
  speed: number;
  jump: number;
  maxHp: number;
  melee: {
    damage: number;
    range: number;
    cooldown: number;
    /** When set, the attack fires a projectile instead of a close-range hit */
    projectile?: { speed: number; life: number; kind: "acid" };
  };
  special: {
    name: string;
    kind: SpecialKind;
    damage: number;
    cooldown: number;
    duration: number;
    radius: number;
    speed: number;
    /** Teleport distance for blink specials */
    distance?: number;
  };
}

export const CHARACTERS: Record<CharacterId, Character> = {
  jiggly: {
    id: "jiggly",
    name: "Jiggly J",
    tagline: "Tall ginger. Super jumps, spits flying acid and blinks a step forward.",
    color: "#7fe07a",
    accent: "#ff8a3d",
    look: {
      skin: "#f3c9a5",
      hair: "#e2622a",
      shirt: "#3fa14a",
      pants: "#2c3550",
      height: 1.14,
      build: 0.9,
    },
    speed: 3.9,
    jump: 18.5,
    maxHp: 95,
    melee: {
      damage: 11,
      range: 40,
      cooldown: 34,
      projectile: { speed: 9.5, life: 90, kind: "acid" },
    },
    special: {
      name: "Blink Step",
      kind: "blink",
      damage: 0,
      cooldown: 180,
      duration: 0,
      radius: 0,
      speed: 0,
      distance: 170,
    },
  },

  tobi: {
    id: "tobi",
    name: "Tobi",
    tagline: "Slow and heavy. Every punch hurts, and his slam shakes the whole arena.",
    color: "#d8542f",
    accent: "#ffd06b",
    look: {
      skin: "#c98a5e",
      hair: "#2b2119",
      shirt: "#b04026",
      pants: "#33302c",
      height: 1.02,
      build: 1.2,
    },
    speed: 2.7,
    jump: 11.5,
    maxHp: 135,
    melee: { damage: 19, range: 52, cooldown: 40 },
    special: {
      name: "Ground Slam",
      kind: "slam",
      damage: 22,
      cooldown: 130,
      duration: 0,
      radius: 0,
      speed: 8,
    },
  },
  sausen: {
    id: "sausen",
    name: "Sausen",
    tagline: "Blinding speed, tiny hits. Blitzes through enemies again and again.",
    color: "#4fc3f7",
    accent: "#e9fbff",
    look: {
      skin: "#eab896",
      hair: "#f2f2f2",
      shirt: "#2f8fd0",
      pants: "#1d2740",
      height: 0.9,
      build: 0.85,
    },
    speed: 6.6,
    jump: 14,
    maxHp: 85,
    melee: { damage: 6, range: 42, cooldown: 13 },
    special: {
      name: "Blur Blitz",
      kind: "blitz",
      damage: 7,
      cooldown: 70,
      duration: 20,
      radius: 0,
      speed: 17,
    },
  },
  jj: {
    id: "jj",
    name: "JJ",
    tagline: "Sickly and sneaky. Coughs flying acid and blinks a short hop forward.",
    color: "#b184f5",
    accent: "#a4f58a",
    look: {
      skin: "#d8c9b0",
      hair: "#3b2f4a",
      shirt: "#6b4bb0",
      pants: "#232436",
      height: 0.98,
      build: 0.95,
    },
    speed: 4.2,
    jump: 13.5,
    maxHp: 100,
    melee: {
      damage: 11,
      range: 40,
      cooldown: 34,
      projectile: { speed: 9.5, life: 90, kind: "acid" },
    },
    special: {
      name: "Blink Step",
      kind: "blink",
      damage: 0,
      cooldown: 180,
      duration: 0,
      radius: 0,
      speed: 0,
      distance: 170,
    },
  },
};

export const CHARACTER_LIST = Object.values(CHARACTERS);
