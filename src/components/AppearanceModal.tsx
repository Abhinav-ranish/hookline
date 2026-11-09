"use client";

import { useRef, useState } from "react";
import { ImagePlus, Minus, Monitor, Moon, Palette, Plus, RefreshCw, Sun } from "lucide-react";
import { applyAppearance, generateWallpaper, loadAppearance, OVERLAYS, saveAppearance, wallpaperFromFile, WALLPAPERS, type Appearance, type CustomWallpaper } from "@/lib/appearance";
import { Modal, Switch } from "./Modal";

const THEMES = [
  { id: "system", label: "System", icon: Monitor },
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
] as const;

const ACCENTS = ["#4f6ef7", "#7a3ff2", "#e0559a", "#e5484d", "#ee8a2a", "#2aa876", "#14a3c7"];

function MiniApp({ theme }: { theme: "system" | "light" | "dark" }) {
  return (
    <div className={`mini mini-${theme}`} aria-hidden>
      <span className="mini-side" />
      <span className="mini-main"><i /><b /><b /></span>
      {theme === "system" && <span className="mini-half"><span className="mini-side" /><span className="mini-main"><i /><b /><b /></span></span>}
    </div>
  );
}

export function AppearanceModal({ onClose }: { onClose: () => void }) {
  const [{ appearance: start, image: startImage }] = useState(loadAppearance);
  const [draft, setDraft] = useState<Appearance>(start);
  const [image, setImage] = useState<CustomWallpaper | null>(startImage);
  const [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null);

  const change = (next: Partial<Appearance>, nextImage: CustomWallpaper | null = image) => {
    const merged = { ...draft, ...next };
    setDraft(merged);
    setImage(nextImage);
    setError("");
    applyAppearance(merged, nextImage);
  };

  const cancel = () => {
    applyAppearance();
    onClose();
  };

  const save = () => {
    if (saveAppearance(draft, image)) onClose();
    else setError("That image is too large to store. Try a smaller one.");
  };

  const addImage = async (selected: File | undefined) => {
    if (!selected) return;
    try {
      change({ wallpaper: "custom", bg: true }, await wallpaperFromFile(selected));
    } catch {
      setError("Couldn't read that image.");
    }
  };

  const preview = draft.wallpaper === "custom" ? image?.url : `/backgrounds/${draft.wallpaper}-thumb.jpg`;

  return (
    <Modal
      title="Appearance"
      icon={<Palette size={19} />}
      onClose={cancel}
      className="appearance"
      footer={
        <>
          {error && <p className="modal-error" role="alert">{error}</p>}
          <button className="btn" onClick={cancel}>Cancel</button>
          <button className="btn btn-solid" onClick={save}>Save changes</button>
        </>
      }
    >
      <section className="setting-block">
        <h3>Interface theme</h3>
        <p>Choose how Hookline looks.</p>
        <div className="themes">
          {THEMES.map(({ id, label, icon: Icon }) => (
            <button key={id} className={draft.theme === id ? "theme is-on" : "theme"} aria-pressed={draft.theme === id} onClick={() => change({ theme: id })}>
              <MiniApp theme={id} />
              <span><Icon size={15} />{label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="setting-block">
        <div className="setting-row">
          <div>
            <h3>Background</h3>
            <p>Put a wallpaper behind everything.</p>
          </div>
          <Switch label="Background" checked={draft.bg} onChange={(bg) => change({ bg })} />
        </div>

        {draft.bg && (
          <div className="bg-editor">
            <div className="bg-preview-col">
              <div className="bg-preview" style={{ backgroundImage: preview ? `url("${preview}")` : undefined }} />
              <button className="btn btn-wide" onClick={() => file.current?.click()}><ImagePlus size={15} />Add image</button>
              <input ref={file} type="file" accept="image/*" hidden onChange={(event) => { void addImage(event.target.files?.[0]); event.target.value = ""; }} />
            </div>
            <div className="bg-options">
              <div className="bg-option">
                <span>Auto-generate background</span>
                <button className="btn btn-small" onClick={() => change({ wallpaper: "custom", bg: true }, generateWallpaper(document.documentElement.dataset.theme === "dark"))}><RefreshCw size={14} />Generate</button>
              </div>
              <div className="bg-option">
                <span>Overlay</span>
                <div className="swatches">
                  <button className={draft.overlay === null ? "swatch swatch-none is-on" : "swatch swatch-none"} aria-label="No overlay" aria-pressed={draft.overlay === null} onClick={() => change({ overlay: null })}><Minus size={13} /></button>
                  {OVERLAYS.map((color) => (
                    <button key={color} className={draft.overlay === color ? "swatch is-on" : "swatch"} style={{ background: color }} aria-label={`Overlay ${color}`} aria-pressed={draft.overlay === color} onClick={() => change({ overlay: color })} />
                  ))}
                  <label className="swatch swatch-none" aria-label="Custom overlay color">
                    <Plus size={13} />
                    <input type="color" value={draft.overlay ?? "#5b5bf0"} onChange={(event) => change({ overlay: event.target.value })} />
                  </label>
                </div>
              </div>
              <div className="bg-option">
                <span>Blur</span>
                <Switch label="Blur" checked={draft.blur} onChange={(blur) => change({ blur })} />
              </div>
              <div className="bg-option">
                <span>Apply behind sidebar</span>
                <Switch label="Apply behind sidebar" checked={draft.applyAll} onChange={(applyAll) => change({ applyAll })} />
              </div>
            </div>
          </div>
        )}

        {draft.bg &&
          Object.entries(WALLPAPERS).map(([group, items]) => (
            <div key={group} className="gallery">
              <h4>{group}</h4>
              <div className="gallery-grid">
                {items.map((item) => (
                  <button key={item.id} className={draft.wallpaper === item.id ? "gallery-item is-on" : "gallery-item"} aria-label={item.label} aria-pressed={draft.wallpaper === item.id} onClick={() => change({ wallpaper: item.id })}>
                    <img src={`/backgrounds/${item.id}-thumb.jpg`} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            </div>
          ))}
      </section>

      <section className="setting-block">
        <div className="setting-row">
          <div>
            <h3>Chat color</h3>
            <p>Change the accent used for buttons and highlights.</p>
          </div>
          <Switch label="Chat color" checked={draft.chatColor} onChange={(chatColor) => change({ chatColor })} />
        </div>
        {draft.chatColor && (
          <div className="swatches accents">
            {ACCENTS.map((color) => (
              <button key={color} className={draft.accent === color ? "swatch is-on" : "swatch"} style={{ background: color }} aria-label={`Accent ${color}`} aria-pressed={draft.accent === color} onClick={() => change({ accent: color })} />
            ))}
          </div>
        )}
      </section>
    </Modal>
  );
}
