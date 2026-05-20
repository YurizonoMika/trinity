(function () {
  const desktop = document.querySelector(".stage");
  if (!desktop) return;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const rightMenuApi = window.RightMenuAPI;

  const ensureLayer = () => {
    return desktop;
  };

  const ensureStatusCenter = () => {
    return document.getElementById("statusCenter");
  };

  let statusMenuTarget = null;
  const statusMenu = rightMenuApi?.create({
    className: "status-app-menu",
    getItems: (target) => [
      { label: "最小化", action: "minimize" },
      { label: "最大化", action: "maximize", hidden: !!target?.maximized },
      { label: "还原", action: "restore", hidden: !(target?.maximized || target?.minimized) },
      { label: "关闭", action: "close" }
    ],
    onSelect: (action) => {
      if (!action || !statusMenuTarget) return;
      if (action === "minimize") {
        statusMenuTarget.minimize();
      }
      if (action === "maximize") {
        statusMenuTarget.toggleMaximize();
      }
      if (action === "restore") {
        if (statusMenuTarget.minimized) {
          statusMenuTarget.restore();
        } else if (statusMenuTarget.maximized) {
          statusMenuTarget.toggleMaximize();
        }
      }
      if (action === "close") {
        statusMenuTarget.close();
      }
      statusMenuTarget = null;
    }
  });

  const showStatusMenu = (x, y, target) => {
    statusMenuTarget = target;
    statusMenu?.show({ x, y: Math.max(8, y - 8), context: target });
  };

  const hideStatusMenu = () => {
    statusMenu?.hide();
    statusMenuTarget = null;
  };

  class AppWindow {
    constructor(options) {
      this.options = options;
      this.layer = ensureLayer();
      this.statusCenter = ensureStatusCenter();
      this.windowEl = this.createWindow();
      this.zIndex = 5;
      this.minimized = false;
      this.maximized = false;
      this.prevRect = null;
      this.statusIcon = null;
      this.ensureStatusIcon();
      this.focus();
    }

    resolveIcon() {
      if (this.options.icon) return this.options.icon;
      if (!this.options.appPath) return "";
      return `${this.options.appPath}/ico.svg`;
    }

    createWindow() {
      const windowEl = document.createElement("div");
      windowEl.className = "app-window";
      this.windowEl = windowEl;
      if (this.options.resizable === false) {
        windowEl.classList.add("no-resize");
      }

      const header = document.createElement("div");
      header.className = "app-window-header";

      const title = document.createElement("div");
      title.className = "app-window-title";
      const titleIcon = document.createElement("img");
      titleIcon.className = "app-window-title-icon";
      const resolvedIcon = this.resolveIcon();
      if (resolvedIcon) {
        titleIcon.src = resolvedIcon;
        titleIcon.alt = "";
        titleIcon.addEventListener("error", () => {
          if (titleIcon.src.endsWith("/ico.svg")) {
            titleIcon.src = titleIcon.src.replace("/ico.svg", "/ico.png");
          }
        }, { once: true });
        title.appendChild(titleIcon);
      }
      const titleText = document.createElement("span");
      titleText.className = "app-window-title-text";
      titleText.textContent = this.options.title || "Window";
      title.appendChild(titleText);

      const controls = document.createElement("div");
      controls.className = "app-window-controls";

      const minimizeBtn = document.createElement("button");
      minimizeBtn.className = "app-window-btn";
      minimizeBtn.type = "button";
      minimizeBtn.textContent = "–";

      const maximizeBtn = document.createElement("button");
      maximizeBtn.className = "app-window-btn";
      maximizeBtn.type = "button";
      maximizeBtn.textContent = "□";
      if (this.options.maximizable === false) {
        maximizeBtn.disabled = true;
      }

      const closeBtn = document.createElement("button");
      closeBtn.className = "app-window-btn";
      closeBtn.type = "button";
      closeBtn.textContent = "×";

      controls.appendChild(minimizeBtn);
      controls.appendChild(maximizeBtn);
      controls.appendChild(closeBtn);
      header.appendChild(title);
      header.appendChild(controls);

      const body = document.createElement("div");
      body.className = "app-window-body";
      if (typeof this.options.content === "string") {
        body.innerHTML = this.options.content;
      } else if (this.options.content instanceof HTMLElement) {
        body.appendChild(this.options.content);
      }

      const resizeHandle = document.createElement("div");
      resizeHandle.className = "app-window-resize";

      windowEl.appendChild(header);
      windowEl.appendChild(body);
      windowEl.appendChild(resizeHandle);
      this.layer.appendChild(windowEl);

      requestAnimationFrame(() => {
        windowEl.getBoundingClientRect();
        windowEl.classList.add("is-ready");
      });

      const rect = this.options.rect || { width: 320, height: 220, x: 80, y: 60 };
      this.setRect(rect);

      this.bindDrag(header);
      this.bindResize(resizeHandle);

      minimizeBtn.addEventListener("click", () => this.minimize());
      maximizeBtn.addEventListener("click", () => this.toggleMaximize());
      closeBtn.addEventListener("click", () => this.close());

      windowEl.addEventListener("mousedown", () => this.focus());
      windowEl.addEventListener("touchstart", () => this.focus(), { passive: true });

      return windowEl;
    }

    focus() {
      if (AppWindow.zCounter >= AppWindow.maxZIndex) {
        AppWindow.rebaseZIndexes();
      }
      AppWindow.zCounter += 1;
      this.zIndex = AppWindow.zCounter;
      this.windowEl.style.zIndex = String(this.zIndex);
      this.windowEl.classList.remove("is-blurred");
    }

    blur() {
      this.windowEl.classList.add("is-blurred");
    }

    setRect(rect) {
      this.windowEl.style.width = `${rect.width}px`;
      this.windowEl.style.height = `${rect.height}px`;
      this.windowEl.style.left = `${rect.x}px`;
      this.windowEl.style.top = `${rect.y}px`;
      this.rect = { ...rect };
    }

    getRect() {
      return { ...this.rect };
    }

    bindDrag(handle) {
      let dragging = false;
      let startX = 0;
      let startY = 0;
      let startRect = null;

      const onMove = (clientX, clientY) => {
        if (!dragging || !startRect) return;
        const deltaX = clientX - startX;
        const deltaY = clientY - startY;
        const maxX = desktop.clientWidth - startRect.width;
        const maxY = desktop.clientHeight - startRect.height;
        this.setRect({
          width: startRect.width,
          height: startRect.height,
          x: clamp(startRect.x + deltaX, 0, maxX),
          y: clamp(startRect.y + deltaY, 0, maxY)
        });
      };

      const stopDrag = () => {
        dragging = false;
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", stopDrag);
        window.removeEventListener("touchmove", onTouchMove);
        window.removeEventListener("touchend", stopDrag);
      };

      const onMouseMove = (event) => {
        onMove(event.clientX, event.clientY);
      };

      const onTouchMove = (event) => {
        const touch = event.touches[0];
        if (!touch) return;
        onMove(touch.clientX, touch.clientY);
      };

      handle.addEventListener("mousedown", (event) => {
        if (event.button !== 0) return;
        if (this.maximized) return;
        if (event.target.closest(".app-window-controls")) return;
        event.preventDefault();
        dragging = true;
        startX = event.clientX;
        startY = event.clientY;
        startRect = this.getRect();
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", stopDrag);
      });

      handle.addEventListener("touchstart", (event) => {
        if (this.maximized) return;
        if (event.target.closest(".app-window-controls")) return;
        const touch = event.touches[0];
        if (!touch) return;
        dragging = true;
        startX = touch.clientX;
        startY = touch.clientY;
        startRect = this.getRect();
        window.addEventListener("touchmove", onTouchMove, { passive: true });
        window.addEventListener("touchend", stopDrag);
      });
    }

    bindResize(handle) {
      let resizing = false;
      let startX = 0;
      let startY = 0;
      let startRect = null;

      const onResizeMove = (clientX, clientY) => {
        if (!resizing || !startRect) return;
        const deltaX = clientX - startX;
        const deltaY = clientY - startY;
        const maxWidth = desktop.clientWidth - startRect.x;
        const maxHeight = desktop.clientHeight - startRect.y;
        const width = clamp(startRect.width + deltaX, 220, maxWidth);
        const height = clamp(startRect.height + deltaY, 160, maxHeight);
        this.setRect({
          width,
          height,
          x: startRect.x,
          y: startRect.y
        });
      };

      const stopResize = () => {
        resizing = false;
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", stopResize);
        window.removeEventListener("touchmove", onTouchMove);
        window.removeEventListener("touchend", stopResize);
      };

      const onMouseMove = (event) => {
        onResizeMove(event.clientX, event.clientY);
      };

      const onTouchMove = (event) => {
        const touch = event.touches[0];
        if (!touch) return;
        onResizeMove(touch.clientX, touch.clientY);
      };

      handle.addEventListener("mousedown", (event) => {
        if (event.button !== 0) return;
        if (this.maximized || this.options.resizable === false) return;
        event.preventDefault();
        resizing = true;
        startX = event.clientX;
        startY = event.clientY;
        startRect = this.getRect();
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", stopResize);
      });

      handle.addEventListener("touchstart", (event) => {
        if (this.maximized || this.options.resizable === false) return;
        const touch = event.touches[0];
        if (!touch) return;
        resizing = true;
        startX = touch.clientX;
        startY = touch.clientY;
        startRect = this.getRect();
        window.addEventListener("touchmove", onTouchMove, { passive: true });
        window.addEventListener("touchend", stopResize);
      });
    }

    toggleMaximize() {
      if (this.options.maximizable === false) return;
      this.windowEl.classList.add("is-animating");
      if (!this.maximized) {
        this.prevRect = this.getRect();
        this.maximized = true;
        this.windowEl.classList.add("is-maximized");
        this.windowEl.classList.add("is-blurred");
        this.setRect({
          width: desktop.clientWidth,
          height: desktop.clientHeight - 54,
          x: 0,
          y: 0
        });
      } else {
        this.maximized = false;
        this.windowEl.classList.remove("is-maximized");
        this.windowEl.classList.remove("is-blurred");
        if (this.prevRect) {
          this.setRect(this.prevRect);
        }
      }
      window.setTimeout(() => {
        this.windowEl.classList.remove("is-animating");
      }, 240);
    }

    minimize() {
      if (this.minimized) return;
      this.minimized = true;
      if (this.statusIcon) {
        const winRect = this.windowEl.getBoundingClientRect();
        const iconRect = this.statusIcon.getBoundingClientRect();
        const winCenterX = winRect.left + winRect.width / 2;
        const winCenterY = winRect.top + winRect.height / 2;
        const iconCenterX = iconRect.left + iconRect.width / 2;
        const iconCenterY = iconRect.top + iconRect.height / 2;
        const deltaX = iconCenterX - winCenterX;
        const deltaY = iconCenterY - winCenterY;
        const scale = Math.min(0.28, Math.max(0.08, Math.max(iconRect.width / winRect.width, iconRect.height / winRect.height)));
        this.windowEl.style.setProperty("--minimize-x", `${deltaX}px`);
        this.windowEl.style.setProperty("--minimize-y", `${deltaY}px`);
        this.windowEl.style.setProperty("--minimize-scale", String(scale));
      }
      this.windowEl.classList.add("is-minimized");
      if (this.statusIcon) {
        this.statusIcon.classList.add("is-minimized");
      }
    }

    toggleMinimize() {
      if (this.minimized) {
        this.restore();
        return;
      }
      this.minimize();
    }

    restore() {
      if (!this.minimized) return;
      this.minimized = false;
      if (this.statusIcon) {
        const winRect = this.windowEl.getBoundingClientRect();
        const iconRect = this.statusIcon.getBoundingClientRect();
        const winCenterX = winRect.left + winRect.width / 2;
        const winCenterY = winRect.top + winRect.height / 2;
        const iconCenterX = iconRect.left + iconRect.width / 2;
        const iconCenterY = iconRect.top + iconRect.height / 2;
        const deltaX = iconCenterX - winCenterX;
        const deltaY = iconCenterY - winCenterY;
        const scale = Math.min(0.28, Math.max(0.08, Math.max(iconRect.width / winRect.width, iconRect.height / winRect.height)));
        this.windowEl.style.setProperty("--minimize-x", `${deltaX}px`);
        this.windowEl.style.setProperty("--minimize-y", `${deltaY}px`);
        this.windowEl.style.setProperty("--minimize-scale", String(scale));
      }
      this.windowEl.classList.remove("is-minimized");
      if (this.statusIcon) {
        this.statusIcon.classList.remove("is-minimized");
      }
      this.focus();
    }

    close() {
      this.windowEl.classList.add("is-closing");
      window.setTimeout(() => {
        if (this.statusIcon) {
          this.statusIcon.remove();
        }
        this.windowEl.remove();
        if (typeof this.options.onClose === "function") {
          this.options.onClose();
        }
      }, 200);
    }

    ensureStatusIcon() {
      if (!this.statusCenter || this.statusIcon) return;
      const icon = document.createElement("button");
      icon.className = "status-app-icon";
      icon.type = "button";
      const resolvedIcon = this.resolveIcon();
      if (resolvedIcon) {
        const img = document.createElement("img");
        img.src = resolvedIcon;
        img.alt = "";
        img.className = "status-app-icon-img";
        img.addEventListener("error", () => {
          if (img.src.endsWith("/ico.svg")) {
            img.src = img.src.replace("/ico.svg", "/ico.png");
          }
        }, { once: true });
        icon.appendChild(img);
      } else {
        icon.textContent = this.options.title ? this.options.title[0] : "A";
      }
      icon.addEventListener("click", () => {
        this.toggleMinimize();
      });
      icon.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();
        showStatusMenu(event.clientX, event.clientY, this);
      });
      this.statusCenter.appendChild(icon);
      this.statusIcon = icon;
    }
  }

  AppWindow.minZIndex = 10;
  AppWindow.maxZIndex = 980;
  AppWindow.zCounter = AppWindow.minZIndex;
  AppWindow.rebaseZIndexes = () => {
    const windows = Array.from(document.querySelectorAll(".app-window"));
    windows.sort((a, b) => {
      const zA = Number(a.style.zIndex || AppWindow.minZIndex);
      const zB = Number(b.style.zIndex || AppWindow.minZIndex);
      return zA - zB;
    });
    let nextZ = AppWindow.minZIndex;
    windows.forEach((el) => {
      el.style.zIndex = String(nextZ);
      nextZ += 1;
    });
    AppWindow.zCounter = Math.max(AppWindow.minZIndex, nextZ - 1);
  };

  window.WindowAPI = {
    createWindow(options) {
      const win = new AppWindow(options || {});
      const windows = document.querySelectorAll(".app-window");
      windows.forEach((el) => {
        if (el !== win.windowEl) {
          el.classList.add("is-blurred");
        }
      });
      return win;
    }
  };

  window.addEventListener("click", () => {
    hideStatusMenu();
  });

  window.addEventListener("contextmenu", () => {
    hideStatusMenu();
  });
})();
