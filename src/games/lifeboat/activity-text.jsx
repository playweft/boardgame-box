import { h } from "preact";
import { CrewPortrait } from "./crew.jsx";
import Icon from "./icon.jsx";
import { NavigationCardPreview } from "./navigation.jsx";

export default function ActivityText({ parts, characters, showPortraits = false }) {
  return parts.map((part, index) => {
    if (typeof part !== "object") return part;
    if (part.portraits) return <span key={index} className="activity-portraits" role="img" aria-label={part.label} title={part.label}>
      {part.portraits.map(id => <CrewPortrait key={id} id={id} />)}
    </span>;
    if (part.navigationCard) return <NavigationCardPreview key={index} cardId={part.navigationCard} label={part.label} characters={characters} />;
    if (part.icon) return <span key={index} className="activity-card"><Icon name={part.icon} />{part.label}</span>;
    return showPortraits
      ? <span key={index} className="activity-person"><CrewPortrait id={part.id} />{part.label}</span>
      : part.label;
  });
}
