import { reactive } from "vue";

/** Shared between the 3D scene and the page content. */
export const sceneState = reactive({
  /** The intro has reached the point where page content should appear. */
  revealed: false,
  /** False when WebGL is unavailable and the static fallback is shown. */
  webgl: true,
  /** Fractional camera shot index, driven by the story's scroll position. */
  shot: 0,
  /** Text of the label floating over the focused tower (services tour). */
  focusLabel: "",
  /** Index (into CLIENTS) of the client singled out on the page and in the scene; -1 for none. */
  activeClient: -1,
  /** Client under the pointer / keyboard focus, in the list or on an arc; -1 for none. */
  hoverClient: -1,
  /** Incremented to send the easter-egg plane across the sky. */
  planeFlights: 0,
});
