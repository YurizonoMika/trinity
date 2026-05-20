(function () {
  const stage = document.querySelector(".stage") || document.body;
  if (!stage) return;

  let activeMenu = null;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  class RightMenu {
    constructor(options = {}) {
      this.options = options;
      this.context = null;
      this.items = [];
      this.visible = false;
      this.menuEl = document.createElement("div");
      this.menuEl.className = "right-menu";
      if (options.className) {
        this.menuEl.classList.add(...String(options.className).split(/\s+/).filter(Boolean));
      }
      this.menuEl.setAttribute("aria-hidden", "true");
      (options.mount || stage).appendChild(this.menuEl);

      this.menuEl.addEventListener("click", (event) => {
        const target = event.target instanceof Element ? event.target : event.target?.parentElement;
        const button = target?.closest("button[data-index]");
        if (!button) return;
        const index = Number(button.dataset.index);
        const item = this.items[index];
        if (!item || item.disabled) return;
        if (!item.keepOpen) {
          this.hide();
        }
        if (typeof this.options.onSelect === "function") {
          this.options.onSelect(item.action, this.context, item);
        }
      });
    }

    resolveItems(context, overrideItems) {
      if (Array.isArray(overrideItems)) return overrideItems;
      if (typeof this.options.getItems === "function") {
        return this.options.getItems(context) || [];
      }
      return this.options.items || [];
    }

    render(items) {
      this.items = items.filter((item) => !item?.hidden);
      const fragment = document.createDocumentFragment();
      this.items.forEach((item, index) => {
        if (item.type === "separator") {
          const sep = document.createElement("div");
          sep.className = "right-menu-separator";
          fragment.appendChild(sep);
          return;
        }
        const button = document.createElement("button");
        button.type = "button";
        button.className = "right-menu-item";
        button.dataset.index = String(index);
        button.textContent = item.label || "";
        if (item.disabled) {
          button.disabled = true;
        }
        fragment.appendChild(button);
      });
      this.menuEl.innerHTML = "";
      this.menuEl.appendChild(fragment);
    }

    show({ x, y, context = null, items } = {}) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      if (activeMenu && activeMenu !== this) {
        activeMenu.hide();
      }
      this.context = context;
      this.render(this.resolveItems(context, items));
      if (!this.menuEl.childElementCount) return;

      this.menuEl.classList.remove("is-closing");
      this.menuEl.style.display = "flex";
      this.menuEl.style.left = "0px";
      this.menuEl.style.top = "0px";

      const width = this.menuEl.offsetWidth || 0;
      const height = this.menuEl.offsetHeight || 0;
      const maxX = window.innerWidth - width - 8;
      const maxY = window.innerHeight - height - 8;
      const left = clamp(x, 8, Math.max(8, maxX));
      const top = clamp(y, 8, Math.max(8, maxY));

      this.menuEl.style.left = `${left}px`;
      this.menuEl.style.top = `${top}px`;
      this.menuEl.classList.add("is-open");
      this.menuEl.setAttribute("aria-hidden", "false");
      this.visible = true;
      activeMenu = this;
    }

    hide() {
      if (!this.visible) return;
      this.menuEl.classList.remove("is-open");
      this.menuEl.classList.add("is-closing");
      this.menuEl.setAttribute("aria-hidden", "true");
      window.setTimeout(() => {
        if (this.visible) return;
        this.menuEl.style.display = "none";
        this.menuEl.classList.remove("is-closing");
      }, 140);
      this.visible = false;
      if (activeMenu === this) {
        activeMenu = null;
      }
    }

    destroy() {
      this.hide();
      this.menuEl.remove();
    }
  }

  const hideActiveMenu = (event) => {
    if (!activeMenu) return;
    if (event?.target instanceof Element && activeMenu.menuEl.contains(event.target)) {
      return;
    }
    activeMenu.hide();
  };

  window.addEventListener("click", hideActiveMenu, true);
  window.addEventListener("contextmenu", (event) => {
    if (!event.defaultPrevented) {
      event.preventDefault();
    }
    hideActiveMenu(event);
  }, true);
  window.addEventListener("resize", () => {
    if (activeMenu) activeMenu.hide();
  });
  window.addEventListener("blur", () => {
    if (activeMenu) activeMenu.hide();
  });

  window.RightMenuAPI = {
    create(options) {
      return new RightMenu(options);
    },
    hideAll() {
      if (activeMenu) {
        activeMenu.hide();
      }
    }
  };
})();
