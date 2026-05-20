document.addEventListener("DOMContentLoaded", () => {
  const launchpadButton = document.getElementById("launchpadAppButton");
  if (!launchpadButton || !window.WindowAPI) return;
  const rightMenuApi = window.RightMenuAPI;

  const FALLBACK_APPS = [
    { id: "about", name: "关于", icon: "apps/about/ico.svg" },
    { id: "note", name: "文本编辑器", icon: "apps/note/ico.svg" },
    { id: "files", name: "文件管理", icon: "apps/files/ico.svg" }
  ];

  const isFileProtocol = window.location.protocol === "file:";

  const resolveOpenHandler = (appId) => {
    if (appId === "about") return window.AboutApp?.open;
    if (appId === "note") return window.NoteApp?.open;
    if (appId === "files") return window.FilesApp?.open;
    if (appId === "launchpad") return window.LaunchpadApp?.open;
    if (appId === "settings") return window.SettingsApp?.open;
    if (appId === "music") return window.MusicApp?.open;
    return null;
  };

  const loadAppAssets = (appId, meta = {}) => {
    const head = document.head || document.documentElement;
    const scriptSrc = meta.script || `apps/${appId}/app.js`;
    const styleHref = meta.style || `apps/${appId}/style.css`;
    const styleKey = `app-style-${appId}`;
    const scriptKey = `app-script-${appId}`;

    if (!document.querySelector(`link[data-app="${styleKey}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = styleHref;
      link.dataset.app = styleKey;
      head.appendChild(link);
    }

    if (document.querySelector(`script[data-app="${scriptKey}"]`)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = scriptSrc;
      script.defer = true;
      script.dataset.app = scriptKey;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${scriptSrc}`));
      head.appendChild(script);
    });
  };

  const compareNames = (a, b) => {
    return a.localeCompare(b, "zh-Hans-CN", { numeric: true, sensitivity: "base" });
  };

  const desktopStorageKey = () => {
    const name = localStorage.getItem("trinityName") || "guest";
    return `trinityDesktop:${encodeURIComponent(name)}`;
  };

  const saveDesktopSnapshot = (desktop) => {
    const data = Array.from(desktop.querySelectorAll(".desktop-icon")).map((icon) => ({
      app: icon.dataset.app || "",
      name: icon.querySelector("span")?.textContent || "",
      left: parseFloat(icon.style.left || "0"),
      top: parseFloat(icon.style.top || "0"),
      icon: icon.querySelector("img")?.getAttribute("src") || ""
    }));
    localStorage.setItem(desktopStorageKey(), JSON.stringify(data));
  };

  const findDesktopSlot = (desktop, grid = 96) => {
    const occupied = new Set();
    desktop.querySelectorAll(".desktop-icon").forEach((icon) => {
      const left = Math.round(parseFloat(icon.style.left || "0") / grid) * grid;
      const top = Math.round(parseFloat(icon.style.top || "0") / grid) * grid;
      occupied.add(`${left},${top}`);
    });
    const bounds = desktop.getBoundingClientRect();
    const maxCols = Math.max(1, Math.floor(bounds.width / grid));
    const maxRows = Math.max(1, Math.floor(bounds.height / grid));
    for (let col = 0; col < maxCols; col += 1) {
      for (let row = 0; row < maxRows; row += 1) {
        const left = col * grid;
        const top = row * grid;
        if (!occupied.has(`${left},${top}`)) {
          return { left, top };
        }
      }
    }
    return { left: 0, top: 0 };
  };

  const pinCardToDesktop = (card) => {
    const desktop = document.getElementById("desktop");
    if (!desktop || !card) return;
    const appId = card.dataset.app || "";
    if (!appId) return;
    const iconSrc = card.querySelector("img")?.getAttribute("src") || "";
    const appName = card.querySelector(".launchpad-name")?.textContent?.trim() || appId;
    const slot = findDesktopSlot(desktop);

    const icon = document.createElement("div");
    icon.className = "desktop-icon";
    icon.dataset.app = appId;
    icon.style.left = `${slot.left}px`;
    icon.style.top = `${slot.top}px`;
    icon.innerHTML = `<img src="${iconSrc}" alt="" /><span>${appName}</span>`;
    desktop.appendChild(icon);
    saveDesktopSnapshot(desktop);
  };

  const fetchDirectoryApps = async () => {
    if (isFileProtocol) return null;
    try {
      const response = await fetch("apps/", { cache: "no-store" });
      if (!response.ok) return null;
      const text = await response.text();
      const doc = new DOMParser().parseFromString(text, "text/html");
      const links = Array.from(doc.querySelectorAll("a[href]"));
      const folders = links
        .map((link) => link.getAttribute("href") || "")
        .filter((href) => href.endsWith("/") && !href.startsWith("../"))
        .map((href) => href.replace(/\/$/, ""))
        .filter((name) => name && !name.includes("/"));
      if (!folders.length) return null;
      return folders;
    } catch {
      return null;
    }
  };

  const fetchManifestApps = async () => {
    if (isFileProtocol) return null;
    try {
      const response = await fetch("apps/manifest.json", { cache: "no-store" });
      if (!response.ok) return null;
      const data = await response.json();
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.apps)) return data.apps;
      return null;
    } catch {
      return null;
    }
  };

  const discoverAppsFromDocument = () => {
    const nodes = document.querySelectorAll("link[href^='apps/'], script[src^='apps/'], img[src^='apps/']");
    const ids = new Set();
    nodes.forEach((node) => {
      const src = node.getAttribute("href") || node.getAttribute("src") || "";
      const parts = src.split("/");
      if (parts[0] !== "apps" || !parts[1]) return;
      ids.add(parts[1]);
    });
    return Array.from(ids);
  };

  const fetchAppMeta = async (appId) => {
    if (isFileProtocol) return null;
    try {
      const response = await fetch(`apps/${appId}/app.json`, { cache: "no-store" });
      if (!response.ok) return null;
      const data = await response.json();
      return data && typeof data === "object" ? data : null;
    } catch {
      return null;
    }
  };

  const buildAppList = async () => {
    const manifestApps = await fetchManifestApps();
    const folders = await fetchDirectoryApps();
    const discovered = discoverAppsFromDocument();
    const appIds = (manifestApps && manifestApps.length)
      ? manifestApps
      : ((folders && folders.length)
        ? folders
        : (discovered.length ? discovered : FALLBACK_APPS.map((item) => item.id)));
    const uniqueIds = Array.from(new Set(appIds));

    const apps = [];
    for (const entry of uniqueIds) {
      const id = typeof entry === "string" ? entry : entry?.id;
      if (!id) continue;
      if (id === "launchpad") continue;
      const meta = await fetchAppMeta(id);
      const fallback = FALLBACK_APPS.find((item) => item.id === id);
      const name = meta?.name || meta?.title || entry?.name || fallback?.name || id;
      const icon = meta?.icon || entry?.icon || fallback?.icon || `apps/${id}/ico.svg`;
      apps.push({ id, name, icon, meta });
    }

    apps.sort((a, b) => compareNames(a.name, b.name));
    return apps;
  };

    const createLaunchpadUI = (apps) => {
    const app = document.createElement("div");
    app.className = "launchpad-app";

    const header = document.createElement("div");
    header.className = "launchpad-header";
    header.innerHTML = "<div class=\"launchpad-title\">所有App</div><div class=\"launchpad-subtitle\">Hikari LaunchPad v0.1.2</div>";

    const grid = document.createElement("div");
    grid.className = "launchpad-grid";

    apps.forEach((item) => {
      const card = window.FxUI.createButton({ label: item.name, className: "launchpad-card" });
      card.dataset.app = item.id;
      card.innerHTML = `<span class=\"launchpad-icon\"><img src=\"${item.icon}\" alt=\"\" /></span><span class=\"launchpad-name\">${item.name}</span>`;
      grid.appendChild(card);

      const iconEl = card.querySelector("img");
      if (iconEl) {
        iconEl.addEventListener("error", () => {
          if (iconEl.src.endsWith("/ico.svg")) {
            iconEl.src = iconEl.src.replace("/ico.svg", "/ico.png");
          }
        }, { once: true });
      }
    });

    app.appendChild(header);
    app.appendChild(grid);

    let selected = null;

    const openCardApp = async (card) => {
      if (!card) return;
      const appId = card.dataset.app;
      let open = resolveOpenHandler(appId);
      if (typeof open === "function") {
        open();
        return;
      }
      const appMeta = apps.find((item) => item.id === appId)?.meta || {};
      try {
        await loadAppAssets(appId, appMeta);
      } catch (error) {
        console.warn(error);
      }
      open = resolveOpenHandler(appId) || (appMeta.global ? window[appMeta.global]?.open : null);
      if (typeof open === "function") {
        open();
      }
    };

    const cardContextMenu = rightMenuApi?.create({
      className: "launchpad-card-context",
      items: [
        { label: "打开", action: "open" },
        { label: "添加至桌面", action: "pin" }
      ],
      onSelect: (action, card) => {
        if (!card || !action) return;
        if (action === "open") {
          void openCardApp(card);
        }
        if (action === "pin") {
          pinCardToDesktop(card);
        }
      }
    });

    const selectCard = (card) => {
      if (selected) selected.classList.remove("is-selected");
      selected = card;
      if (selected) selected.classList.add("is-selected");
    };

    grid.addEventListener("click", (event) => {
      const card = event.target.closest(".launchpad-card");
      if (!card) return;
      selectCard(card);
    });

    grid.addEventListener("dblclick", async (event) => {
      const card = event.target.closest(".launchpad-card");
      if (!card) return;
      void openCardApp(card);
    });

    grid.addEventListener("contextmenu", (event) => {
      const card = event.target.closest(".launchpad-card");
      if (!card) return;
      event.preventDefault();
      selectCard(card);
      cardContextMenu?.show({ x: event.clientX, y: event.clientY, context: card });
    });

    app.addEventListener("contextmenu", (event) => {
      if (event.target.closest(".launchpad-card")) return;
      event.preventDefault();
    });

    app.cleanupContextMenu = () => {
      cardContextMenu?.destroy();
    };

    return app;
  };

  let launchpadWindow = null;

  const openLaunchpad = async () => {
    if (launchpadWindow && !launchpadWindow.windowEl?.isConnected) {
      launchpadWindow = null;
    }
    if (launchpadWindow) {
      launchpadWindow.restore();
      return;
    }

    const apps = await buildAppList();
    const content = createLaunchpadUI(apps);

    launchpadWindow = window.WindowAPI.createWindow({
      title: "所有App",
      content,
      appPath: "apps/launchpad",
      rect: { width: 560, height: 420, x: 120, y: 70 },
      maximizable: true,
      resizable: true,
      onClose: () => {
        content.cleanupContextMenu?.();
        launchpadWindow = null;
      }
    });
  };

  launchpadButton.addEventListener("click", (event) => {
    event.stopPropagation();
    openLaunchpad();
  });

  window.LaunchpadApp = {
    open: openLaunchpad
  };
});
