# Trinity API

本文档说明桌面壳与内置应用对外暴露的浏览器端 API，以及使用方法。

## WindowAPI

`window.WindowAPI` 由窗口管理器提供（script/window/script.js），用于创建和控制应用窗口。

### createWindow(options)

创建一个新窗口并返回窗口控制实例。

参数：
- `title` (string)：窗口标题。
- `content` (string | HTMLElement)：窗口内容。
- `appPath` (string)：应用路径，用于默认图标（例如 "apps/note"）。
- `icon` (string)：自定义图标 URL，优先于 `appPath`。
- `rect` (object)：初始位置与尺寸 `{ width, height, x, y }`（像素）。
- `maximizable` (boolean)：是否允许最大化。默认 true。
- `resizable` (boolean)：是否允许缩放。默认 true。
- `onClose` (function)：关闭后回调。

返回：`AppWindow` 实例（方法如下）。

AppWindow 方法：
- `focus()`：置顶并聚焦。
- `blur()`：标记为失焦。
- `setRect(rect)`：设置 `{ width, height, x, y }`。
- `getRect()`：获取当前尺寸位置。
- `toggleMaximize()`：最大化/还原。
- `minimize()`：最小化到状态栏。
- `toggleMinimize()`：最小化/还原。
- `restore()`：从最小化恢复。
- `close()`：关闭窗口并销毁。

示例：
```js
const win = window.WindowAPI.createWindow({
  title: "My App",
  content: "<div>Hello</div>",
  appPath: "apps/my-app",
  rect: { width: 420, height: 300, x: 120, y: 80 },
  maximizable: true,
  resizable: true,
  onClose: () => console.log("closed")
});

// Later
win.minimize();
```

## FilesAPI

`window.FilesAPI` 由文件管理器提供（apps/files/app.js），用于文件选择与虚拟文件系统读写。

### pickFile(options)

打开文件选择器。

参数：
- `title` (string)：选择器标题。默认 "选择文件"。
- `allowFolders` (boolean)：允许选择文件夹。
- `textOnly` (boolean)：仅显示文本文件。

返回：文件/文件夹对象或 `null`（取消时）。对象至少包含 `id`、`name`、`type`，可能包含 `mime`、`size`。

### readTextFile(id)

读取文本文件。

返回：
- `{ id, name, mime, size, content }` 或 `null`。

### readFile(id)

读取文件并返回 Blob。

返回：
- `{ id, name, mime, size, blob }` 或 `null`。

### writeTextFile(id, content, options)

写入文本到已有文件。

参数：
- `name` (string)：可选新文件名。
- `mime` (string)：可选 MIME 类型。

返回：
- `{ id, name, mime, size }` 或 `null`。

### createTextFile(name, content, parentId)

新建文本文件（`parentId` 为空时创建在根目录）。

返回：
- `{ id, name, type: "file", mime: "text/plain", size }`。

示例：
```js
const picked = await window.FilesAPI.pickFile({ textOnly: true });
if (picked) {
  const data = await window.FilesAPI.readTextFile(picked.id);
  console.log(data?.content);
}
```

## FilesApp

`window.FilesApp` 是打开文件管理器 UI 的便捷入口。

### open()

打开文件管理器窗口。

示例：
```js
window.FilesApp.open();
```

## RightMenuAPI

`window.RightMenuAPI` 由统一右键菜单模块提供（script/rightmenu/script.js），用于创建可复用的上下文菜单。

该 API 只提供菜单框架、显示定位与动画，菜单项内容与点击行为由各 App 在创建实例时传入。

### create(options)

创建一个右键菜单实例。

参数：
- `className` (string)：可选，附加到菜单根节点的 class。
- `items` (array)：静态菜单项数组。
- `getItems(context)` (function)：动态菜单项工厂，优先于 `items`。
- `onSelect(action, context, item)` (function)：点击菜单项回调。
- `mount` (HTMLElement)：可选，菜单挂载容器，默认 `.stage`。

菜单项字段：
- `label` (string)：按钮文本。
- `action` (string)：动作标识。
- `disabled` (boolean)：是否禁用。
- `hidden` (boolean)：是否隐藏。
- `keepOpen` (boolean)：点击后是否保持菜单开启。
- `type` (string)：当为 `"separator"` 时渲染分隔线。

返回：菜单实例（方法如下）。

菜单实例方法：
- `show({ x, y, context, items })`：在视口坐标显示菜单。
- `hide()`：隐藏菜单。
- `destroy()`：销毁菜单实例并移除 DOM。

### hideAll()

关闭当前活动菜单（如果存在）。

### 示例：静态菜单

```js
const menu = window.RightMenuAPI.create({
  className: "demo-menu",
  items: [
    { label: "打开", action: "open" },
    { label: "删除", action: "delete" }
  ],
  onSelect: (action, context) => {
    console.log(action, context);
  }
});

target.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  menu.show({ x: event.clientX, y: event.clientY, context: target });
});
```

### 示例：动态菜单

```js
const menu = window.RightMenuAPI.create({
  getItems: (ctx) => [
    { label: "打开", action: "open" },
    { label: "添加至桌面", action: "pin", hidden: !ctx?.canPin }
  ],
  onSelect: (action, ctx) => {
    if (action === "open") ctx.open();
    if (action === "pin") ctx.pin();
  }
});
```
