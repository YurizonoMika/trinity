(() => {
  const makeIcon = (path) => {
    if (!path) return "";
    if (String(path).includes("<svg")) return String(path);
    return `<svg viewBox=\"0 0 16 16\" aria-hidden=\"true\" focusable=\"false\">${path}</svg>`;
  };

  const handleButtonKey = (event, onClick) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    if (typeof onClick === "function") onClick(event);
  };

  const createButton = ({ label = "", title = "", iconPath = "", onClick, className = "", disabled = false } = {}) => {
    const button = document.createElement("div");
    button.className = "fxui-btn";
    if (className) {
      button.classList.add(...String(className).split(/\s+/).filter(Boolean));
    }
    button.setAttribute("role", "button");
    button.setAttribute("tabindex", "0");
    button.title = title || label;
    button.setAttribute("aria-disabled", disabled ? "true" : "false");
    button.innerHTML = `${iconPath ? `<span class=\"fxui-btn-icon\">${makeIcon(iconPath)}</span>` : ""}<span>${label}</span>`;

    const ripple = document.createElement("span");
    ripple.className = "fxui-btn-ripple";
    ripple.addEventListener("animationend", () => {
      ripple.classList.remove("is-animating");
    });
    button.appendChild(ripple);
    button.addEventListener("click", (event) => {
      if (button.getAttribute("aria-disabled") === "true") return;
      if (typeof onClick === "function") onClick(event);
    });
    button.addEventListener("pointerdown", (event) => {
      if (button.getAttribute("aria-disabled") === "true") return;
      const rect = button.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2;
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      button.style.setProperty("--fxui-ripple-x", `${x}px`);
      button.style.setProperty("--fxui-ripple-y", `${y}px`);
      button.style.setProperty("--fxui-ripple-size", `${size}px`);
      ripple.classList.remove("is-animating");
      void ripple.offsetWidth;
      ripple.classList.add("is-animating");
    });
    button.addEventListener("keydown", (event) => {
      if (button.getAttribute("aria-disabled") === "true") return;
      handleButtonKey(event, onClick);
    });
    return button;
  };

  const createSlider = ({ label = "", min = 0, max = 100, value = 0, step = 1, onInput = () => {}, formatValue = (val) => String(val), className = "" } = {}) => {
    const wrap = document.createElement("div");
    wrap.className = "fxui-control";
    if (className) {
      wrap.classList.add(...String(className).split(/\s+/).filter(Boolean));
    }

    const header = document.createElement("div");
    header.className = "fxui-control-row";

    const title = document.createElement("span");
    title.className = "fxui-control-label";
    title.textContent = label;

    const valueEl = document.createElement("span");
    valueEl.className = "fxui-control-value";

    header.appendChild(title);
    header.appendChild(valueEl);

    const track = document.createElement("div");
    track.className = "fxui-slider";
    track.setAttribute("role", "slider");
    track.setAttribute("tabindex", "0");
    track.setAttribute("aria-valuemin", String(min));
    track.setAttribute("aria-valuemax", String(max));

    const fill = document.createElement("div");
    fill.className = "fxui-slider-fill";

    const thumb = document.createElement("div");
    thumb.className = "fxui-slider-thumb";

    track.appendChild(fill);
    track.appendChild(thumb);

    const clamp = (val) => Math.min(max, Math.max(min, val));
    const quantize = (val) => {
      const stepped = Math.round(val / step) * step;
      return Number(stepped.toFixed(3));
    };

    let currentValue = clamp(value);

    const setValue = (val, emit = false) => {
      currentValue = clamp(quantize(val));
      const ratio = (currentValue - min) / (max - min || 1);
      fill.style.width = `${ratio * 100}%`;
      thumb.style.left = `${ratio * 100}%`;
      valueEl.textContent = formatValue(currentValue);
      track.setAttribute("aria-valuenow", String(currentValue));
      if (emit) onInput(currentValue);
    };

    const updateFromPointer = (event) => {
      const rect = track.getBoundingClientRect();
      const ratio = rect.width ? (event.clientX - rect.left) / rect.width : 0;
      const clampedRatio = Math.min(1, Math.max(0, ratio));
      const nextValue = min + clampedRatio * (max - min);
      setValue(nextValue, true);
    };

    const onPointerMove = (event) => {
      updateFromPointer(event);
    };

    const onPointerUp = (event) => {
      track.releasePointerCapture(event.pointerId);
      track.removeEventListener("pointermove", onPointerMove);
      track.removeEventListener("pointerup", onPointerUp);
    };

    track.addEventListener("pointerdown", (event) => {
      track.setPointerCapture(event.pointerId);
      updateFromPointer(event);
      track.addEventListener("pointermove", onPointerMove);
      track.addEventListener("pointerup", onPointerUp);
    });

    track.addEventListener("keydown", (event) => {
      let delta = 0;
      if (event.key === "ArrowLeft" || event.key === "ArrowDown") delta = -step;
      if (event.key === "ArrowRight" || event.key === "ArrowUp") delta = step;
      if (event.key === "PageDown") delta = -step * 10;
      if (event.key === "PageUp") delta = step * 10;
      if (!delta) return;
      event.preventDefault();
      setValue(currentValue + delta, true);
    });

    wrap.appendChild(header);
    wrap.appendChild(track);
    setValue(currentValue, false);

    return { root: wrap, setValue, getValue: () => currentValue };
  };

  const createInput = ({ label = "", value = "", placeholder = "", onInput = () => {}, className = "", readOnly = false } = {}) => {
    const wrap = document.createElement("div");
    wrap.className = "fxui-control";
    if (className) {
      wrap.classList.add(...String(className).split(/\s+/).filter(Boolean));
    }

    const header = document.createElement("div");
    header.className = "fxui-control-row";

    const title = document.createElement("span");
    title.className = "fxui-control-label";
    title.textContent = label;

    header.appendChild(title);

    const input = document.createElement("div");
    input.className = "fxui-input";
    input.setAttribute("contenteditable", readOnly ? "false" : "true");
    input.setAttribute("data-placeholder", placeholder);
    input.textContent = value;

    input.addEventListener("input", () => {
      if (readOnly) return;
      onInput(input.textContent || "");
    });

    wrap.appendChild(header);
    wrap.appendChild(input);

    return {
      root: wrap,
      input,
      setValue: (val) => { input.textContent = val || ""; },
      getValue: () => input.textContent || ""
    };
  };

  const createSwitch = ({ label = "", checked = false, onChange = () => {}, className = "" } = {}) => {
    const wrap = document.createElement("div");
    wrap.className = "fxui-control";
    if (className) {
      wrap.classList.add(...String(className).split(/\s+/).filter(Boolean));
    }

    const header = document.createElement("div");
    header.className = "fxui-control-row";

    const title = document.createElement("span");
    title.className = "fxui-control-label";
    title.textContent = label;

    const toggle = document.createElement("div");
    toggle.className = "fxui-switch";
    toggle.setAttribute("role", "switch");
    toggle.setAttribute("tabindex", "0");

    const thumb = document.createElement("div");
    thumb.className = "fxui-switch-thumb";
    toggle.appendChild(thumb);

    const setChecked = (value, emit = false) => {
      const next = Boolean(value);
      toggle.classList.toggle("is-checked", next);
      toggle.setAttribute("aria-checked", next ? "true" : "false");
      if (emit) onChange(next);
    };

    const handleToggle = () => {
      const next = !toggle.classList.contains("is-checked");
      setChecked(next, true);
    };

    toggle.addEventListener("click", handleToggle);
    toggle.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      handleToggle();
    });

    header.appendChild(title);
    header.appendChild(toggle);

    wrap.appendChild(header);
    setChecked(checked, false);

    return { root: wrap, setChecked, getChecked: () => toggle.classList.contains("is-checked") };
  };

  const FxUI = {
    createButton,
    createSlider,
    createInput,
    createSwitch
  };

  window.FxUI = FxUI;

  class FxButtonElement extends HTMLElement {
    connectedCallback() {
      if (this.dataset.fxuiReady) return;
      this.dataset.fxuiReady = "true";
      const label = this.getAttribute("label") || this.textContent.trim();
      const iconPath = this.getAttribute("icon") || "";
      const title = this.getAttribute("title") || label;
      const button = createButton({ label, title, iconPath });
      this.innerHTML = "";
      this.appendChild(button);
    }
  }

  class FxSliderElement extends HTMLElement {
    connectedCallback() {
      if (this.dataset.fxuiReady) return;
      this.dataset.fxuiReady = "true";
      const label = this.getAttribute("label") || "";
      const min = Number(this.getAttribute("min") || 0);
      const max = Number(this.getAttribute("max") || 100);
      const value = Number(this.getAttribute("value") || 0);
      const step = Number(this.getAttribute("step") || 1);
      const slider = createSlider({ label, min, max, value, step, onInput: (val) => {
        this.dispatchEvent(new CustomEvent("change", { detail: val }));
      }});
      this.innerHTML = "";
      this.appendChild(slider.root);
    }
  }

  class FxInputElement extends HTMLElement {
    connectedCallback() {
      if (this.dataset.fxuiReady) return;
      this.dataset.fxuiReady = "true";
      const label = this.getAttribute("label") || "";
      const placeholder = this.getAttribute("placeholder") || "";
      const value = this.getAttribute("value") || "";
      const input = createInput({ label, placeholder, value, onInput: (val) => {
        this.dispatchEvent(new CustomEvent("input", { detail: val }));
      }});
      this.innerHTML = "";
      this.appendChild(input.root);
    }
  }

  class FxSwitchElement extends HTMLElement {
    connectedCallback() {
      if (this.dataset.fxuiReady) return;
      this.dataset.fxuiReady = "true";
      const label = this.getAttribute("label") || "";
      const checked = this.getAttribute("checked") === "true";
      const toggle = createSwitch({ label, checked, onChange: (val) => {
        this.dispatchEvent(new CustomEvent("change", { detail: val }));
      }});
      this.innerHTML = "";
      this.appendChild(toggle.root);
    }
  }

  if (!customElements.get("fx-button")) customElements.define("fx-button", FxButtonElement);
  if (!customElements.get("fx-slider")) customElements.define("fx-slider", FxSliderElement);
  if (!customElements.get("fx-input")) customElements.define("fx-input", FxInputElement);
  if (!customElements.get("fx-switch")) customElements.define("fx-switch", FxSwitchElement);
})();
