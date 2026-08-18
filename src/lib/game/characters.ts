export type CharacterId = "blaze" | "frost";

export interface Character {
  id: CharacterId;
  name: string;
  tagline: string;
  color: string;
  accent: string;
  speed: number;
  jump: number;
  maxHp: number;
  melee: { damage: number; range: number; cooldown: number };
  special: {
    name: string;
    damage: number;
    cooldown: number;
    projectile: boolean;
    speed: number;
  };
}

export const CHARACTERS: Record<CharacterId, Character> = {
  blaze: {
    id: "blaze",
    name: "Blaze",
    tagline: "Close-range brawler. Hits hard, moves fast.",
    color: "#ff7a29",
    accent: "#ffd28a",
    speed: 4.2,
    jump: 12.5,
    maxHp: 100,
    melee: { damage: 11, range: 58, cooldown: 26 },
    special: {
      name: "Ember Dash",
      damage: 18,
      cooldown: 90,
      projectile: false,
      speed: 14,
    },
  },
  frost: {
    id: "frost",
    name: "Frost",
    tagline: "Ranged duelist. Keeps enemies at a distance.",
    color: "#4fc3f7",
    accent: "#cdf1ff",
    speed: 3.5,
    jump: 13.5,
    maxHp: 110,
    melee: { damage: 8, range: 48, cooldown: 24 },
    special: {
      name: "Ice Shard",
      damage: 13,
      cooldown: 55,
      projectile: true,
      speed: 9,
    },
  },
};

export const CHARACTER_LIST = Object.values(CHARACTERS);
