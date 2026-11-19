import { h } from "preact";
import { Armchair, ArrowLeftRight, ChevronRight, Layers, LockKeyhole } from "lucide";
import LucideIcon from "../../shared/lucide-icon.jsx";

const icons = [
  "water", "cash", "jewels", "painting",
  "oar", "weapon", "preserver", "compass",
  "bird", "parasol", "medical", "chum",
];
const controls = { forward: ChevronRight, swap: ArrowLeftRight, supplies: Layers, wait: Armchair, lock: LockKeyhole };

export default function Icon({ name }) {
  const control = controls[name];
  if (control) return <LucideIcon icon={control} className="ui-symbol" />;
  const index = icons.indexOf(name);
  if (index < 0) return null;
  return <span className="sea-icon" aria-hidden="true" style={{
    backgroundPosition: `${(index % 4) * 100 / 3}% ${Math.floor(index / 4) * 50}%`,
  }} />;
}
