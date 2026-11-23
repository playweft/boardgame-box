import { h } from "preact";
import { ChevronLeft, CircleHelp, Pause } from "lucide";
import LucideIcon from "./lucide-icon.jsx";

export default function GameTopbar({ title, standalone, room, onPause, onHelp,
  pauseLabel = "暂停游戏", backLabel = "返回桌游盒子", helpLabel = "游戏规则" }) {
  return <header className="topbar">
    {onPause ? (
      <button type="button" className="topbar-button back-link" onClick={onPause}
        aria-label={pauseLabel} aria-haspopup="dialog">
        <LucideIcon icon={Pause} />
      </button>
    ) : !room && standalone && (
      <a className="topbar-button back-link" href="../" aria-label={backLabel}>
        <LucideIcon icon={ChevronLeft} />
      </a>
    )}
    <div className="topbar-heading">{title}</div>
    {standalone && (
      <button type="button" className="topbar-button help-link" onClick={onHelp} aria-label={helpLabel}>
        <LucideIcon icon={CircleHelp} />
      </button>
    )}
  </header>;
}
