import {
  ArrowBendUpLeftIcon,
  BatteryChargingIcon,
  BookBookmarkIcon,
  BroadcastIcon,
  CheckSquareIcon,
  ClipboardTextIcon,
  ClockIcon,
  CloudSunIcon,
  CompassIcon,
  CpuIcon,
  CurrencyBtcIcon,
  FlameIcon,
  GitBranchIcon,
  GitPullRequestIcon,
  GlobeIcon,
  HeartbeatIcon,
  HourglassHighIcon,
  LightbulbIcon,
  LightningIcon,
  MusicNotesIcon,
  NewspaperIcon,
  NotePencilIcon,
  PenNibIcon,
  PersonSimpleWalkIcon,
  RocketLaunchIcon,
  SlidersHorizontalIcon,
  SpeakerHighIcon,
  SquaresFourIcon,
  TimerIcon,
  TranslateIcon,
  TriangleIcon,
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
      return <ClockIcon className={className} />;
    case "weather":
      return <CloudSunIcon className={className} />;
    case "todo":
      return <CheckSquareIcon className={className} />;
    case "notes":
      return <NotePencilIcon className={className} />;
    case "timer":
      return <TimerIcon className={className} />;
    case "github-repo":
      return <GitBranchIcon className={className} />;
    case "vercel-project":
      return <TriangleIcon className={className} weight="fill" />;
    case "port-sentinel":
      return <BroadcastIcon className={className} />;
    case "api-health":
      return <HeartbeatIcon className={className} />;
    case "github-prs":
      return <GitPullRequestIcon className={className} />;
    case "system-vitals":
      return <CpuIcon className={className} />;
    case "now-playing":
      return <MusicNotesIcon className={className} />;
    case "battery-monitor":
      return <BatteryChargingIcon className={className} />;
    case "world-clock":
      return <GlobeIcon className={className} />;
    case "habits":
      return <FlameIcon className={className} />;
    case "ambient-sound":
      return <SpeakerHighIcon className={className} />;
    case "news-feed":
      return <NewspaperIcon className={className} />;
    case "shortcuts":
      return <RocketLaunchIcon className={className} />;
    case "clipboard":
      return <ClipboardTextIcon className={className} />;
    case "crypto-ticker":
      return <CurrencyBtcIcon className={className} />;
    case "ai-tone":
      return <SlidersHorizontalIcon className={className} />;
    case "ai-reply":
      return <ArrowBendUpLeftIcon className={className} />;
    case "ai-eli5":
      return <LightbulbIcon className={className} />;
    case "ai-book-nugget":
      return <BookBookmarkIcon className={className} />;
    case "ai-history":
      return <HourglassHighIcon className={className} />;
    case "ai-stoic":
      return <CompassIcon className={className} />;
    case "ai-stretch":
      return <PersonSimpleWalkIcon className={className} />;
    case "ai-journal-prompt":
      return <PenNibIcon className={className} />;
    case "ai-unstuck":
      return <LightningIcon className={className} />;
    case "ai-vocab":
      return <TranslateIcon className={className} />;
    default:
      return <SquaresFourIcon className={className} />;
  }
}
