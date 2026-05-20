const initMusicApp = () => {
  if (!window.WindowAPI) return;

  const statusBar = document.querySelector(".status-bar");
  const statusTime = document.getElementById("timeDisplay");

  let musicWindow = null;
  let statusControls = null;

  const removeStatusControls = () => {
    if (statusControls) {
      statusControls.remove();
      statusControls = null;
    }
  };

  const buildMusicApp = () => {
    const app = document.createElement("div");
    app.className = "music-app";

    const frameWrap = document.createElement("div");
    frameWrap.className = "music-frame-wrap";


    const toast = document.createElement("div");
    toast.className = "music-toast";
    toast.textContent = "应用来自第三方，我们不对App内容的安全性负责";
    const toastKey = "trinityMusicToastSeen";
    const shouldShowToast = !localStorage.getItem(toastKey);
    if (shouldShowToast) {
      toast.classList.add("is-visible");
      localStorage.setItem(toastKey, "true");
    }

    const frame = document.createElement("iframe");
    frame.className = "music-frame";
    frame.src = "https://music.randench.cn/#/";
    frame.title = "音乐";
    frame.loading = "lazy";

    const loading = document.createElement("div");
    loading.className = "music-loading is-visible";
    loading.innerHTML = "<div class=\"music-loading-spinner\" aria-hidden=\"true\"></div><div class=\"music-loading-text\">正在加载音乐应用...</div>";

    const fallback = document.createElement("div");
    fallback.className = "music-fallback";
    fallback.innerHTML = "<div>应用发布者已停止提供此应用</div><a href=\"https://music.randench.cn/#/\" target=\"_blank\" rel=\"noopener\">点击此处查看应用主页</a>";

    const hideLoading = () => {
      loading.classList.remove("is-visible");
    };

    const showFallback = () => {
      hideLoading();
      fallback.classList.add("is-visible");
    };

    const fallbackTimer = window.setTimeout(() => {
      showFallback();
    }, 12000);

    frame.addEventListener("load", () => {
      window.clearTimeout(fallbackTimer);
      hideLoading();
      fallback.classList.remove("is-visible");
    });

    frame.addEventListener("error", () => {
      window.clearTimeout(fallbackTimer);
      showFallback();
    });

    if (shouldShowToast) {
      window.setTimeout(() => {
        toast.classList.remove("is-visible");
      }, 5000);
    }

    frameWrap.appendChild(toast);
    frameWrap.appendChild(frame);
    frameWrap.appendChild(loading);
    frameWrap.appendChild(fallback);

    app.appendChild(frameWrap);

    app.cleanupLoadState = () => {
      window.clearTimeout(fallbackTimer);
    };

    return app;
  };

  const openMusic = () => {
    if (musicWindow && !musicWindow.windowEl?.isConnected) {
      musicWindow = null;
    }
    if (musicWindow) {
      musicWindow.restore();
      return;
    }

    const content = buildMusicApp();

    musicWindow = window.WindowAPI.createWindow({
      title: "音乐",
      content,
      appPath: "apps/music",
      rect: { width: 980, height: 640, x: 80, y: 40 },
      maximizable: true,
      resizable: true,
      onClose: () => {
        content.cleanupLoadState?.();
        musicWindow = null;
        removeStatusControls();
      }
    });
  };

  window.MusicApp = {
    open: openMusic
  };
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initMusicApp, { once: true });
} else {
  initMusicApp();
}
