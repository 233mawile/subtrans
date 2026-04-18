export interface ClashConfig {
  proxies?: Proxy[];
  "proxy-groups"?: ProxyGroup[];
  "proxy-providers"?: Record<string, ProxyProvider>;
  rules?: string[];
  "rule-providers"?: Record<string, RuleProvider>;
  dns?: Record<string, unknown>;
  [key: string]: unknown;
}

export type Proxy =
  | ShadowsocksProxy
  | VmessProxy
  | VlessProxy
  | TrojanProxy
  | BaseProxy;

export interface BaseProxy {
  name: string;
  port: number;
  server: string;
  type: string;
  [key: string]: unknown;
}

export interface ShadowsocksProxy extends BaseProxy {
  cipher: string;
  password: string;
  type: "ss";
  udp?: boolean;
}

export interface VmessProxy extends BaseProxy {
  alterId?: number;
  cipher?: string;
  network?: "grpc" | "h2" | "tcp" | "ws";
  servername?: string;
  tls?: boolean;
  type: "vmess";
  uuid: string;
}

export interface VlessProxy extends BaseProxy {
  flow?: string;
  network?: string;
  tls?: boolean;
  type: "vless";
  uuid: string;
}

export interface TrojanProxy extends BaseProxy {
  password: string;
  sni?: string;
  type: "trojan";
}

export interface ProxyGroup {
  interval?: number;
  name: string;
  proxies?: string[];
  tolerance?: number;
  type: "fallback" | "load-balance" | "relay" | "select" | "url-test";
  url?: string;
  use?: string[];
  [key: string]: unknown;
}

export interface ProxyProvider {
  filter?: string;
  "health-check"?: {
    enable: boolean;
    interval: number;
    url: string;
  };
  interval?: number;
  override?: Record<string, unknown>;
  path: string;
  type: "file" | "http";
  url?: string;
}

export interface RuleProvider {
  behavior?: "classical" | "domain" | "ipcidr";
  format?: "text" | "yaml";
  interval?: number;
  path?: string;
  type?: "file" | "http";
  url?: string;
  [key: string]: unknown;
}

export type Processor = (config: ClashConfig) => ClashConfig;
