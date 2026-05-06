const DEFAULT_RECENT_LIMIT = 10;
const EXTENDED_RECENT_LIMIT = 16;
const DESKTOP_GRID_SIZE = 17;
const MOBILE_GRID_SIZE = 11;
const MOBILE_MEDIA_QUERY = window.matchMedia("(max-width: 760px)");
const STORAGE_KEYS = {
  favorites: "color-picker-favorites",
  recentLimit: "color-picker-recent-limit",
  theme: "color-picker-theme",
};

const elements = {
  colorPreview: document.getElementById("colorPreview"),
  hexValue: document.getElementById("hexValue"),
  rgbValue: document.getElementById("rgbValue"),
  hsvValue: document.getElementById("hsvValue"),
  hslValue: document.getElementById("hslValue"),
  copyButton: document.getElementById("copyButton"),
  copyRgbButton: document.getElementById("copyRgbButton"),
  copyHslButton: document.getElementById("copyHslButton"),
  copyHsvButton: document.getElementById("copyHsvButton"),
  copyFeedback: document.getElementById("copyFeedback"),
  favoriteToggle: document.getElementById("favoriteToggle"),
  favoriteColors: document.getElementById("favoriteColors"),
  exportJsonButton: document.getElementById("exportJsonButton"),
  exportTxtButton: document.getElementById("exportTxtButton"),
  exportCssButton: document.getElementById("exportCssButton"),
  recentColors: document.getElementById("recentColors"),
  recentLimitLabel: document.getElementById("recentLimitLabel"),
  recentLimit10: document.getElementById("recentLimit10"),
  recentLimit16: document.getElementById("recentLimit16"),
  clearRecentButton: document.getElementById("clearRecentButton"),
  generatedPalette: document.getElementById("generatedPalette"),
  contrastWhite: document.getElementById("contrastWhite"),
  contrastBlack: document.getElementById("contrastBlack"),
  readabilitySuggestion: document.getElementById("readabilitySuggestion"),
  hexInput: document.getElementById("hexInput"),
  rInput: document.getElementById("rInput"),
  gInput: document.getElementById("gInput"),
  bInput: document.getElementById("bInput"),
  inputError: document.getElementById("inputError"),
  eyedropperButton: document.getElementById("eyedropperButton"),
  eyedropperFeedback: document.getElementById("eyedropperFeedback"),
  themeToggle: document.getElementById("themeToggle"),
  installButton: document.getElementById("installButton"),
  hueSlider: document.getElementById("hueSlider"),
  hueHandle: document.getElementById("hueHandle"),
  hueLabel: document.getElementById("hueLabel"),
  svCanvas: document.getElementById("svCanvas"),
  svHandle: document.getElementById("svHandle"),
  gridContainer: document.getElementById("gridContainer"),
  gridPlaneInfo: document.getElementById("gridPlaneInfo"),
  gridDetailInfo: document.getElementById("gridDetailInfo"),
  planeModeButtons: Array.from(document.querySelectorAll("[data-plane-mode]")),
  gridStepButtons: Array.from(document.querySelectorAll("[data-grid-step]")),
};

const state = {
  hex: "#FF0000",
  r: 255,
  g: 0,
  b: 0,
  h: 0,
  s: 100,
  v: 100,
  planeMode: "RG",
  gridStep: 8,
  recentColors: [],
  recentLimit: DEFAULT_RECENT_LIMIT,
  favoriteColors: [],
  theme: "light",
  inputValue: "#FF0000",
  inputStatus: "valid",
  inputError: "",
  copyFeedback: "",
  eyedropperFeedback: "",
  gridFocusIndex: 0,
};

const ctx = elements.svCanvas.getContext("2d", { alpha: false });
let copyFeedbackTimer = 0;
let eyedropperFeedbackTimer = 0;
let renderScheduled = false;
let deferredInstallPrompt = null;
let lastHueDrawn = null;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function roundToInt(value) {
  return Math.round(clamp(Number(value) || 0, 0, 255));
}

function componentToHex(value) {
  return roundToInt(value).toString(16).padStart(2, "0").toUpperCase();
}

function rgbToHex(r, g, b) {
  return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`;
}

function normalizeHex(input) {
  if (typeof input !== "string") {
    return null;
  }

  let value = input.trim().toUpperCase();
  if (!value) {
    return null;
  }

  if (!value.startsWith("#")) {
    value = `#${value}`;
  }

  if (/^#[0-9A-F]{3}$/.test(value)) {
    value = `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
  }

  if (!/^#[0-9A-F]{6}$/.test(value)) {
    return null;
  }

  return value;
}

function getHexInputState(input) {
  const raw = String(input ?? "").trim().toUpperCase();

  if (!raw) {
    return { status: "empty", normalized: null };
  }

  const value = raw.startsWith("#") ? raw : `#${raw}`;
  if (!/^#[0-9A-F]*$/.test(value)) {
    return { status: "invalid", normalized: null };
  }

  if (value === "#" || value.length === 2 || value.length === 3 || value.length === 5 || value.length === 6) {
    return { status: "partial", normalized: null };
  }

  const normalized = normalizeHex(value);
  if (normalized) {
    return { status: "valid", normalized };
  }

  return { status: "invalid", normalized: null };
}

function hexToRgb(hex) {
  const normalized = normalizeHex(hex);
  if (!normalized) {
    return null;
  }

  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function rgbToHsv(r, g, b) {
  const red = roundToInt(r) / 255;
  const green = roundToInt(g) / 255;
  const blue = roundToInt(b) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;

  if (delta !== 0) {
    if (max === red) {
      hue = 60 * (((green - blue) / delta) % 6);
    } else if (max === green) {
      hue = 60 * ((blue - red) / delta + 2);
    } else {
      hue = 60 * ((red - green) / delta + 4);
    }
  }

  if (hue < 0) {
    hue += 360;
  }

  return {
    h: Math.round(hue),
    s: Math.round(max === 0 ? 0 : (delta / max) * 100),
    v: Math.round(max * 100),
  };
}

function hsvToRgb(h, s, v) {
  const hue = ((Number(h) % 360) + 360) % 360;
  const saturation = clamp(Number(s) || 0, 0, 100) / 100;
  const value = clamp(Number(v) || 0, 0, 100) / 100;
  const chroma = value * saturation;
  const section = hue / 60;
  const x = chroma * (1 - Math.abs((section % 2) - 1));
  const match = value - chroma;

  let red = 0;
  let green = 0;
  let blue = 0;

  if (section >= 0 && section < 1) {
    red = chroma;
    green = x;
  } else if (section >= 1 && section < 2) {
    red = x;
    green = chroma;
  } else if (section >= 2 && section < 3) {
    green = chroma;
    blue = x;
  } else if (section >= 3 && section < 4) {
    green = x;
    blue = chroma;
  } else if (section >= 4 && section < 5) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }

  return {
    r: Math.round((red + match) * 255),
    g: Math.round((green + match) * 255),
    b: Math.round((blue + match) * 255),
  };
}

function rgbToHsl(r, g, b) {
  const red = roundToInt(r) / 255;
  const green = roundToInt(g) / 255;
  const blue = roundToInt(b) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;
  let hue = 0;
  let saturation = 0;

  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));

    if (max === red) {
      hue = 60 * (((green - blue) / delta) % 6);
    } else if (max === green) {
      hue = 60 * ((blue - red) / delta + 2);
    } else {
      hue = 60 * ((red - green) / delta + 4);
    }
  }

  if (hue < 0) {
    hue += 360;
  }

  return {
    h: Math.round(hue),
    s: Math.round(saturation * 100) || 0,
    l: Math.round(lightness * 100),
  };
}

function formatRgb() {
  return `rgb(${state.r}, ${state.g}, ${state.b})`;
}

function formatHsv() {
  return `hsv(${state.h}, ${state.s}%, ${state.v}%)`;
}

function formatHsl() {
  const hsl = rgbToHsl(state.r, state.g, state.b);
  return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
}

function getGridSize() {
  return MOBILE_MEDIA_QUERY.matches ? MOBILE_GRID_SIZE : DESKTOP_GRID_SIZE;
}

function getPlaneDescription(mode) {
  if (mode === "RG") {
    return `当前平面 RG，固定 B = ${state.b}`;
  }

  if (mode === "RB") {
    return `当前平面 RB，固定 G = ${state.g}`;
  }

  return `当前平面 GB，固定 R = ${state.r}`;
}

function getGridDetailDescription() {
  return `步进 ${state.gridStep}，每格变化 ${state.gridStep} 个通道值。中心格表示围绕当前颜色生成的最近离散色。`;
}

function setInputState(status, message = "") {
  state.inputStatus = status;
  state.inputError = message;
}

function setTimedMessage(key, message, timerRefName, duration = 1600) {
  state[key] = message;
  window.clearTimeout(window[timerRefName]);
  if (message) {
    window[timerRefName] = window.setTimeout(() => {
      state[key] = "";
      scheduleRender();
    }, duration);
  }
}

window.copyFeedbackTimer = copyFeedbackTimer;
window.eyedropperFeedbackTimer = eyedropperFeedbackTimer;

function setCopyFeedback(message) {
  setTimedMessage("copyFeedback", message, "copyFeedbackTimer");
}

function setEyedropperFeedback(message) {
  setTimedMessage("eyedropperFeedback", message, "eyedropperFeedbackTimer", 2200);
}

function loadStoredArray(key) {
  try {
    const value = localStorage.getItem(key);
    if (!value) {
      return [];
    }

    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item) => typeof item === "string" && normalizeHex(item));
  } catch {
    return [];
  }
}

function persistState() {
  try {
    localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(state.favoriteColors));
    localStorage.setItem(STORAGE_KEYS.recentLimit, String(state.recentLimit));
    localStorage.setItem(STORAGE_KEYS.theme, state.theme);
  } catch {
    // Ignore persistence failures to keep the picker usable.
  }
}

function loadStoredState() {
  state.favoriteColors = loadStoredArray(STORAGE_KEYS.favorites);

  const storedLimit = Number(localStorage.getItem(STORAGE_KEYS.recentLimit));
  if (storedLimit === EXTENDED_RECENT_LIMIT) {
    state.recentLimit = EXTENDED_RECENT_LIMIT;
  }

  const storedTheme = localStorage.getItem(STORAGE_KEYS.theme);
  if (storedTheme === "dark" || storedTheme === "light") {
    state.theme = storedTheme;
  }
}

function recordRecentColor(hex) {
  if (state.recentColors[0] === hex) {
    return;
  }

  state.recentColors = [hex, ...state.recentColors.filter((item) => item !== hex)].slice(0, state.recentLimit);
}

function trimRecentColors() {
  state.recentColors = state.recentColors.slice(0, state.recentLimit);
}

function setColorFromRgb(r, g, b, options = {}) {
  const nextR = roundToInt(r);
  const nextG = roundToInt(g);
  const nextB = roundToInt(b);
  const nextHex = rgbToHex(nextR, nextG, nextB);
  const hsv = rgbToHsv(nextR, nextG, nextB);

  state.r = nextR;
  state.g = nextG;
  state.b = nextB;
  state.hex = nextHex;
  state.h = hsv.h;
  state.s = hsv.s;
  state.v = hsv.v;
  state.inputValue = nextHex;
  setInputState("valid", "");

  if (!options.skipHistory) {
    recordRecentColor(nextHex);
  }

  scheduleRender();
}

function setColorFromHex(input, options = {}) {
  const normalized = normalizeHex(input);
  if (!normalized) {
    setInputState("invalid", "请输入 3 位或 6 位十六进制颜色值");
    scheduleRender();
    return false;
  }

  const rgb = hexToRgb(normalized);
  if (!rgb) {
    setInputState("invalid", "请输入有效的十六进制颜色值");
    scheduleRender();
    return false;
  }

  setColorFromRgb(rgb.r, rgb.g, rgb.b, options);
  return true;
}

function setColorFromHsv(h, s, v, options = {}) {
  const rgb = hsvToRgb(h, s, v);
  setColorFromRgb(rgb.r, rgb.g, rgb.b, options);
}

function getRgbInputValues() {
  return {
    r: elements.rInput.value,
    g: elements.gInput.value,
    b: elements.bInput.value,
  };
}

function hasEmptyRgbInput() {
  const { r, g, b } = getRgbInputValues();
  return r === "" || g === "" || b === "" || r === "-" || g === "-" || b === "-";
}

function commitRgbInputs() {
  if (hasEmptyRgbInput()) {
    scheduleRender();
    return;
  }

  setColorFromRgb(elements.rInput.value, elements.gInput.value, elements.bInput.value);
}

function resizeCanvasToDisplaySize() {
  const rect = elements.svCanvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));

  if (elements.svCanvas.width !== width || elements.svCanvas.height !== height) {
    elements.svCanvas.width = width;
    elements.svCanvas.height = height;
  }
}

function drawSvPanel() {
  if (!ctx) {
    return;
  }

  resizeCanvasToDisplaySize();
  if (lastHueDrawn === state.h) {
    return;
  }

  const width = elements.svCanvas.width;
  const height = elements.svCanvas.height;
  const image = ctx.createImageData(width, height);

  for (let y = 0; y < height; y += 1) {
    const value = 100 - (y / Math.max(height - 1, 1)) * 100;

    for (let x = 0; x < width; x += 1) {
      const saturation = (x / Math.max(width - 1, 1)) * 100;
      const rgb = hsvToRgb(state.h, saturation, value);
      const index = (y * width + x) * 4;
      image.data[index] = rgb.r;
      image.data[index + 1] = rgb.g;
      image.data[index + 2] = rgb.b;
      image.data[index + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  lastHueDrawn = state.h;
}

function generateGridColors() {
  const size = getGridSize();
  const half = Math.floor(size / 2);
  const colors = [];
  let selectedIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  const centerIndex = half * size + half;

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const rowDelta = (row - half) * state.gridStep;
      const colDelta = (col - half) * state.gridStep;

      let red = state.r;
      let green = state.g;
      let blue = state.b;

      if (state.planeMode === "RG") {
        red = clamp(state.r + colDelta, 0, 255);
        green = clamp(state.g + rowDelta, 0, 255);
      } else if (state.planeMode === "RB") {
        red = clamp(state.r + colDelta, 0, 255);
        blue = clamp(state.b + rowDelta, 0, 255);
      } else {
        green = clamp(state.g + colDelta, 0, 255);
        blue = clamp(state.b + rowDelta, 0, 255);
      }

      const color = { r: red, g: green, b: blue, hex: rgbToHex(red, green, blue) };
      const distance = Math.abs(color.r - state.r) + Math.abs(color.g - state.g) + Math.abs(color.b - state.b);

      if (distance < bestDistance) {
        bestDistance = distance;
        selectedIndex = colors.length;
      }

      colors.push(color);
    }
  }

  state.gridFocusIndex = clamp(state.gridFocusIndex, 0, colors.length - 1);
  return { colors, selectedIndex, centerIndex, size };
}

function renderGrid() {
  const { colors, selectedIndex, centerIndex, size } = generateGridColors();
  elements.gridContainer.innerHTML = "";
  elements.gridContainer.style.gridTemplateColumns = `repeat(${size}, minmax(28px, 1fr))`;

  colors.forEach((color, index) => {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "swatch-button";
    swatch.style.backgroundColor = color.hex;
    swatch.title = index === centerIndex ? `${color.hex}（中心格）` : color.hex;
    swatch.setAttribute("aria-label", `选择颜色 ${color.hex}`);
    swatch.dataset.hex = color.hex;
    swatch.dataset.index = String(index);
    swatch.tabIndex = index === state.gridFocusIndex ? 0 : -1;

    if (index === selectedIndex) {
      swatch.classList.add("is-selected");
      swatch.setAttribute("aria-pressed", "true");
    } else {
      swatch.setAttribute("aria-pressed", "false");
    }

    if (index === centerIndex) {
      swatch.classList.add("is-center");
    }

    swatch.addEventListener("focus", () => {
      state.gridFocusIndex = index;
    });

    swatch.addEventListener("click", () => {
      state.gridFocusIndex = index;
      setColorFromRgb(color.r, color.g, color.b);
    });

    swatch.addEventListener("keydown", (event) => {
      handleGridKeyboard(event, index, size, color);
    });

    elements.gridContainer.appendChild(swatch);
  });
}

function renderColorCollection(container, colors, currentLabelPrefix) {
  container.innerHTML = "";

  for (const hex of colors) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "recent-swatch";
    button.style.backgroundColor = hex;
    button.title = hex;
    button.setAttribute("aria-label", `${currentLabelPrefix} ${hex}`);

    if (hex === state.hex) {
      button.classList.add("is-selected");
    }

    button.addEventListener("click", () => {
      setColorFromHex(hex);
    });

    container.appendChild(button);
  }
}

function renderRecentColors() {
  renderColorCollection(elements.recentColors, state.recentColors, "恢复最近颜色");
}

function renderFavoriteColors() {
  renderColorCollection(elements.favoriteColors, state.favoriteColors, "恢复收藏颜色");
}

function renderGeneratedPalette() {
  const baseHsl = rgbToHsl(state.r, state.g, state.b);
  const palette = [
    { label: "相近色", color: hsvToRgb(state.h + 20, state.s, state.v) },
    { label: "互补色", color: hsvToRgb(state.h + 180, state.s, state.v) },
    { label: "三角色", color: hsvToRgb(state.h + 120, state.s, state.v) },
    { label: "分裂互补", color: hsvToRgb(state.h + 150, Math.max(state.s - 10, 0), state.v) },
  ];

  elements.generatedPalette.innerHTML = "";
  for (const item of palette) {
    const hex = rgbToHex(item.color.r, item.color.g, item.color.b);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "palette-card";
    card.title = `${item.label} ${hex}`;
    card.innerHTML = `<span class="value-label">${item.label}</span><span class="palette-swatch" style="background:${hex}"></span><strong class="value-code">${hex}</strong>`;
    card.addEventListener("click", () => {
      setColorFromHex(hex);
    });
    elements.generatedPalette.appendChild(card);
  }

  void baseHsl;
}

function getRelativeLuminance(r, g, b) {
  const channel = (value) => {
    const normalized = roundToInt(value) / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function getContrastRatio(rgbA, rgbB) {
  const luminanceA = getRelativeLuminance(rgbA.r, rgbA.g, rgbA.b);
  const luminanceB = getRelativeLuminance(rgbB.r, rgbB.g, rgbB.b);
  const light = Math.max(luminanceA, luminanceB);
  const dark = Math.min(luminanceA, luminanceB);
  return (light + 0.05) / (dark + 0.05);
}

function renderReadability() {
  const whiteContrast = getContrastRatio({ r: state.r, g: state.g, b: state.b }, { r: 255, g: 255, b: 255 });
  const blackContrast = getContrastRatio({ r: state.r, g: state.g, b: state.b }, { r: 0, g: 0, b: 0 });
  elements.contrastWhite.textContent = whiteContrast.toFixed(2);
  elements.contrastBlack.textContent = blackContrast.toFixed(2);
  elements.readabilitySuggestion.textContent = whiteContrast > blackContrast ? "浅色文字" : "深色文字";
}

function renderSelectionHandles() {
  const sliderRect = elements.hueSlider.getBoundingClientRect();
  const normalizedHue = state.h === 360 ? 0 : state.h;
  elements.hueHandle.style.left = `${sliderRect.width * (normalizedHue / 360)}px`;

  const svRect = elements.svCanvas.getBoundingClientRect();
  const x = (state.s / 100) * svRect.width;
  const y = ((100 - state.v) / 100) * svRect.height;
  elements.svHandle.style.left = `${clamp(x, 0, svRect.width)}px`;
  elements.svHandle.style.top = `${clamp(y, 0, svRect.height)}px`;
}

function renderButtons() {
  for (const button of elements.planeModeButtons) {
    const isActive = button.dataset.planeMode === state.planeMode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }

  for (const button of elements.gridStepButtons) {
    const isActive = Number(button.dataset.gridStep) === state.gridStep;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }

  elements.recentLimit10.classList.toggle("is-active", state.recentLimit === DEFAULT_RECENT_LIMIT);
  elements.recentLimit16.classList.toggle("is-active", state.recentLimit === EXTENDED_RECENT_LIMIT);
  elements.favoriteToggle.classList.toggle("is-active", state.favoriteColors.includes(state.hex));
  elements.favoriteToggle.textContent = state.favoriteColors.includes(state.hex) ? "取消收藏" : "加入收藏";
  elements.themeToggle.textContent = state.theme === "dark" ? "浅色模式" : "深色模式";
  elements.eyedropperButton.disabled = !("EyeDropper" in window);
}

function renderInputs() {
  elements.hexInput.value = state.inputValue;
  elements.hexInput.classList.toggle("is-invalid", state.inputStatus === "invalid");
  elements.hexInput.classList.toggle("is-partial", state.inputStatus === "partial");
  elements.rInput.value = document.activeElement === elements.rInput && elements.rInput.value === "" ? "" : String(state.r);
  elements.gInput.value = document.activeElement === elements.gInput && elements.gInput.value === "" ? "" : String(state.g);
  elements.bInput.value = document.activeElement === elements.bInput && elements.bInput.value === "" ? "" : String(state.b);
  elements.inputError.textContent = state.inputError;
}

function renderTheme() {
  document.body.dataset.theme = state.theme;
}

function render() {
  renderScheduled = false;
  elements.colorPreview.style.backgroundColor = state.hex;
  elements.hexValue.textContent = state.hex;
  elements.rgbValue.textContent = formatRgb();
  elements.hsvValue.textContent = formatHsv();
  elements.hslValue.textContent = formatHsl();
  elements.copyFeedback.textContent = state.copyFeedback;
  elements.eyedropperFeedback.textContent = state.eyedropperFeedback;
  elements.hueLabel.textContent = `H: ${state.h}°`;
  elements.hueSlider.setAttribute("aria-valuenow", String(state.h));
  elements.hueSlider.setAttribute("aria-valuetext", `${state.h} 度`);
  elements.gridPlaneInfo.textContent = getPlaneDescription(state.planeMode);
  elements.gridDetailInfo.textContent = getGridDetailDescription();
  elements.recentLimitLabel.textContent = `保留最近 ${state.recentLimit} 个颜色`;

  renderTheme();
  renderInputs();
  drawSvPanel();
  renderSelectionHandles();
  renderButtons();
  renderGrid();
  renderRecentColors();
  renderFavoriteColors();
  renderGeneratedPalette();
  renderReadability();
}

function scheduleRender() {
  if (renderScheduled) {
    return;
  }

  renderScheduled = true;
  window.requestAnimationFrame(render);
}

function updateHueFromClientX(clientX) {
  const rect = elements.hueSlider.getBoundingClientRect();
  const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
  const hue = Math.round(ratio * 360);
  setColorFromHsv(hue === 360 ? 0 : hue, state.s, state.v);
}

function updateSvFromClientPoint(clientX, clientY) {
  const rect = elements.svCanvas.getBoundingClientRect();
  const ratioX = clamp((clientX - rect.left) / rect.width, 0, 1);
  const ratioY = clamp((clientY - rect.top) / rect.height, 0, 1);
  setColorFromHsv(state.h, Math.round(ratioX * 100), Math.round((1 - ratioY) * 100));
}

function bindSliderDrag(target, onMove) {
  let pointerId = null;
  let pendingFrame = 0;
  let lastPoint = null;

  const flushMove = () => {
    pendingFrame = 0;
    if (!lastPoint) {
      return;
    }

    onMove(lastPoint.clientX, lastPoint.clientY);
  };

  target.addEventListener("pointerdown", (event) => {
    pointerId = event.pointerId;
    target.setPointerCapture(pointerId);
    lastPoint = { clientX: event.clientX, clientY: event.clientY };
    flushMove();
  });

  target.addEventListener("pointermove", (event) => {
    if (pointerId !== event.pointerId) {
      return;
    }

    lastPoint = { clientX: event.clientX, clientY: event.clientY };
    if (!pendingFrame) {
      pendingFrame = window.requestAnimationFrame(flushMove);
    }
  });

  const releasePointer = (event) => {
    if (pointerId !== event.pointerId) {
      return;
    }

    if (target.hasPointerCapture(pointerId)) {
      target.releasePointerCapture(pointerId);
    }
    pointerId = null;
  };

  target.addEventListener("pointerup", releasePointer);
  target.addEventListener("pointercancel", releasePointer);
}

function handleHexInput(event) {
  const rawValue = event.target.value.toUpperCase();
  state.inputValue = rawValue;
  const inputState = getHexInputState(rawValue);

  if (inputState.status === "empty") {
    setInputState("empty", "");
    scheduleRender();
    return;
  }

  if (inputState.status === "partial") {
    setInputState("partial", "");
    scheduleRender();
    return;
  }

  if (inputState.status === "invalid") {
    setInputState("invalid", "请输入有效的十六进制颜色值");
    scheduleRender();
    return;
  }

  setColorFromHex(inputState.normalized, { skipHistory: false });
}

function handleHexCommit() {
  if (!state.inputValue.trim()) {
    state.inputValue = state.hex;
    setInputState("valid", "");
    scheduleRender();
    return;
  }

  const inputState = getHexInputState(state.inputValue);
  if (inputState.status === "valid") {
    setColorFromHex(inputState.normalized);
    return;
  }

  if (inputState.status === "partial") {
    const normalized = normalizeHex(state.inputValue);
    if (normalized) {
      setColorFromHex(normalized);
      return;
    }
  }

  state.inputValue = state.hex;
  setInputState("valid", "");
  scheduleRender();
}

function handleRgbInput(event) {
  const sanitized = event.target.value.replace(/(?!^-)[^\d]/g, "");
  event.target.value = sanitized.startsWith("-") ? `-${sanitized.slice(1).replace(/-/g, "")}` : sanitized;
  if (hasEmptyRgbInput()) {
    event.target.classList.add("is-partial");
    return;
  }

  elements.rInput.classList.remove("is-partial");
  elements.gInput.classList.remove("is-partial");
  elements.bInput.classList.remove("is-partial");
  commitRgbInputs();
}

function handleRgbBlur(event) {
  event.target.classList.remove("is-partial");
  if (event.target.value === "") {
    scheduleRender();
    return;
  }

  event.target.value = String(roundToInt(event.target.value));
  commitRgbInputs();
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    setCopyFeedback("已复制到剪贴板");
  } catch {
    setCopyFeedback("复制失败，请手动复制");
  }

  scheduleRender();
}

function toggleFavorite() {
  if (state.favoriteColors.includes(state.hex)) {
    state.favoriteColors = state.favoriteColors.filter((hex) => hex !== state.hex);
  } else {
    state.favoriteColors = [state.hex, ...state.favoriteColors.filter((hex) => hex !== state.hex)];
  }

  persistState();
  scheduleRender();
}

function setRecentLimit(limit) {
  state.recentLimit = limit;
  trimRecentColors();
  persistState();
  scheduleRender();
}

function exportPalette(format) {
  const payload = state.favoriteColors.length > 0 ? state.favoriteColors : state.recentColors;
  const colors = payload.map((hex) => {
    const rgb = hexToRgb(hex);
    const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    return { hex, rgb: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`, hsv: `hsv(${hsv.h}, ${hsv.s}%, ${hsv.v}%)`, hsl: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` };
  });

  let content = "";
  let fileName = "palette";
  let mimeType = "text/plain;charset=utf-8";

  if (format === "json") {
    content = JSON.stringify(colors, null, 2);
    fileName = "palette.json";
    mimeType = "application/json;charset=utf-8";
  } else if (format === "css") {
    content = `:root {\n${colors.map((item, index) => `  --palette-${index + 1}: ${item.hex};`).join("\n")}\n}`;
    fileName = "palette.css";
    mimeType = "text/css;charset=utf-8";
  } else {
    content = colors.map((item) => `${item.hex} | ${item.rgb} | ${item.hsl} | ${item.hsv}`).join("\n");
    fileName = "palette.txt";
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

async function pickColorFromScreen() {
  if (!("EyeDropper" in window)) {
    setEyedropperFeedback("当前浏览器不支持吸管取色");
    scheduleRender();
    return;
  }

  try {
    const eyeDropper = new window.EyeDropper();
    const result = await eyeDropper.open();
    setColorFromHex(result.sRGBHex);
    setEyedropperFeedback("已读取屏幕颜色");
  } catch {
    setEyedropperFeedback("已取消或暂时无法取色");
    scheduleRender();
  }
}

function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  persistState();
  scheduleRender();
}

function handleGridKeyboard(event, index, size, color) {
  const step = event.shiftKey ? 2 : 1;
  let nextIndex = index;

  if (event.key === "ArrowLeft") {
    nextIndex = index - step;
  } else if (event.key === "ArrowRight") {
    nextIndex = index + step;
  } else if (event.key === "ArrowUp") {
    nextIndex = index - size * step;
  } else if (event.key === "ArrowDown") {
    nextIndex = index + size * step;
  } else if (event.key === "Home") {
    nextIndex = 0;
  } else if (event.key === "End") {
    nextIndex = size * size - 1;
  } else if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    setColorFromRgb(color.r, color.g, color.b);
    return;
  } else {
    return;
  }

  event.preventDefault();
  state.gridFocusIndex = clamp(nextIndex, 0, size * size - 1);
  scheduleRender();
  window.requestAnimationFrame(() => {
    const nextButton = elements.gridContainer.querySelector(`[data-index="${state.gridFocusIndex}"]`);
    if (nextButton) {
      nextButton.focus();
    }
  });
}

function setupThemeInstallAndPwa() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      // Ignore registration failures and keep the page usable.
    });
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    elements.installButton.hidden = false;
  });

  elements.installButton.addEventListener("click", async () => {
    if (!deferredInstallPrompt) {
      return;
    }

    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice.catch(() => null);
    deferredInstallPrompt = null;
    elements.installButton.hidden = true;
  });
}

function setupEvents() {
  elements.hexInput.addEventListener("input", handleHexInput);
  elements.hexInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      handleHexCommit();
    }
  });
  elements.hexInput.addEventListener("blur", handleHexCommit);

  [elements.rInput, elements.gInput, elements.bInput].forEach((input) => {
    input.addEventListener("input", handleRgbInput);
    input.addEventListener("blur", handleRgbBlur);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        commitRgbInputs();
      }
    });
  });

  elements.copyButton.addEventListener("click", () => copyText(state.hex));
  elements.copyRgbButton.addEventListener("click", () => copyText(formatRgb()));
  elements.copyHslButton.addEventListener("click", () => copyText(formatHsl()));
  elements.copyHsvButton.addEventListener("click", () => copyText(formatHsv()));
  elements.favoriteToggle.addEventListener("click", toggleFavorite);
  elements.exportJsonButton.addEventListener("click", () => exportPalette("json"));
  elements.exportTxtButton.addEventListener("click", () => exportPalette("txt"));
  elements.exportCssButton.addEventListener("click", () => exportPalette("css"));
  elements.recentLimit10.addEventListener("click", () => setRecentLimit(DEFAULT_RECENT_LIMIT));
  elements.recentLimit16.addEventListener("click", () => setRecentLimit(EXTENDED_RECENT_LIMIT));
  elements.clearRecentButton.addEventListener("click", () => {
    state.recentColors = [];
    scheduleRender();
  });
  elements.eyedropperButton.addEventListener("click", pickColorFromScreen);
  elements.themeToggle.addEventListener("click", toggleTheme);

  bindSliderDrag(elements.hueSlider, (clientX) => {
    updateHueFromClientX(clientX);
  });

  bindSliderDrag(elements.svCanvas, (clientX, clientY) => {
    updateSvFromClientPoint(clientX, clientY);
  });

  elements.hueSlider.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 10 : 1;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      setColorFromHsv(state.h - step, state.s, state.v);
    } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      setColorFromHsv(state.h + step, state.s, state.v);
    } else if (event.key === "Home") {
      event.preventDefault();
      setColorFromHsv(0, state.s, state.v);
    } else if (event.key === "End") {
      event.preventDefault();
      setColorFromHsv(359, state.s, state.v);
    } else if (event.key === "PageDown") {
      event.preventDefault();
      setColorFromHsv(state.h - 30, state.s, state.v);
    } else if (event.key === "PageUp") {
      event.preventDefault();
      setColorFromHsv(state.h + 30, state.s, state.v);
    }
  });

  for (const button of elements.planeModeButtons) {
    button.addEventListener("click", () => {
      state.planeMode = button.dataset.planeMode;
      scheduleRender();
    });
  }

  for (const button of elements.gridStepButtons) {
    button.addEventListener("click", () => {
      state.gridStep = Number(button.dataset.gridStep);
      scheduleRender();
    });
  }

  window.addEventListener("resize", () => {
    lastHueDrawn = null;
    scheduleRender();
  });
  MOBILE_MEDIA_QUERY.addEventListener("change", () => {
    scheduleRender();
  });
}

function runSelfChecks() {
  const checks = [
    rgbToHex(255, 0, 0) === "#FF0000",
    rgbToHex(255, 255, 255) === "#FFFFFF",
    rgbToHex(0, 255, 0) === "#00FF00",
    normalizeHex("ff0000") === "#FF0000",
    normalizeHex("#0F0") === "#00FF00",
    JSON.stringify(hexToRgb("#FF0000")) === JSON.stringify({ r: 255, g: 0, b: 0 }),
    getHexInputState("#FF").status === "partial",
    rgbToHsl(255, 0, 0).l === 50,
  ];

  if (checks.includes(false)) {
    console.error("颜色转换自检失败");
  }
}

function init() {
  runSelfChecks();
  loadStoredState();
  if (!ctx) {
    setInputState("invalid", "当前浏览器不支持 2D 画布，无法显示 HSV 面板");
  }

  recordRecentColor(state.hex);
  setupEvents();
  setupThemeInstallAndPwa();
  scheduleRender();
}

init();
