export type CharacterId = "jiggly" | "tobi" | "sausen";

export type SpecialKind = "aura" | "slam" | "blitz";

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
  melee: { damage: number; range: number; cooldown: number };
  special: {
    name: string;
    kind: SpecialKind;
    damage: number;
    cooldown: number;
    duration: number;
    radius: number;
    speed: number;
  };
}

export const CHARACTERS: Record<CharacterId, Character> = {
  jiggly: {
    id: "jiggly",
    name: "Jiggly J",
    tagline: "Tall ginger. Super jumps, and jiggle-dances a poison cloud around himself.",
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
    melee: { damage: 9, range: 54, cooldown: 26 },
    special: {
      name: "Jiggle Toxin",
      kind: "aura",
      damage: 4,
      cooldown: 150,
      duration: 110,
      radius: 96,
      speed: 0,
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
};

export const CHARACTER_LIST = Object.values(CHARACTERS);
