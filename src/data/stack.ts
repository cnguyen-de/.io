/**
 * The technology stack, grouped by what it is used for. Group titles live in the i18n files
 * (`stack.groups`); icons come from tech-icons.json — see scripts/fetch-tech-icons.mjs.
 */
export type StackGroup = "frontend" | "backend" | "data" | "cloud" | "ai";

export const STACK: { id: StackGroup; items: [slug: string, name: string][] }[] = [
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
      ["supabase", "Supabase"],
      ["firebase", "Firebase"],
    ],
  },
  {
    id: "cloud",
    items: [
      ["docker", "Docker"],
      ["kubernetes", "Kubernetes"],
      ["helm", "Helm"],
    ],
  },
  {
    id: "ai",
    items: [
      ["tensorflow", "TensorFlow"],
      ["pytorch", "PyTorch"],
      ["opencv", "OpenCV"],
      ["ffmpeg", "FFmpeg"],
    ],
  },
];
