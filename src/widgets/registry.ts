import type { WidgetModule } from "../core/types";
import notesModule from "./notes";
import timerModule from "./timer";
import githubRepoModule from "./github-repo";
import vercelProjectModule from "./vercel-project";
import clockModule from "./clock";
import weatherModule from "./weather";
import todoModule from "./todo";
import placeholderModule from "./placeholder";
import aiToneModule from "./ai-tone";
import aiReplyModule from "./ai-reply";
import aiEli5Module from "./ai-eli5";
import aiBookNuggetModule from "./ai-book-nugget";
import aiHistoryModule from "./ai-history";
import aiStoicModule from "./ai-stoic";
import aiStretchModule from "./ai-stretch";
import aiJournalPromptModule from "./ai-journal-prompt";
import aiUnstuckModule from "./ai-unstuck";
import aiVocabModule from "./ai-vocab";
import portSentinelModule from "./port-sentinel";
import apiHealthModule from "./api-health";
import githubPrsModule from "./github-prs";
import systemVitalsModule from "./system-vitals";
import nowPlayingModule from "./now-playing";
import batteryMonitorModule from "./battery-monitor";
import worldClockModule from "./world-clock";
import habitsModule from "./habits";
import ambientSoundModule from "./ambient-sound";
import newsFeedModule from "./news-feed";

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
