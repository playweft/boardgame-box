import { chooseBotAction } from "./bot.js";

self.onmessage = ({ data: { step, view } }) => {
  try {
    self.postMessage({ step, action: chooseBotAction(view) });
  } catch {
    self.postMessage({ step, error: true });
  }
};
