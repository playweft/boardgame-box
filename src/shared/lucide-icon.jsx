import { h } from "preact";

export default function LucideIcon({ icon, className = "icon" }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    {icon?.map(([tag, attributes], index) => h(tag, { ...attributes, key: index }))}
  </svg>;
}
