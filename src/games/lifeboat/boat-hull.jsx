import { h } from "preact";

export default function BoatHull({ rows }) {
  return <svg className="boat-hull" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="193 8 858 1244" preserveAspectRatio="none">
    <defs>
      <path id="hull" d="M622 35C969 35 1044 360 1044 635C1044 915 975 1242 622 1242C269 1242 200 915 200 635C200 360 275 35 622 35Z" />
      <path id="deck" d="M622 84C942 84 998 387 998 635C998 881 942 1197 622 1197C302 1197 246 881 246 635C246 387 302 84 622 84Z" />
      <clipPath id="inside"><use href="#deck" /></clipPath>

      <linearGradient id="rail" x2="1" y2="1">
        <stop stop-color="#f9c37a" />
        <stop offset=".58" stop-color="#f5bb6e" />
        <stop offset="1" stop-color="#f8c076" />
      </linearGradient>
      <linearGradient id="bevel" x2="0" y2="1">
        <stop stop-color="#a76f38" />
        <stop offset=".57" stop-color="#b47c42" />
        <stop offset="1" stop-color="#bc8244" />
      </linearGradient>
      <radialGradient id="floor" cy=".46" r=".69">
        <stop stop-color="#0e3449" />
        <stop offset=".8" stop-color="#0d3145" />
        <stop offset="1" stop-color="#0b2d3f" />
      </radialGradient>
      <filter id="inner-shadow"><feGaussianBlur stdDeviation="5" /></filter>

      <linearGradient id="bench-grain" x2="0" y2="1">
        <stop stop-color="#e9ba79" />
        <stop offset=".16" stop-color="#de9f58" />
        <stop offset=".45" stop-color="#af692f" />
        <stop offset=".8" stop-color="#bd7639" />
        <stop offset="1" stop-color="#634229" />
      </linearGradient>
      <linearGradient id="bench-shadow" x2="0" y2="1">
        <stop stop-color="#020a16" stop-opacity=".86" />
        <stop offset="1" stop-color="#071f2d" stop-opacity="0" />
      </linearGradient>
      <g id="bench">
        <path d="M220 12h805v18H220Z" fill="url(#bench-shadow)" />
        <path d="M220 0h805v14H220Z" fill="url(#bench-grain)" />
      </g>

      <linearGradient id="cap-top" x2="0" y2="1">
        <stop stop-color="#facd84" />
        <stop offset=".12" stop-color="#eba04b" />
        <stop offset=".52" stop-color="#e79c49" />
        <stop offset=".83" stop-color="#e89f4d" />
        <stop offset="1" stop-color="#d0863b" />
      </linearGradient>
      <linearGradient id="cap-side" x2="0" y2="1">
        <stop stop-color="#f8cc82" />
        <stop offset=".69" stop-color="#9e5d25" />
        <stop offset="1" stop-color="#6e3d12" />
      </linearGradient>
      <g id="end-cap">
        <rect x="-3" y="-2" width="86" height="73" rx="13" fill="#091a22" />
        <rect width="80" height="67" rx="10" fill="url(#cap-side)" />
        <rect x="4" y="4" width="72" height="53" rx="6" fill="url(#cap-top)" stroke="#facd84" stroke-width="2.5" />
      </g>
    </defs>

    <use href="#hull" fill="url(#rail)" stroke="#102128" stroke-width="6" />
    <use href="#hull" fill="none" stroke="#9a6e42" stroke-width="2" transform="translate(5.6 5.7) scale(.991)" />
    <use href="#hull" fill="none" stroke="#f8d696" stroke-width="3" opacity=".5" transform="translate(11.8 12.1) scale(.981)" />
    <use href="#deck" fill="none" stroke="#facc8a" stroke-width="32" />
    <use href="#deck" fill="none" stroke="url(#bevel)" stroke-width="28" />
    <use href="#deck" fill="url(#floor)" />

    <g clip-path="url(#inside)">
      <path d="M286 80v1120m70-1120v1120m76-1120v1120m58-1120v1120m62-1120v1120m76-1120v1120m65-1120v1120m62-1120v1120m67-1120v1120m75-1120v1120m61-1120v1120" fill="none" stroke="#06283b" stroke-width="2.5" opacity=".83" />
      {rows === 2 ? <use href="#bench" y="624" /> : <>
        <use href="#bench" y="476" />
        <use href="#bench" y="774" />
      </>}
      <use href="#deck" fill="none" stroke="#031828" stroke-width="18" opacity=".83" filter="url(#inner-shadow)" />
    </g>
    <use href="#deck" fill="none" stroke="#212220" stroke-width="4" />

    <use href="#end-cap" x="586" y="16" />
    <use href="#end-cap" transform="translate(588 1186) scale(.91 .82)" />
  </svg>;
}
