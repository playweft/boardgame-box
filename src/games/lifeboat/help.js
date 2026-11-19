import "../../shared/game-theme.css";
import "./style.css";
import { h, render } from "preact";
import Rules from "./rules.jsx";

render(h(Rules), document.querySelector("main"));
