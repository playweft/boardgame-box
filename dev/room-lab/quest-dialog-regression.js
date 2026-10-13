// Pass the real Avalon iframe's Playwright FrameLocator from a browser test.
// Observe live DOM throughout the exit animation, rather than only after unmount.
export async function checkQuestDialogTransitions(frame) {
  const results = [];
  for (const [quest, method] of [[2, "button"], [4, "button"], [3, "Escape"], [5, "button"]]) {
    await frame.getByRole("button", { name: `查看任务 ${quest} 详情`, exact: true }).click();
    await frame.locator('.quest-overlay-track .track-item[aria-selected="true"]').evaluate(async element => {
      let previous, stableFrames = 0;
      const start = Date.now();
      while (Date.now() - start < 1000) {
        const transform = getComputedStyle(element).transform;
        stableFrames = transform === previous ? stableFrames + 1 : 0;
        if (stableFrames >= 3) return;
        previous = transform;
        await new Promise(resolve => setTimeout(resolve, 16));
      }
      throw new Error("选中任务的放大动画未稳定");
    });
    const observation = frame.locator("dialog.quest-overlay").evaluate(async element => {
      const frames = [];
      const start = Date.now();
      while (Date.now() - start < 500) {
        if (element.isConnected) frames.push({
          title: element.querySelector("#quest-dialog-title")?.textContent.trim(),
          content: element.querySelector(".quest-dialog-content")?.textContent.replace(/\s+/g, " ").trim(),
          open: element.hasAttribute("open"), closing: element.classList.contains("is-closing"),
          overlayOpacity: getComputedStyle(element).opacity,
          overlayTransform: getComputedStyle(element).transform,
          navigationOpacity: getComputedStyle(element.querySelector(".quest-overlay-navigation")).opacity,
          selectedScale: Number(getComputedStyle(element.querySelector('.track-item[aria-selected="true"]')).transform.match(/^matrix\(([^,]+)/)?.[1] || 1),
        });
        await new Promise(resolve => setTimeout(resolve, 16));
      }
      return frames;
    });
    const close = frame.getByRole("button", { name: "关闭", exact: true });
    if (method === "Escape") await close.press("Escape");
    else await close.click();
    const frames = await observation;
    const closingFrames = frames.filter(sample => sample.open && sample.closing).length;
    if (!closingFrames) throw new Error(`任务 ${quest}：未观察到关闭动画，不能确认通过`);
    if (frames.some(sample => sample.title !== `任务 ${quest}`) || new Set(frames.map(sample => sample.content)).size !== 1)
      throw new Error(`任务 ${quest}：关闭期间标题或内容发生变化`);
    if (frames.some(sample => sample.overlayOpacity !== "1" || sample.overlayTransform !== "none" || sample.navigationOpacity !== "1"))
      throw new Error(`任务 ${quest}：任务列表随弹层淡出或位移`);
    const scales = frames.filter(sample => sample.open && sample.closing).map(sample => sample.selectedScale);
    if (!scales.some(scale => scale > 1 && scale < frames[0].selectedScale) || scales.at(-1) >= frames[0].selectedScale - 0.05)
      throw new Error(`任务 ${quest}：关闭期间选中任务未平滑复原`);
    await frame.locator("dialog.quest-overlay[open]").waitFor({ state: "hidden" });
    results.push({ quest, method, closingFrames, contentStable: true, scaleRestoredSmoothly: true });
  }
  return results;
}
