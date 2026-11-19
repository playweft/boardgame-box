import { h } from "preact";
import { ChevronLeft, CircleHelp, Pause } from "lucide";
import LucideIcon from "./lucide-icon.jsx";

export default function GameTopbar({ title, standalone, room, onPause, onHelp }) {
  return <header className="topbar">
    {onPause ? (
      <button type="button" className="topbar-button back-link" onClick={onPause}
        aria-label="暂停游戏" aria-haspopup="dialog">
        <LucideIcon icon={Pause} />
      </button>
    ) : !room && standalone && (
      <a className="topbar-button back-link" href="../" aria-label="返回桌游盒子">
        <LucideIcon icon={ChevronLeft} />
      </a>
    )}
    <div className="topbar-heading">{title}</div>
    {standalone && (
      <button type="button" className="topbar-button help-link" onClick={onHelp} aria-label="游戏规则">
        <LucideIcon icon={CircleHelp} />
      </button>
    )}
  </header>;
}
