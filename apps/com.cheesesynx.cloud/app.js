const initCloudApp = () => {
  if (!window.WindowAPI) return;

  const statusBar = document.querySelector(".status-bar");
  const statusTime = document.getElementById("timeDisplay");

  let cloudWindow = null;
  let statusControls = null;

  const removeStatusControls = () => {
    if (statusControls) {
      statusControls.remove();
      statusControls = null;
    }
  };

  const buildCloudApp = () => {
    const app = document.createElement("div");
    app.className = "cloud-app";

    const frameWrap = document.createElement("div");
    frameWrap.className = "cloud-frame-wrap";


    const toast = document.createElement("div");
    toast.className = "cloud-toast";
    toast.textContent = "此App是由CheeseSynx官方提供";
    const toastKey = "trinityCloudToastSeen";
    const shouldShowToast = !localStorage.getItem(toastKey);
    if (shouldShowToast) {
      toast.classList.add("is-visible");
      localStorage.setItem(toastKey, "true");
    }

    const frame = document.createElement("iframe");
    frame.className = "cloud-frame";
    frame.src = "https://cloud.cheesesynx.cn/";
    frame.title = "芝士云-控制面板";
    frame.loading = "lazy";

    const loading = document.createElement("div");
    loading.className = "cloud-loading is-visible";
    loading.innerHTML = "<div class=\"cloud-loading-spinner\" aria-hidden=\"true\"></div><div class=\"cloud-loading-text\">正在加载芝士云...</div>";

    const fallback = document.createElement("div");
    fallback.className = "cloud-fallback";
    fallback.innerHTML = "<div>应用启动过程中出现问题</div><a href=\"https://cloud.cheesesynx.cn/\" target=\"_blank\" rel=\"noopener\">点击此处在新标签页打开</a>";

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

  const openCloud = () => {
    if (cloudWindow && !cloudWindow.windowEl?.isConnected) {
      cloudWindow = null;
    }
    if (cloudWindow) {
      cloudWindow.restore();
      return;
    }

    const content = buildCloudApp();

    cloudWindow = window.WindowAPI.createWindow({
      title: "芝士云-控制面板",
      content,
      appPath: "apps/com.cheesesynx.cloud",
      rect: { width: 980, height: 640, x: 80, y: 40 },
      maximizable: true,
      resizable: true,
      onClose: () => {
        content.cleanupLoadState?.();
        cloudWindow = null;
        removeStatusControls();
      }
    });
  };

  window.CloudApp = {
    open: openCloud
  };

  // Backward-compatible global name for older metadata/references.
  window.CheeseCloud = window.CloudApp;
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCloudApp, { once: true });
} else {
  initCloudApp();
}
