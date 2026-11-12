# may-solutions.io

The website of May Solutions, Frankfurt am Main. A static [Astro](https://astro.build) site in two
languages (`/` English, `/de/` German), drawn like an engineering sheet: paper, ink and one red pen.

```sh
pnpm install
pnpm dev      # http://localhost:4321
pnpm build    # type check + static build into dist/
```

## The city model

The home page carries a true-to-scale 3D model of Frankfurt's high-rises, drawn with three.js in
the same ink-on-paper style as the rest of the page. There is one model, shown as the three classic
projections of a building:

| Figure | Where            | Projection                                                              |
| ------ | ---------------- | ----------------------------------------------------------------------- |
| Fig. 1 | Hero             | Axonometric. Pinned while the hero scrolls; it rises, turns and widens. |
| Fig. 2 | Frankfurt        | Site plan. Arrives tilted and lies down flat, north up.                 |
| Fig. 3 | Contact (footer) | Elevation from the south, at night.                                     |

All three can be dragged; in Fig. 1 the towers name themselves under the pointer. The projection is
orthographic throughout, so the scale figure and scale bar next to each drawing are real.

The model is an enhancement. The page is fully rendered without it, including static SVG versions
of Fig. 1 and Fig. 2 (`src/lib/skyline.ts`); these stay in place when WebGL is missing, JavaScript
is off, or the visitor prefers reduced motion. Where the model can run, a small inline script in
`Layout.astro` marks the document (`html.gl`) before first paint and `Home.astro` loads the engine
as a separate chunk.

```
src/three/
  model.ts    the towers as plain data (shared with the pages, which place the callouts)
  build.ts    data → GPU buffers: faces, pen strokes, water and parks, lights
  shaders.ts  the drawing style: paper tones, constant-width strokes, flat shadows
  engine.ts   stages, camera poses, scrolling, input, labels, scale read-out
```

### Data

Everything drawn comes from OpenStreetMap (© OpenStreetMap contributors, ODbL) and is committed, so
neither the build nor the site talks to OSM:

- `src/data/skyline.json` — footprints and heights of the high-rises: `node scripts/fetch-skyline.mjs`
- `src/data/map.json` — streets, railways, the Main, parks: `node scripts/fetch-map.mjs`

Europaturm, Kaiserdom and the ECB are missing from the footprint data and modelled by hand in
`src/three/model.ts`.
