# CyAccess Demo Script

A 90-second pitch demo. Before starting: run `pnpm --filter api seed` so
demo hazards are live on the map.

## Story

> A student opens CyAccess for the first time. They choose Spanish, set
> accessibility preferences, and then use the campus map to navigate Iowa
> State with indoor accessibility data and real-time hazards.

## Flow (16 steps)

1. **Open app.** The cyclone-themed logo greets them on the language screen.
2. **Tap "Español".** Every word flips to Spanish instantly.
3. **Tap "Continuar".**
4. **Accessibility preferences.** Toggle *Evitar escaleras* and *Usar guía por voz*.
5. **Tap "Listo".** Lands on the campus map centered on Parks Library.
6. **Tap Parks Library polygon.** Bottom sheet reveals Elevator / Accessible Restroom / Study Areas.
7. **"Abrir mapa interior"** → indoor floor 1 SVG with entrances, elevator, restroom, stairs.
8. **Tap floor chip "2"** — renderer swaps to Floor 2.
9. **Tap the elevator.** Accessible route highlights in cardinal red.
10. **"Report hazard" FAB.** Take a photo of the hallway obstacle.
11. **AI classifies** it as *blocked_path* at ~87%. User accepts.
12. **Submit.** Hazard appears as a red pin on the map.
13. **Ask Cy tab.** Tap the chip "Encontrar el baño accesible más cercano".
14. **Cy replies** with a map action card + speaks the response in Spanish.
15. **Classroom tab.** Snap a photo of the whiteboard — Cy extracts text.
16. **"Leer en voz alta"** reads the notes back in Spanish.

## Backup moves

- Flip language to **Arabic** in Settings to show RTL layout.
- Tap a seeded hazard and vote **"Mark resolved"** to show the trust flow.
- Open Settings → "Clear local data" to reset between takes.
