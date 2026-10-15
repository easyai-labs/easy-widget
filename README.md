# easy-chat-widget

供第三方网站嵌入的智能客服 JS 组件。嵌入后网站右下角出现客服按钮，点击打开聊天窗口；消息调用 [core-service](../core-service) 的公开 chat 接口，由对应应用的 RAG 知识库回答。

## 快速开始

```html
<script
  src="https://<your-core-service-host>/widget/easy-chat-widget.js"
  data-app-id="d19f5e7c-a67d-47d2-8761-6f6e7988396b"
></script>
```

或在脚本加载前设置全局变量：

```html
<script>
  window.EasyAIChatWidget = {
    app_id: 'd19f5e7c-a67d-47d2-8761-6f6e7988396b',
    base_url: 'https://your-core-service-host',
    title: '网站客服',
  };
</script>
<script src="easy-chat-widget.js"></script>
```

## 配置项

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `app_id` | 是 | 应用的 app ID（UUID，core-service 中创建应用后获得），接口据此定位知识库与模型 |
| `base_url` | 否 | core-service 地址，默认取脚本自身所在的 origin（脚本由 core-service 托管时无需填写） |
| `title` | 否 | 聊天窗口头部与欢迎语中显示的名称，默认「智能客服」 |

两种传参方式可同时使用，`data-*` 属性优先。

## 行为说明

- 调用 `POST {base_url}/api/v1/pub/chat/completions/{app_id}`，无需鉴权，app 由不可猜测的 UUID 定位（不在前端暴露项目名/应用名）。
- 服务端返回的 `user_id` / `conversation_id` 持久化在 localStorage（按 app_id 隔离），后续请求自动携带以保持上下文；最近 50 条消息本地保存，重开窗口可恢复显示。
- 聊天窗口头部的「新建会话」按钮清除本地会话，从新对话开始。
- 回答若带 RAG 引用来源，消息下方会显示「引用了 N 个来源」，可展开查看。
- 样式全部封装在 Shadow DOM 内，不会与宿主页面互相影响；小屏幕（≤480px）下面板全屏。

## 开发

```bash
npm run dev     # 启动开发服务器，打开根目录 index.html 演示页
npm run build   # 构建到 dist/easy-chat-widget.js（单文件 IIFE，零依赖）
```

本地联调需 core-service 运行在 `127.0.0.1:8080`（见 ../core-service）。构建产物验证：`npm run build` 后在 demo/ 目录用任意静态服务器打开 `demo.html`。

## 注意

公开 chat 接口需要 core-service 对 `/api/v1/pub/*` 开启 CORS（core-service 的 `middleware.CORS` 已挂载在公开路由组上），否则第三方站点跨域调用会被浏览器拦截。
