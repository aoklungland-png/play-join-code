# Arena Overhaul: New Map, Richer Characters, Death Animations

## What changes

### 1. Brand-new arena (visual + layout)
- Replace the flat dark background with a layered, colorful scene: gradient sky (deep violet to amber horizon), a large sun/moon disc, drifting clouds, distant mountain silhouettes, and a parallax mid-layer of ruined towers.
- Foreground gets styled platforms instead of grey rectangles: stone slabs with grass/moss tops, glowing edges, and per-kind visuals:
  - solid: stone + lit rim
  - bounce: springy neon pad that squashes when hit
  - hazard: bubbling acid pool with animated surface
- Moving platforms get chain/glow markers so players can read them.
- Ambient touches: floating embers/particles, subtle vignette, screen-shake on heavy hits.
- Layout refresh: symmetric but more interesting — central raised arena, two floating side islands, one moving lift per side, upper perch with gaps to fall through, acid pits at the edges of the floor.

### 2. Death animation + defeat screen
- When a fighter's HP hits 0 the match no longer ends instantly: a short death sequence plays (fighter goes limp, falls back, fades out with a burst of particles), then the VICTORY / DEFEATED overlay animates in.
- Overlay gets motion: scale-in text, colored flash (gold for victory, red for defeat), and the loser's name.

### 3. Swap Jiggly J and JJ powers
- Jiggly J gets the blink teleport (short forward hop, ~3s cooldown) and the acid-cough projectile attack, keeping his super jump.
- JJ gets the poison jiggle-dance aura special and a close-range melee punch.
- Names, taglines, and stats are updated so each kit still reads clearly on the character-select screen.

### 4. Much more detailed characters
- Rewrite the fighter renderer: proper head with hair shape, face (eyes, brow, mouth), neck, shoulders, jointed arms and legs with knees/elbows, hands, feet, shirt with collar/sleeves, belt, and a soft drop shadow on the ground.
- Per-character detail: Jiggly J's tall ginger mop, Tobi's heavy build and thick arms, Sausen's lean frame with speed trails, JJ's hunched sickly posture.
- Better animations: walk cycle with arm counter-swing, jump tuck / fall reach, punch wind-up and follow-through, cough hunch with spray puff, blink after-image, dash motion streaks, hurt recoil, idle breathing.

### 5. Performance
- Keep everything on the existing single canvas with plain 2D drawing — no new libraries.
- Static background layers (sky, mountains, platforms) are pre-rendered once into an offscreen canvas and blitted each frame; only fighters, projectiles, and particles are redrawn.
- Particle count is capped and pooled; network payload stays as-is (host authority, state broadcast every other tick) so nothing new goes over the wire.

## Technical notes
- `src/lib/game/characters.ts`: swap the `special` and `melee` blocks between `jiggly` and `jj`; tune taglines.
- `src/lib/game/engine.ts`: new `PLATFORMS` layout; add a `deathTimer` per player and a `deathAt` tick so the winner is only set after the death animation finishes; keep the step function deterministic and serializable.
- `src/components/GameCanvas.tsx`: split rendering into `renderBackground` (offscreen, built once on mount) and per-frame `drawFighter` / `drawEffects`; add a local particle array that is purely visual (not synced).
- Colors come from the existing design tokens in `src/styles.css`; any new arena colors are added there as tokens rather than hardcoded in the component.
