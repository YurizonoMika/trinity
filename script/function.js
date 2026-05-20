document.addEventListener("DOMContentLoaded", () => {
  let skyBlue = { r: 120, g: 190, b: 255 };
  let wallpaperObjectUrl = "";
  const settingsDbName = "trinitySettingsDB";
  const wallpaperStoreName = "userWallpapers";
  const avatarStoreName = "userAvatars";
  const uiStoreName = "userUiSettings";
  const applyTheme = (color) => {
    const primary = `rgb(${color.r}, ${color.g}, ${color.b})`;
    const primaryContainer = `color-mix(in srgb, ${primary}, #ffffff 68%)`;
    const luma = (0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b) / 255;
    const onPrimary = luma > 0.55 ? "#1b1b1f" : "#ffffff";
    const onPrimaryContainer = luma > 0.55 ? "#1b1b1f" : "#2b2233";
    const outline = `color-mix(in srgb, ${primary}, #ffffff 55%)`;
    const text = luma > 0.55 ? "#1b1b1f" : "#f6f5f1";

    const root = document.documentElement.style;
    root.setProperty("--md-primary", primary);
    root.setProperty("--md-on-primary", onPrimary);
    root.setProperty("--md-primary-container", primaryContainer);
    root.setProperty("--md-on-primary-container", onPrimaryContainer);
    root.setProperty("--md-outline", outline);
    root.setProperty("--md-text", text);
  };

  applyTheme(skyBlue);

  const openSettingsDb = () => new Promise((resolve, reject) => {
    const request = indexedDB.open(settingsDbName, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(wallpaperStoreName)) {
        db.createObjectStore(wallpaperStoreName, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(avatarStoreName)) {
        db.createObjectStore(avatarStoreName, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(uiStoreName)) {
        db.createObjectStore(uiStoreName, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const getWallpaperKey = (name) => {
    return `trinityWallpaper:${encodeURIComponent(name || "guest")}`;
  };

  const getAvatarKey = (name) => {
    return `trinityAvatar:${encodeURIComponent(name || "guest")}`;
  };

  const getUiKey = (name) => {
    return `trinityUi:${encodeURIComponent(name || "guest")}`;
  };

  const readWallpaperBlob = async (name) => {
    const db = await openSettingsDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(wallpaperStoreName, "readonly");
      const store = tx.objectStore(wallpaperStoreName);
      const request = store.get(getWallpaperKey(name));
      request.onsuccess = () => resolve(request.result?.blob || null);
      request.onerror = () => reject(request.error);
    });
  };

  const readAvatarBlob = async (name) => {
    const db = await openSettingsDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(avatarStoreName, "readonly");
      const store = tx.objectStore(avatarStoreName);
      const request = store.get(getAvatarKey(name));
      request.onsuccess = () => resolve(request.result?.blob || null);
      request.onerror = () => reject(request.error);
    });
  };

  const readUiSettings = async (name) => {
    const db = await openSettingsDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(uiStoreName, "readonly");
      const store = tx.objectStore(uiStoreName);
      const request = store.get(getUiKey(name));
      request.onsuccess = () => resolve(request.result?.value || null);
      request.onerror = () => reject(request.error);
    });
  };

  const writeAvatarBlob = async (name, blob) => {
    const db = await openSettingsDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(avatarStoreName, "readwrite");
      const store = tx.objectStore(avatarStoreName);
      store.put({ id: getAvatarKey(name), blob });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  };

  const blobToDataUrl = (blob) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(blob);
  });

  const revokeWallpaperObjectUrl = () => {
    if (!wallpaperObjectUrl) return;
    URL.revokeObjectURL(wallpaperObjectUrl);
    wallpaperObjectUrl = "";
  };

  const applyStoredWallpaper = async (name) => {
    if (!stage || !name) return false;
    try {
      const blob = await readWallpaperBlob(name);
      if (!blob) return false;
      revokeWallpaperObjectUrl();
      wallpaperObjectUrl = URL.createObjectURL(blob);
      const url = `url('${wallpaperObjectUrl}')`;
      stage.style.setProperty("--wallpaper-url", url);
      stage.style.backgroundImage = url;
      stage.style.backgroundSize = "cover";
      stage.style.backgroundPosition = "center";
      stage.style.backgroundRepeat = "no-repeat";
      return true;
    } catch {
      // Ignore wallpaper load failures.
    }
    return false;
  };

  const applyStoredAvatar = async (name) => {
    if (!name) return;
    try {
      const blob = await readAvatarBlob(name);
      if (!blob) return;
      const dataUrl = await blobToDataUrl(blob);
      avatar.style.backgroundImage = `url('${dataUrl}')`;
      avatar.classList.add("has-image");
      menuAvatar.style.backgroundImage = `url('${dataUrl}')`;
    } catch {
      // Ignore avatar load failures.
    }
  };

  const storeAvatarForUser = async (name, dataUrl) => {
    if (!name || !dataUrl) return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      await writeAvatarBlob(name, blob);
    } catch {
      // Ignore avatar storage failures.
    }
  };

  const applyUiSettings = (value) => {
    const root = document.documentElement;
    const glassEnabled = value?.glassEnabled !== false;
    const animationEnabled = value?.animationEnabled !== false;
    const lowTransparencyEnabled = value?.lowTransparencyEnabled === true;
    root.classList.toggle("ui-no-glass", !glassEnabled);
    root.classList.toggle("ui-no-anim", !animationEnabled);
    root.classList.toggle("ui-low-transparency", lowTransparencyEnabled);
  };

  const avatar = document.getElementById("avatar");
  const avatarUpload = document.getElementById("avatarUpload");
  const stage = document.querySelector(".stage");
  const arrowButton = document.querySelector(".arrow-btn");
  const timeDisplay = document.getElementById("timeDisplay");
  const timePopover = document.getElementById("timePopover");
  const timePopoverClock = document.getElementById("timePopoverClock");
  const timePopoverDate = document.getElementById("timePopoverDate");
  const nameInput = document.getElementById("nameInput");
  const menuButton = document.querySelector(".menu-button");
  const mainMenu = document.querySelector(".main-menu");
  const menuAvatar = document.getElementById("menuAvatar");
  const menuName = document.getElementById("menuName");
  const logoutButton = document.getElementById("logoutButton");
  if (!avatar || !avatarUpload || !stage || !arrowButton || !timeDisplay || !timePopover || !timePopoverClock || !timePopoverDate || !nameInput || !menuButton || !mainMenu || !menuAvatar || !menuName || !logoutButton) return;
  const rightMenuApi = window.RightMenuAPI;

  const setDesktopVisible = (visible) => {
    const desktopEl = document.getElementById("desktop");
    if (!desktopEl) return;
    desktopEl.style.display = visible ? "block" : "none";
  };

  avatar.addEventListener("click", () => {
    avatarUpload.click();
  });

  let pendingAvatarDataUrl = "";

  avatarUpload.addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      avatar.style.backgroundImage = `url('${dataUrl}')`;
      avatar.classList.add("has-image");
      menuAvatar.style.backgroundImage = `url('${dataUrl}')`;
      const activeName = localStorage.getItem("trinityName") || "";
      if (activeName) {
        void storeAvatarForUser(activeName, dataUrl);
      } else {
        pendingAvatarDataUrl = dataUrl;
      }
    };
    reader.readAsDataURL(file);
  });

  const weekDays = ["日", "一", "二", "三", "四", "五", "六"];

  const updateTime = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const weekday = weekDays[now.getDay()];
    timeDisplay.textContent = `${hours}:${minutes} 星期${weekday}`;
  };

  const updateFullTime = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    const weekday = weekDays[now.getDay()];
    timePopoverClock.textContent = `${hours}:${minutes}:${seconds}`;
    timePopoverDate.textContent = `${year}年${month}月${day}日 星期${weekday}`;
  };

  updateTime();
  updateFullTime();
  setInterval(() => {
    updateTime();
    updateFullTime();
  }, 1000);

  let currentUserName = "";

  const setCurrentUser = (name) => {
    currentUserName = name.trim();
  };

  arrowButton.addEventListener("click", async () => {
    const name = nameInput.value.trim();
    if (name.length > 0) {
      localStorage.setItem("trinityName", name);
      menuName.textContent = name;
      setCurrentUser(name);
      if (pendingAvatarDataUrl) {
        void storeAvatarForUser(name, pendingAvatarDataUrl);
        pendingAvatarDataUrl = "";
      }
      void applyStoredAvatar(name);
      const storedTheme = localStorage.getItem("trinityThemeColor");
      if (storedTheme) {
        try {
          const parsed = JSON.parse(storedTheme);
          if (
            Number.isFinite(parsed?.r) &&
            Number.isFinite(parsed?.g) &&
            Number.isFinite(parsed?.b)
          ) {
            skyBlue = parsed;
            applyTheme(skyBlue);
          }
        } catch {
          applyTheme({ r: 120, g: 190, b: 255 });
        }
      }
      const storedUi = await readUiSettings(name);
      if (storedUi) {
        applyUiSettings(storedUi);
      } else {
        applyUiSettings({ glassEnabled: true, animationEnabled: true, lowTransparencyEnabled: false });
      }
      const applied = await applyStoredWallpaper(name);
      if (!applied && stage) {
        stage.style.setProperty("--wallpaper-url", "url('../wallpaper.jpg')");
        stage.style.backgroundImage = "";
        stage.style.backgroundSize = "";
        stage.style.backgroundPosition = "";
        stage.style.backgroundRepeat = "";
      }
      loadDesktop();
      reflowIcons();
    }
    stage.classList.add("show-status");
    setDesktopVisible(true);
  });

  const savedName = localStorage.getItem("trinityName");
  if (savedName) {
    const storedTheme = localStorage.getItem("trinityThemeColor");
    if (storedTheme) {
      try {
        const parsed = JSON.parse(storedTheme);
        if (
          Number.isFinite(parsed?.r) &&
          Number.isFinite(parsed?.g) &&
          Number.isFinite(parsed?.b)
        ) {
          skyBlue = parsed;
        }
      } catch {
        skyBlue = { r: 120, g: 190, b: 255 };
      }
    }
    applyTheme(skyBlue);
  }
  const legacyAvatar = localStorage.getItem("trinityAvatar");
  if (savedName && legacyAvatar) {
    void storeAvatarForUser(savedName, legacyAvatar).then(() => {
      localStorage.removeItem("trinityAvatar");
    });
  }
  if (savedName) {
    void readUiSettings(savedName).then((storedUi) => {
      if (storedUi) {
        applyUiSettings(storedUi);
        return;
      }
      applyUiSettings({ glassEnabled: true, animationEnabled: true, lowTransparencyEnabled: false });
    });
    void applyStoredWallpaper(savedName);
    void applyStoredAvatar(savedName);
  }
  if (savedName) {
    nameInput.value = savedName;
    menuName.textContent = savedName;
    setCurrentUser(savedName);
    stage.classList.add("show-status");
    setDesktopVisible(true);
  } else {
    setDesktopVisible(false);
  }

  const rippleTargets = document.querySelectorAll(".arrow-btn, .menu-button, .logout-button, .status-time");
  rippleTargets.forEach((button) => {
    button.classList.add("ripple-target");
    button.addEventListener("click", (event) => {
      const rect = button.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 1.2;
      const ripple = document.createElement("span");
      ripple.className = "ripple";
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
      button.appendChild(ripple);
      ripple.addEventListener("animationend", () => {
        ripple.remove();
      });
    });
  });

  const closeMenu = () => {
    if (mainMenu.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    mainMenu.classList.remove("is-open");
    mainMenu.classList.remove("is-closing");
    mainMenu.style.animation = "none";
    void mainMenu.offsetWidth;
    mainMenu.style.animation = "";
    mainMenu.classList.add("is-closing");
    mainMenu.setAttribute("inert", "");
    mainMenu.setAttribute("aria-hidden", "true");
  };

  menuButton.addEventListener("click", (event) => {
    event.stopPropagation();
    if (mainMenu.classList.contains("is-open")) {
      closeMenu();
      return;
    }
    mainMenu.classList.remove("is-closing");
    mainMenu.style.animation = "none";
    void mainMenu.offsetWidth;
    mainMenu.style.animation = "";
    mainMenu.classList.add("is-open");
    mainMenu.removeAttribute("inert");
    mainMenu.setAttribute("aria-hidden", "false");
  });

  timeDisplay.addEventListener("click", (event) => {
    event.stopPropagation();
    timePopover.classList.toggle("is-open");
    timePopover.setAttribute("aria-hidden", timePopover.classList.contains("is-open") ? "false" : "true");
  });

  mainMenu.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  document.addEventListener("click", () => {
    if (mainMenu.classList.contains("is-open")) {
      closeMenu();
    }
    if (timePopover.classList.contains("is-open")) {
      timePopover.classList.remove("is-open");
      timePopover.setAttribute("aria-hidden", "true");
    }
  });

  mainMenu.addEventListener("animationend", (event) => {
    if (event.animationName === "menu-rise" && mainMenu.classList.contains("is-closing")) {
      mainMenu.classList.remove("is-closing");
    }
  });

  logoutButton.addEventListener("click", () => {
    revokeWallpaperObjectUrl();
    saveDesktop();
    localStorage.removeItem("trinityName");
    localStorage.removeItem("trinityAvatar");
    localStorage.removeItem("trinityWallpaper");
    localStorage.removeItem("trinityThemeColor");
    setCurrentUser("");
    nameInput.value = "";
    menuName.textContent = "游客";
    avatar.style.backgroundImage = "";
    avatar.classList.remove("has-image");
    menuAvatar.style.backgroundImage = "";
    const defaultPrimary = "rgb(120, 190, 255)";
    const defaultContainer = `color-mix(in srgb, ${defaultPrimary}, #ffffff 68%)`;
    const defaultOutline = `color-mix(in srgb, ${defaultPrimary}, #ffffff 55%)`;
    const root = document.documentElement.style;
    root.setProperty("--md-primary", defaultPrimary);
    root.setProperty("--md-on-primary", "#ffffff");
    root.setProperty("--md-primary-container", defaultContainer);
    root.setProperty("--md-on-primary-container", "#2b2233");
    root.setProperty("--md-outline", defaultOutline);
    root.setProperty("--md-text", "#f6f5f1");
    stage.style.setProperty("--wallpaper-url", "url('../wallpaper.jpg')");
    stage.style.backgroundImage = "";
    stage.style.backgroundSize = "";
    stage.style.backgroundPosition = "";
    stage.style.backgroundRepeat = "";
    applyUiSettings({ glassEnabled: true, animationEnabled: true, lowTransparencyEnabled: false });
    stage.classList.remove("show-status");
    document.querySelectorAll(".app-window").forEach((win) => win.remove());
    const statusCenter = document.getElementById("statusCenter");
    if (statusCenter) {
      statusCenter.innerHTML = "";
    }
    setDesktopVisible(false);
    timePopover.classList.remove("is-open");
    timePopover.setAttribute("aria-hidden", "true");
    closeMenu();
  });

  let menuContextTarget = null;
  const menuAppContextMenu = rightMenuApi?.create({
    className: "menu-app-context",
    getItems: (target) => {
      const canPin = target?.dataset?.pin !== "false";
      return [
        { label: "打开", action: "open" },
        { label: "添加至桌面", action: "pin", hidden: !canPin }
      ];
    },
    onSelect: (action, target) => {
      if (!action || !target) return;
      if (action === "open") {
        target.click();
      }
      if (action === "pin" && desktop && target?.dataset?.pin !== "false") {
        const label = target.querySelector("span:last-of-type")?.textContent?.trim() || "应用";
        const icon = target.querySelector("img");
        const appId = target.dataset.app || "about";
        const desktopIcon = document.createElement("div");
        desktopIcon.className = "desktop-icon";
        desktopIcon.dataset.app = appId;
        desktopIcon.style.left = "0px";
        desktopIcon.style.top = "0px";
        desktopIcon.innerHTML = `<img src="${icon?.getAttribute("src") || ""}" alt="" /><span>${label}</span>`;
        desktop.appendChild(desktopIcon);
        void desktopIcon.offsetWidth;
        rebuildOccupied();
        placeIcon(desktopIcon, 0, 0, true);
        saveDesktop();
      }
      menuContextTarget = null;
    }
  });

  const showMenuContext = (x, y, target) => {
    menuContextTarget = target;
    menuAppContextMenu?.show({ x, y, context: target });
  };

  const hideMenuContext = () => {
    menuContextTarget = null;
    menuAppContextMenu?.hide();
  };

  const desktop = document.getElementById("desktop");
  let desktopIconMenu = null;
  let desktopBgContextMenu = null;
  let activeIcon = null;
  let dragState = null;
  let suppressClick = false;
  let rebuildOccupied = () => {};
  let placeIcon = () => {};
  let loadDesktop = () => {};
  let reflowIcons = () => {};
  let saveDesktop = () => {};

  if (desktop) {
    const grid = 96;
    const occupied = new Set();
    const isFileProtocol = window.location.protocol === "file:";
    const defaultDesktopData = Array.from(desktop.querySelectorAll(".desktop-icon")).map((icon) => ({
      app: icon.dataset.app || "",
      name: icon.querySelector("span")?.textContent || "",
      left: parseFloat(icon.style.left || "0"),
      top: parseFloat(icon.style.top || "0"),
      icon: icon.querySelector("img")?.getAttribute("src") || ""
    }));

    const snapToGrid = (value) => Math.max(0, Math.round(value / grid) * grid);

    const keyFor = (left, top) => `${left},${top}`;

    const markOccupied = (left, top) => {
      occupied.add(keyFor(left, top));
    };

    const isOccupied = (left, top) => occupied.has(keyFor(left, top));

    const findNextSlot = (startLeft, startTop) => {
      const bounds = desktop.getBoundingClientRect();
      const maxCols = Math.max(1, Math.floor(bounds.width / grid));
      const maxRows = Math.max(1, Math.floor(bounds.height / grid));
      const startCol = Math.min(maxCols - 1, Math.max(0, Math.round(startLeft / grid)));
      const startRow = Math.min(maxRows - 1, Math.max(0, Math.round(startTop / grid)));
      const totalSlots = maxCols * maxRows;
      const startIndex = startCol * maxRows + startRow;

      for (let offset = 0; offset < totalSlots; offset += 1) {
        const index = (startIndex + offset) % totalSlots;
        const col = Math.floor(index / maxRows);
        const row = index % maxRows;
        const left = col * grid;
        const top = row * grid;
        if (!isOccupied(left, top)) {
          return { left, top };
        }
      }
      return { left: 0, top: 0 };
    };

    placeIcon = (icon, left, top, avoid = false) => {
      const snappedLeft = snapToGrid(left);
      const snappedTop = snapToGrid(top);
      const slot = avoid ? findNextSlot(snappedLeft, snappedTop) : { left: snappedLeft, top: snappedTop };
      icon.style.left = `${slot.left}px`;
      icon.style.top = `${slot.top}px`;
      markOccupied(slot.left, slot.top);
    };

    rebuildOccupied = (excludeIcon = null) => {
      occupied.clear();
      desktop.querySelectorAll(".desktop-icon").forEach((icon) => {
        if (excludeIcon && icon === excludeIcon) return;
        const left = snapToGrid(parseFloat(icon.style.left || "0"));
        const top = snapToGrid(parseFloat(icon.style.top || "0"));
        icon.style.left = `${left}px`;
        icon.style.top = `${top}px`;
        markOccupied(left, top);
      });
    };

    reflowIcons = () => {
      const bounds = desktop.getBoundingClientRect();
      const maxCols = Math.max(1, Math.floor(bounds.width / grid));
      const icons = Array.from(desktop.querySelectorAll(".desktop-icon"));
      occupied.clear();
      icons.forEach((icon, index) => {
        const col = Math.floor(index / Math.max(1, Math.floor(bounds.height / grid))) % maxCols;
        const row = index % Math.max(1, Math.floor(bounds.height / grid));
        const left = col * grid;
        const top = row * grid;
        icon.style.left = `${left}px`;
        icon.style.top = `${top}px`;
        markOccupied(left, top);
      });
      saveDesktop();
    };

    const desktopStorageKey = () => {
      const name = currentUserName || nameInput.value.trim() || "guest";
      return `trinityDesktop:${encodeURIComponent(name)}`;
    };

    saveDesktop = () => {
      const data = Array.from(desktop.querySelectorAll(".desktop-icon")).map((icon) => ({
        app: icon.dataset.app || "",
        name: icon.querySelector("span")?.textContent || "",
        left: parseFloat(icon.style.left || "0"),
        top: parseFloat(icon.style.top || "0"),
        icon: icon.querySelector("img")?.getAttribute("src") || ""
      }));
      localStorage.setItem(desktopStorageKey(), JSON.stringify(data));
    };

    loadDesktop = () => {
      const stored = localStorage.getItem(desktopStorageKey());
      const fallback = defaultDesktopData.map((item) => ({ ...item }));
      desktop.querySelectorAll(".desktop-icon").forEach((icon) => icon.remove());
      if (!stored) {
        fallback.forEach((item) => {
          const icon = document.createElement("div");
          icon.className = "desktop-icon";
          icon.dataset.app = item.app || "";
          icon.style.left = `${item.left || 0}px`;
          icon.style.top = `${item.top || 0}px`;
          icon.innerHTML = `<img src="${item.icon}" alt="" /><span>${item.name}</span>`;
          desktop.appendChild(icon);
        });
        return;
      }
      try {
        const data = JSON.parse(stored);
        data.forEach((item) => {
          const icon = document.createElement("div");
          icon.className = "desktop-icon";
          icon.dataset.app = item.app || "";
          icon.style.left = `${item.left || 0}px`;
          icon.style.top = `${item.top || 0}px`;
          icon.innerHTML = `<img src="${item.icon}" alt="" /><span>${item.name}</span>`;
          desktop.appendChild(icon);
        });
      } catch {
        localStorage.removeItem(desktopStorageKey());
        fallback.forEach((item) => {
          const icon = document.createElement("div");
          icon.className = "desktop-icon";
          icon.dataset.app = item.app || "";
          icon.style.left = `${item.left || 0}px`;
          icon.style.top = `${item.top || 0}px`;
          icon.innerHTML = `<img src="${item.icon}" alt="" /><span>${item.name}</span>`;
          desktop.appendChild(icon);
        });
      }
    };

    if (savedName) {
      loadDesktop();
      reflowIcons();
    }

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(reflowIcons);
    });
    resizeObserver.observe(desktop);

    window.addEventListener("resize", () => {
      requestAnimationFrame(reflowIcons);
    });
    const clearSelection = () => {
      desktop.querySelectorAll(".desktop-icon.selected").forEach((icon) => {
        icon.classList.remove("selected");
      });
      activeIcon = null;
    };

    const resolveOpenHandler = (appId) => {
      if (appId === "about") return window.AboutApp?.open;
      if (appId === "note") return window.NoteApp?.open;
      if (appId === "files") return window.FilesApp?.open;
      if (appId === "launchpad") return window.LaunchpadApp?.open;
      if (appId === "settings") return window.SettingsApp?.open;
      if (appId === "music") return window.MusicApp?.open;
      if (appId === "com.cheesesynx.cloud") return window.CloudApp?.open || window.CheeseCloud?.open;
      if (appId === "com.cheesesynx.documents") return window.DocumentsApp?.open;
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

    const resolveIconAppId = (icon) => {
      const direct = icon?.dataset?.app || "";
      if (direct) return direct;
      const src = icon?.querySelector("img")?.getAttribute("src") || "";
      const match = src.match(/^apps\/([^/]+)\//);
      if (!match) return "";
      const inferred = match[1];
      icon.dataset.app = inferred;
      saveDesktop();
      return inferred;
    };

    const openIcon = async (icon) => {
      const appId = resolveIconAppId(icon);
      if (!appId) return;
      let open = resolveOpenHandler(appId);
      if (typeof open === "function") {
        open();
        return;
      }
      const appMeta = await fetchAppMeta(appId);
      try {
        await loadAppAssets(appId, appMeta || {});
      } catch (error) {
        console.warn(error);
      }
      open = resolveOpenHandler(appId) || (appMeta?.global ? window[appMeta.global]?.open : null);
      if (typeof open === "function") {
        open();
      }
    };

    desktopIconMenu = rightMenuApi?.create({
      className: "desktop-menu",
      items: [
        { label: "打开", action: "open" },
        { label: "重命名", action: "rename" },
        { label: "删除", action: "delete" }
      ],
      onSelect: (action, target) => {
        const icon = target || activeIcon;
        if (!action || !icon) return;
        if (action === "open") {
          void openIcon(icon);
        }
        if (action === "rename") {
          const label = icon.querySelector("span");
          if (label) {
            const name = prompt("输入新名称", label.textContent || "");
            if (name) {
              label.textContent = name;
              saveDesktop();
            }
          }
        }
        if (action === "delete") {
          icon.remove();
          saveDesktop();
        }
      }
    });

    desktopBgContextMenu = rightMenuApi?.create({
      className: "desktop-menu",
      items: [{ label: "刷新", action: "refresh" }],
      onSelect: (action) => {
        if (action === "refresh") {
          reflowIcons();
        }
      }
    });

    const showMenu = (x, y, icon) => {
      activeIcon = icon || null;
      desktopIconMenu?.show({ x, y, context: icon });
    };

    const hideMenu = () => {
      desktopIconMenu?.hide();
      desktopBgContextMenu?.hide();
    };

    desktop.addEventListener("click", (event) => {
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      if (!event.target.closest(".desktop-icon")) {
        clearSelection();
        hideMenu();
        hideMenuContext();
      }
    });

    desktop.addEventListener("contextmenu", (event) => {
      const icon = event.target.closest(".desktop-icon");
      if (!icon) {
        event.preventDefault();
        clearSelection();
        desktopBgContextMenu?.show({ x: event.clientX, y: event.clientY });
        return;
      }
      if (!icon) return;
      event.preventDefault();
      clearSelection();
      icon.classList.add("selected");
      showMenu(event.clientX, event.clientY, icon);
    });

    desktop.addEventListener("dblclick", (event) => {
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      const icon = event.target.closest(".desktop-icon");
      if (!icon) return;
      void openIcon(icon);
    });

    desktop.addEventListener("mousedown", (event) => {
      const icon = event.target.closest(".desktop-icon");
      if (!icon) return;
      if (event.button !== 0) return;
      hideMenu();
      clearSelection();
      icon.classList.add("selected");
      activeIcon = icon;
      const rect = icon.getBoundingClientRect();
      dragState = {
        icon,
        startX: event.clientX,
        startY: event.clientY,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        moved: false
      };
      event.preventDefault();
    });

    window.addEventListener("mousemove", (event) => {
      if (!dragState) return;
      const moveX = event.clientX - dragState.startX;
      const moveY = event.clientY - dragState.startY;
      if (!dragState.moved && Math.hypot(moveX, moveY) < 4) return;
      dragState.moved = true;
      const bounds = desktop.getBoundingClientRect();
      const left = event.clientX - bounds.left - dragState.offsetX;
      const top = event.clientY - bounds.top - dragState.offsetY;
      dragState.icon.style.left = `${Math.max(0, left)}px`;
      dragState.icon.style.top = `${Math.max(0, top)}px`;
    });

    window.addEventListener("mouseup", () => {
      if (dragState?.moved) {
        const left = parseFloat(dragState.icon.style.left || "0");
        const top = parseFloat(dragState.icon.style.top || "0");
        rebuildOccupied(dragState.icon);
        placeIcon(dragState.icon, left, top, true);
        suppressClick = true;
        saveDesktop();
      }
      dragState = null;
    });

    window.addEventListener("click", () => {
      hideMenu();
      hideMenuContext();
    });
  }

  mainMenu.addEventListener("contextmenu", (event) => {
    const item = event.target.closest(".menu-item");
    if (!item) return;
    event.preventDefault();
    showMenuContext(event.clientX, event.clientY, item);
  });
});
