import "../../shared/game-theme.css";
import "./style.css";
import { h, render } from "preact";
import Rules from "./rules.jsx";
import { locale, t } from "./i18n.js";

document.documentElement.lang = locale;
document.title = t("rules.pageTitle");
document.querySelector(".help-page-header h1").textContent = document.title;

render(h(Rules), document.querySelector("main"));
