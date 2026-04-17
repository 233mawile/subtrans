function isNamedProxy(value) {
  return typeof value === "object" && value !== null && "name" in value;
}

export default function processClashConfig(config) {
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
