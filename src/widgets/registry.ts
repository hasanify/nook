import type { WidgetModule } from "../core/types";
import notesModule from "./notes";
import timerModule from "./timer";
import githubRepoModule from "./github-repo";
import vercelProjectModule from "./vercel-project";
import placeholderModule from "./placeholder";

export const WIDGET_REGISTRY: Record<string, WidgetModule> = {
  placeholder: placeholderModule,
  notes: notesModule,
  timer: timerModule,
  "github-repo": githubRepoModule,
  "vercel-project": vercelProjectModule,
};

export function getWidgetModule(kind: string): WidgetModule | undefined {
  return WIDGET_REGISTRY[kind];
}

export function getAllManifests() {
  return Object.values(WIDGET_REGISTRY).map((m) => m.manifest);
}
