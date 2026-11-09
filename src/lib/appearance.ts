export type Appearance = {
  theme: "system" | "light" | "dark";
  bg: boolean;
  wallpaper: string;
  overlay: string | null;
  blur: boolean;
  applyAll: boolean;
  chatColor: boolean;
  accent: string;
};

export type CustomWallpaper = { url: string; tone: "light" | "dark" };

export const APPEARANCE_KEY = "hookline.appearance";
export const WALLPAPER_KEY = "hookline.wallpaper";

export const DEFAULT_APPEARANCE: Appearance = {
  theme: "system",
  bg: true,
  wallpaper: "alpine",
  overlay: null,
  blur: true,
  applyAll: true,
  chatColor: false,
  accent: "#4f6ef7",
};

export const WALLPAPERS = {
  Landscape: [
    { id: "alpine", label: "Alpine" },
    { id: "dune", label: "Dune" },
    { id: "peak", label: "Peak" },
    { id: "canyon", label: "Canyon" },
  ],
  Abstract: [
    { id: "indigo", label: "Indigo" },
    { id: "ember", label: "Ember" },
    { id: "silk", label: "Silk" },
    { id: "contour", label: "Contour" },
  ],
};

export const OVERLAYS = ["#5b5bf0", "#f2c14e", "#3fc1f0", "#7a1fd1", "#e5484d", "#46c46b", "#6b6b6b"];

/**
 * Applies saved or draft appearance to the page. Also runs as an inline script
 * before first paint, so it must stay self-contained: no imports or outer variables.
 */
export function applyAppearance(draft?: Appearance | null, draftImage?: CustomWallpaper | null) {
  var root = document.documentElement;
  var a: any = draft;
  var image: any = draftImage;
  try {
    if (!a) a = JSON.parse(localStorage.getItem("hookline.appearance") || "null");
    if (image === undefined) image = JSON.parse(localStorage.getItem("hookline.wallpaper") || "null");
  } catch (e) {}
  a = Object.assign({ theme: "system", bg: true, wallpaper: "alpine", overlay: null, blur: true, applyAll: true, chatColor: false, accent: "#4f6ef7" }, a || {});
  var dark = a.theme === "dark" || (a.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  var theme = dark ? "dark" : "light";
  var tones: Record<string, string> = { alpine: "light", dune: "dark", peak: "dark", canyon: "dark", indigo: "dark", ember: "light", silk: "light", contour: "dark" };
  var custom = a.wallpaper === "custom";
  var url = custom ? image && image.url : "/backgrounds/" + a.wallpaper + ".jpg";
  var tone = custom ? image && image.tone : tones[a.wallpaper];
  // Text sits directly on the wallpaper, so a wallpaper that fights the theme gets a much stronger veil.
  var veil = (tone === theme ? (dark ? 0.42 : 0.22) : dark ? 0.68 : 0.76) + (a.blur ? 0 : 0.1);
  root.dataset.theme = theme;
  root.dataset.wall = a.bg && url ? (a.applyAll ? "all" : "main") : "off";
  root.dataset.wallBlur = a.blur ? "on" : "off";
  root.style.setProperty("--wall-image", url ? 'url("' + url + '")' : "none");
  root.style.setProperty("--wall-veil", String(veil));
  root.style.setProperty("--wall-tint", a.overlay || "transparent");
  if (a.chatColor) root.style.setProperty("--accent", a.accent);
  else root.style.removeProperty("--accent");
}

export function loadAppearance(): { appearance: Appearance; image: CustomWallpaper | null } {
  try {
    return {
      appearance: { ...DEFAULT_APPEARANCE, ...JSON.parse(localStorage.getItem(APPEARANCE_KEY) || "{}") },
      image: JSON.parse(localStorage.getItem(WALLPAPER_KEY) || "null"),
    };
  } catch {
    return { appearance: DEFAULT_APPEARANCE, image: null };
  }
}

/** Returns false when the browser refused to store it, usually because an image was too large. */
export function saveAppearance(appearance: Appearance, image: CustomWallpaper | null) {
  try {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance));
    if (image) localStorage.setItem(WALLPAPER_KEY, JSON.stringify(image));
    return true;
  } catch {
    return false;
  }
}

function toneOf(canvas: HTMLCanvasElement): "light" | "dark" {
  const { data } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
  let total = 0;
  const step = 4 * 97;
  for (let i = 0; i < data.length; i += step) total += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  return total / (data.length / step) > 140 ? "light" : "dark";
}

const finish = (canvas: HTMLCanvasElement): CustomWallpaper => ({ url: canvas.toDataURL("image/jpeg", 0.8), tone: toneOf(canvas) });

export async function wallpaperFromFile(file: File): Promise<CustomWallpaper> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return finish(canvas);
}

export function generateWallpaper(dark: boolean): CustomWallpaper {
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 1000;
  const ctx = canvas.getContext("2d")!;
  const hue = Math.random() * 360;
  ctx.fillStyle = `hsl(${hue} 45% ${dark ? 9 : 88}%)`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.filter = "blur(90px)";
  for (let i = 0; i < 7; i++) {
    const shift = hue + (Math.random() - 0.5) * 110;
    ctx.fillStyle = `hsl(${shift} ${55 + Math.random() * 35}% ${dark ? 22 + Math.random() * 30 : 62 + Math.random() * 26}%)`;
    ctx.beginPath();
    ctx.ellipse(Math.random() * 1600, Math.random() * 1000, 180 + Math.random() * 420, 120 + Math.random() * 300, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  return finish(canvas);
}
