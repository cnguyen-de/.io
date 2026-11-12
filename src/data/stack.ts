/**
 * The technology stack, grouped by what it is used for. Group titles live in the i18n files
 * (`stack.groups`); icons come from tech-icons.json — see scripts/fetch-tech-icons.mjs.
 *
 * A `null` slug means Simple Icons has no brand mark for it: the list shows a neutral mark instead.
 */
export type StackGroup = "frontend" | "backend" | "data" | "cloud" | "devops" | "genai" | "ml";

export const STACK: { id: StackGroup; items: [slug: string | null, name: string][] }[] = [
  {
    id: "frontend",
    items: [
      ["typescript", "TypeScript"],
      ["vuedotjs", "Vue"],
      ["react", "React"],
      ["angular", "Angular"],
      ["nextdotjs", "Next.js"],
    ],
  },
  {
    id: "backend",
    items: [
      ["nodedotjs", "Node.js"],
      ["python", "Python"],
      ["springboot", "Spring Boot"],
      ["flask", "Flask"],
    ],
  },
  {
    id: "data",
    items: [
      ["postgresql", "PostgreSQL"],
      ["mongodb", "MongoDB"],
      ["mysql", "MySQL"],
    ],
  },
  {
    id: "cloud",
    items: [
      ["googlecloud", "Google Cloud"],
      [null, "AWS"],
      ["firebase", "Firebase"],
      ["supabase", "Supabase"],
    ],
  },
  {
    id: "devops",
    items: [
      ["docker", "Docker"],
      ["kubernetes", "Kubernetes"],
      ["helm", "Helm"],
      ["argo", "Argo CD"],
      ["harbor", "Harbor"],
      ["grafana", "Grafana"],
    ],
  },
  {
    id: "genai",
    items: [
      ["anthropic", "Anthropic"],
      ["openai", "OpenAI"],
      [null, "Vertex AI"],
      [null, "Langfuse"],
    ],
  },
  {
    id: "ml",
    items: [
      ["tensorflow", "TensorFlow"],
      ["pytorch", "PyTorch"],
      ["opencv", "OpenCV"],
      ["ffmpeg", "FFmpeg"],
    ],
  },
];
