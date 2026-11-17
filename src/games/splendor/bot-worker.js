import { chooseBotAction } from "./bot.js";

self.onmessage = ({ data: { view, mode } }) => {
  try {
    self.postMessage({ action: chooseBotAction(view, mode) });
  } catch {
    self.postMessage({ error: true });
  }
};
