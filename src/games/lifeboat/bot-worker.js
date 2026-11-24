import { chooseBotAction } from "./bot.js";

self.onmessage = ({ data: { step, view, treeSearch } }) => {
  try {
    self.postMessage({ step, action: chooseBotAction(view, { treeSearch }) });
  } catch {
    self.postMessage({ step, error: true });
  }
};
