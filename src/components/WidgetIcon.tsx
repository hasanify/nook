import {
  ArrowBendUpLeft,
  BatteryCharging,
  BookBookmark,
  Broadcast,
  CheckSquare,
  Clock,
  CloudSun,
  Compass,
  Cpu,
  Flame,
  GitBranch,
  GitPullRequest,
  Globe,
  Heartbeat,
  HourglassHigh,
  Lightbulb,
  Lightning,
  MusicNotes,
  Newspaper,
  NotePencil,
  PenNib,
  PersonSimpleWalk,
  SlidersHorizontal,
  SpeakerHigh,
  SquaresFour,
  Timer,
  Translate,
  Triangle,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";

interface WidgetIconProps {
  kind?: string | undefined;
  className?: string | undefined;
}

export function WidgetIcon({ kind = "", className = "h-3.5 w-3.5" }: WidgetIconProps): ReactNode {
  const normKind = kind.toLowerCase().trim();

  switch (normKind) {
    case "clock":
      return <Clock className={className} />;
    case "weather":
      return <CloudSun className={className} />;
    case "todo":
      return <CheckSquare className={className} />;
    case "notes":
      return <NotePencil className={className} />;
    case "timer":
      return <Timer className={className} />;
    case "github-repo":
      return <GitBranch className={className} />;
    case "vercel-project":
      return <Triangle className={className} weight="fill" />;
    case "port-sentinel":
      return <Broadcast className={className} />;
    case "api-health":
      return <Heartbeat className={className} />;
    case "github-prs":
      return <GitPullRequest className={className} />;
    case "system-vitals":
      return <Cpu className={className} />;
    case "now-playing":
      return <MusicNotes className={className} />;
    case "battery-monitor":
      return <BatteryCharging className={className} />;
    case "world-clock":
      return <Globe className={className} />;
    case "habits":
      return <Flame className={className} />;
    case "ambient-sound":
      return <SpeakerHigh className={className} />;
    case "news-feed":
      return <Newspaper className={className} />;
    case "ai-tone":
      return <SlidersHorizontal className={className} />;
    case "ai-reply":
      return <ArrowBendUpLeft className={className} />;
    case "ai-eli5":
      return <Lightbulb className={className} />;
    case "ai-book-nugget":
      return <BookBookmark className={className} />;
    case "ai-history":
      return <HourglassHigh className={className} />;
    case "ai-stoic":
      return <Compass className={className} />;
    case "ai-stretch":
      return <PersonSimpleWalk className={className} />;
    case "ai-journal-prompt":
      return <PenNib className={className} />;
    case "ai-unstuck":
      return <Lightning className={className} />;
    case "ai-vocab":
      return <Translate className={className} />;
    default:
      return <SquaresFour className={className} />;
  }
}
