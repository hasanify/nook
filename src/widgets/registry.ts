import type { WidgetModule } from "@/core/types";

import aiBookNuggetModule from "./ai-book-nugget";
import aiEli5Module from "./ai-eli5";
import aiHistoryModule from "./ai-history";
import aiJournalPromptModule from "./ai-journal-prompt";
import aiReplyModule from "./ai-reply";
import aiStoicModule from "./ai-stoic";
import aiStretchModule from "./ai-stretch";
import aiToneModule from "./ai-tone";
import aiUnstuckModule from "./ai-unstuck";
import aiVocabModule from "./ai-vocab";
import ambientSoundModule from "./ambient-sound";
import apiHealthModule from "./api-health";
import batteryMonitorModule from "./battery-monitor";
import clockModule from "./clock";
import githubPrsModule from "./github-prs";
import githubRepoModule from "./github-repo";
import habitsModule from "./habits";
import newsFeedModule from "./news-feed";
import notesModule from "./notes";
import nowPlayingModule from "./now-playing";
import placeholderModule from "./placeholder";
import portSentinelModule from "./port-sentinel";
import systemVitalsModule from "./system-vitals";
import timerModule from "./timer";
import todoModule from "./todo";
import vercelProjectModule from "./vercel-project";
import weatherModule from "./weather";
import worldClockModule from "./world-clock";

export const WIDGET_REGISTRY: Record<string, WidgetModule> = {
  clock: clockModule,
  weather: weatherModule,
  todo: todoModule,
  notes: notesModule,
  timer: timerModule,
  "github-repo": githubRepoModule,
  "vercel-project": vercelProjectModule,
  "ai-tone": aiToneModule,
  "ai-reply": aiReplyModule,
  "ai-eli5": aiEli5Module,
  "ai-book-nugget": aiBookNuggetModule,
  "ai-history": aiHistoryModule,
  "ai-stoic": aiStoicModule,
  "ai-stretch": aiStretchModule,
  "ai-journal-prompt": aiJournalPromptModule,
  "ai-unstuck": aiUnstuckModule,
  "ai-vocab": aiVocabModule,
  "port-sentinel": portSentinelModule,
  "api-health": apiHealthModule,
  "github-prs": githubPrsModule,
  "system-vitals": systemVitalsModule,
  "now-playing": nowPlayingModule,
  "battery-monitor": batteryMonitorModule,
  "world-clock": worldClockModule,
  habits: habitsModule,
  "ambient-sound": ambientSoundModule,
  "news-feed": newsFeedModule,
};

const ALL_MODULES: Record<string, WidgetModule> = {
  ...WIDGET_REGISTRY,
  placeholder: placeholderModule,
};

export function getWidgetModule(kind: string): WidgetModule | undefined {
  return ALL_MODULES[kind];
}

export function getAllManifests() {
  return Object.values(WIDGET_REGISTRY).map((m) => m.manifest);
}
