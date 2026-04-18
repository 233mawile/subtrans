# subtrans

`subtrans` 用来按自定义 `processor` 处理远程代理订阅，并输出新的 YAML。

适用于这类场景：对机场托管的规则、代理组、节点筛选或命名方式不满意，希望在不同 app、不同平台上，用同一套逻辑处理订阅。

## 怎么用

部署好 Worker 后，访问：

```text
https://your-worker-domain/?url=<subscription-url>&script=<processor-script-url>
```

其中：

- `url`：原始订阅地址
- `script`：你自己写的 `processor` 脚本地址

示例：

```text
https://subtrans.example.workers.dev/?url=https%3A%2F%2Fexample.com%2Fsubscription.yaml&script=https%3A%2F%2Fexample.com%2Fprocessor.js
```

将这个地址填入支持远程订阅的客户端即可。不同 app、不同平台拿到的都会是同一份处理结果。

## `processor` 怎么写

`processor` 是一份 JavaScript 文件，要求如下：

- 默认导出一个函数
- 这个函数接收一个配置对象 `config`
- 返回一个新的配置对象

如果脚本里没有敏感内容，建议直接托管到 GitHub，访问方便，也便于维护。可以放在仓库文件里，也可以放成代码片段，只要能通过 `http` 或 `https` 直接访问即可。

最小示例：

```js
export default function processor(config) {
  return config;
}
```

不需要修改时，直接原样返回；需要调整规则、节点或代理组时，在这个函数里处理即可。

## 一个实用例子

下面的例子会：

- 删除名字里包含 `Trial` 的节点
- 给保留下来的节点统一加上 `[Demo]` 前缀
- 顺便同步更新 `proxy-groups` 里引用到的节点名

```js
function isNamedProxy(value) {
  return typeof value === "object" && value !== null && "name" in value;
}

export default function processor(config) {
  const proxies = Array.isArray(config.proxies) ? config.proxies : [];

  const nextProxies = proxies
    .filter((proxy) => isNamedProxy(proxy) && !proxy.name.includes("Trial"))
    .map((proxy) => ({
      ...proxy,
      name: `[Demo] ${proxy.name}`,
    }));

  const proxyGroups = Array.isArray(config["proxy-groups"])
    ? config["proxy-groups"].map((group) => {
        if (!Array.isArray(group.proxies)) {
          return group;
        }

        return {
          ...group,
          proxies: group.proxies
            .filter((name) => !name.includes("Trial"))
            .map((name) => `[Demo] ${name}`),
        };
      })
    : config["proxy-groups"];

  return {
    ...config,
    proxies: nextProxies,
    ...(proxyGroups ? { "proxy-groups": proxyGroups } : {}),
  };
}
```

可参考仓库内示例：[fixtures/processor.js](./fixtures/processor.js)。

## 常见能做的事

`processor` 常见用途：

- 过滤某些节点
- 批量重命名节点
- 调整或重建 `proxy-groups`
- 修改 `rules`
- 保留机场原始内容，只覆盖自己关心的字段

例如只改规则：

```js
export default function processor(config) {
  return {
    ...config,
    rules: [
      "DOMAIN-SUFFIX,openai.com,Proxy",
      "DOMAIN-KEYWORD,github,DIRECT",
      "MATCH,Final",
    ],
  };
}
```

例如补一个代理组：

```js
export default function processor(config) {
  const proxies = Array.isArray(config.proxies) ? config.proxies : [];
  const proxyNames = proxies.map((proxy) => proxy.name);
  const proxyGroups = Array.isArray(config["proxy-groups"])
    ? config["proxy-groups"]
    : [];

  return {
    ...config,
    "proxy-groups": [
      ...proxyGroups,
      {
        name: "All Nodes",
        type: "select",
        proxies: proxyNames,
      },
    ],
  };
}
```

## 给 `processor` 加类型提示

如果使用 JavaScript，也可以获得类型提示。

做法是将 [src/subtransTypes.d.ts](./src/subtransTypes.d.ts) 拷贝到本地，并在 `processor.js` 中添加类型标注。

例如：

```js
/** @type {import("./subtransTypes").Processor} */
export default function processor(config) {
  const proxies = Array.isArray(config.proxies) ? config.proxies : [];

  return {
    ...config,
    proxies: proxies.filter((proxy) => !proxy.name.includes("Trial")),
  };
}
```

这样在支持 TypeScript 语言服务的编辑器中（如 VS Code），可以对 `config.proxies`、`config["proxy-groups"]`、`config.rules` 等字段获得补全和检查。

## 如何部署

只需完成以下步骤：

安装依赖：

```bash
npm install
```

本地调试 Worker：

```bash
npm run worker:dev
```

部署到 Cloudflare Worker：

```bash
npm run worker:deploy
```

Worker 当前使用 [wrangler.jsonc](./wrangler.jsonc) 配置，入口在 [src/cloudflareWorker/index.ts](./src/cloudflareWorker/index.ts)。

## 注意事项

有些机场会根据请求头中的 User-Agent 返回不同类型的订阅内容。这个项目会将客户端请求中的 User-Agent 透传给订阅源。

例如客户端请求 Worker 时带上：

```text
User-Agent: Clash.Meta/1.19.0
```

那么 Worker 在拉取原始订阅时，也会使用相同的 User-Agent 请求上游订阅地址。

## 请求约束

- 只接受 `GET`
- `url` 和 `script` 都必须是 `http` 或 `https` 地址
- `processor` 必须默认导出函数

如果目标是保留机场原始订阅来源，同时统一管理自定义修改逻辑，那么只需要：

1. 写好一个 `processor.js`
2. 用 `url + script` 组合出最终订阅地址
