import { CustomWidgetHost } from "@/components/CustomWidgetHost";
import type { Manifest, WidgetModule } from "@/core/types";

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
import clipboardModule from "./clipboard";
import clockModule from "./clock";
import cryptoTickerModule from "./crypto-ticker";
import githubPrsModule from "./github-prs";
import githubRepoModule from "./github-repo";
import habitsModule from "./habits";
import newsFeedModule from "./news-feed";
import notesModule from "./notes";
import nowPlayingModule from "./now-playing";
import placeholderModule from "./placeholder";
import portSentinelModule from "./port-sentinel";
import shortcutsModule from "./shortcuts";
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
  shortcuts: shortcutsModule,
  clipboard: clipboardModule,
  "crypto-ticker": cryptoTickerModule,
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

const CUSTOM_MANIFESTS = new Map<string, Manifest>();

export function registerCustomWidget(manifest: Manifest): void {
  CUSTOM_MANIFESTS.set(manifest.id, manifest);
}

export function isCustomWidget(kind: string): boolean {
  if (!kind) return false;
  return !(kind in ALL_MODULES);
}

export function getWidgetModule(kind: string): WidgetModule | undefined {
  if (!kind) {
    return undefined;
  }
  if (ALL_MODULES[kind]) {
    return ALL_MODULES[kind];
  }

  const manifest: Manifest = CUSTOM_MANIFESTS.get(kind) ?? {
    id: kind,
    name: kind,
    description: `Custom widget (${kind})`,
    version: "1.0.0",
    author: "Custom",
    defaultSize: { w: 340, h: 320 },
    minSize: { w: 200, h: 150 },
    resizable: true,
  };

  return {
    manifest,
    component: CustomWidgetHost,
    defaultSettings: {},
    defaultState: {},
  };
}

export function getAllManifests(): Manifest[] {
  return [
    ...Object.values(WIDGET_REGISTRY).map((m) => m.manifest),
    ...Array.from(CUSTOM_MANIFESTS.values()),
  ];
}
