const { test, expect } = require("@playwright/test");

async function fillHex(page, value) {
  const input = page.locator("#hexInput");
  await input.fill(value);
  await input.dispatchEvent("input");
}

test("accepts required hex inputs and updates preview text", async ({ page }) => {
  await page.goto("/index.html");

  await fillHex(page, "#FF0000");
  await expect(page.locator("#hexValue")).toHaveText("#FF0000");
  await expect(page.locator("#rgbValue")).toHaveText("rgb(255, 0, 0)");

  await fillHex(page, "#FFFFFF");
  await expect(page.locator("#hexValue")).toHaveText("#FFFFFF");
  await expect(page.locator("#rgbValue")).toHaveText("rgb(255, 255, 255)");

  await fillHex(page, "#00FF00");
  await expect(page.locator("#hexValue")).toHaveText("#00FF00");
  await expect(page.locator("#rgbValue")).toHaveText("rgb(0, 255, 0)");
  await expect(page.locator("#hslValue")).toHaveText("hsl(120, 100%, 50%)");
});

test("normalizes shorthand and missing hash", async ({ page }) => {
  await page.goto("/index.html");

  await fillHex(page, "ff0000");
  await expect(page.locator("#hexValue")).toHaveText("#FF0000");

  await fillHex(page, "#0f0");
  await expect(page.locator("#hexValue")).toHaveText("#00FF00");
  await expect(page.locator("#rgbValue")).toHaveText("rgb(0, 255, 0)");
});

test("keeps partial hex input neutral and rejects invalid input", async ({ page }) => {
  await page.goto("/index.html");

  await fillHex(page, "#00FF00");
  await expect(page.locator("#hexValue")).toHaveText("#00FF00");

  await fillHex(page, "#FF");
  await expect(page.locator("#inputError")).toHaveText("");
  await expect(page.locator("#hexInput")).toHaveClass(/is-partial/);
  await expect(page.locator("#hexValue")).toHaveText("#00FF00");

  await fillHex(page, "#GGGGGG");
  await expect(page.locator("#inputError")).toContainText("请输入有效");
  await expect(page.locator("#hexValue")).toHaveText("#00FF00");

  await page.locator("#hexInput").blur();
  await expect(page.locator("#hexInput")).toHaveValue("#00FF00");
});

test("updates color from rgb inputs with clamping", async ({ page }) => {
  await page.goto("/index.html");

  await page.locator("#rInput").fill("255");
  await page.locator("#rInput").dispatchEvent("input");
  await page.locator("#gInput").fill("255");
  await page.locator("#gInput").dispatchEvent("input");
  await page.locator("#bInput").fill("255");
  await page.locator("#bInput").dispatchEvent("input");
  await expect(page.locator("#hexValue")).toHaveText("#FFFFFF");

  await page.locator("#rInput").fill("300");
  await page.locator("#rInput").blur();
  await page.locator("#gInput").fill("-2");
  await page.locator("#gInput").dispatchEvent("input");
  await page.locator("#gInput").blur();
  await page.locator("#bInput").fill("0");
  await page.locator("#bInput").dispatchEvent("input");
  await expect(page.locator("#hexValue")).toHaveText("#FF0000");
});

test("updates color from hue slider, sv panel and grid", async ({ page }) => {
  await page.goto("/index.html");

  const hueSlider = page.locator("#hueSlider");
  const hueBox = await hueSlider.boundingBox();
  await page.mouse.click(hueBox.x + hueBox.width * 0.35, hueBox.y + hueBox.height / 2);
  await expect(page.locator("#hueLabel")).not.toHaveText("H: 0°");

  const svCanvas = page.locator("#svCanvas");
  const svBox = await svCanvas.boundingBox();
  await page.mouse.click(svBox.x + svBox.width * 0.8, svBox.y + svBox.height * 0.25);
  await expect(page.locator("#rgbValue")).not.toHaveText("rgb(255, 0, 0)");

  const beforeGrid = await page.locator("#hexValue").textContent();
  await page.locator("#gridContainer .swatch-button").nth(0).click();
  await expect(page.locator("#hexValue")).not.toHaveText(beforeGrid);
});

test("switches plane and step without losing current color and shows stronger grid info", async ({ page }) => {
  await page.goto("/index.html");

  await fillHex(page, "#336699");
  await expect(page.locator("#hexValue")).toHaveText("#336699");

  await page.getByRole("button", { name: "RB" }).click();
  await expect(page.locator("#hexValue")).toHaveText("#336699");
  await expect(page.locator("#gridPlaneInfo")).toContainText("固定 G = 102");

  await page.locator('[data-grid-step="1"]').click();
  await expect(page.locator("#hexValue")).toHaveText("#336699");
  await expect(page.locator("#gridDetailInfo")).toContainText("步进 1");
});

test("supports keyboard navigation for hue slider and grid", async ({ page }) => {
  await page.goto("/index.html");

  await page.locator("#hueSlider").focus();
  await page.keyboard.press("PageUp");
  await expect(page.locator("#hueLabel")).not.toHaveText("H: 0°");

  const firstGrid = page.locator("#gridContainer .swatch-button").first();
  await firstGrid.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(page.locator("#hexValue")).not.toHaveText("#FF0000");
});

test("supports favorites, recent controls and theme toggle persistence hooks", async ({ page }) => {
  await page.goto("/index.html");

  await page.locator("#favoriteToggle").click();
  await expect(page.locator("#favoriteColors .recent-swatch")).toHaveCount(1);

  await fillHex(page, "#00FF00");
  await fillHex(page, "#0000FF");
  await page.locator("#recentLimit16").click();
  await expect(page.locator("#recentLimitLabel")).toContainText("16");

  await page.locator("#clearRecentButton").click();
  await expect(page.locator("#recentColors .recent-swatch")).toHaveCount(0);

  await page.locator("#themeToggle").click();
  await expect(page.locator("body")).toHaveAttribute("data-theme", "dark");
});

test("copies extended formats and exposes derived information", async ({ page, context, browserName }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/index.html");

  await page.locator("#copyRgbButton").click();
  if (browserName === "chromium") {
    await expect.poll(async () => page.evaluate(() => navigator.clipboard.readText())).toBe("rgb(255, 0, 0)");
  }

  await expect(page.locator("#contrastWhite")).toBeVisible();
  await expect(page.locator("#generatedPalette .palette-card")).toHaveCount(4);
});

test("degrades eyedropper gracefully when unsupported", async ({ page, browserName }) => {
  await page.goto("/index.html");

  if (browserName !== "chromium") {
    await expect(page.locator("#eyedropperButton")).toBeDisabled();
    return;
  }

  await page.addInitScript(() => {
    class FakeEyeDropper {
      async open() {
        return { sRGBHex: "#123456" };
      }
    }
    window.EyeDropper = FakeEyeDropper;
  });
});

test("renders mobile layout without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/index.html");

  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });

  expect(overflow).toBeFalsy();
  await expect(page.locator("#gridContainer .swatch-button").first()).toBeVisible();
});
