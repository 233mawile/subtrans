export interface ClashConfig {
  proxies?: Proxy[];
  "proxy-groups"?: ProxyGroup[];
  "proxy-providers"?: Record<string, ProxyProvider>;
  rules?: string[];
  "rule-providers"?: Record<string, RuleProvider>;
  dns?: DnsConfig;
  [key: string]: unknown;
}

export type DnsServer = string;

export type DnsServerList = DnsServer[];

export type DnsPolicyValue = DnsServer | DnsServerList;

export interface DnsFallbackFilter {
  domain?: string[];
  geoip?: boolean;
  "geoip-code"?: string;
  geosite?: string[];
  ipcidr?: string[];
  [key: string]: unknown;
}

export interface DnsConfig {
  enable?: boolean;
  "cache-algorithm"?: "arc" | "lru";
  "default-nameserver"?: DnsServerList;
  "direct-nameserver"?: DnsServerList;
  "direct-nameserver-follow-policy"?: boolean;
  "enhanced-mode"?: "fake-ip" | "redir-host";
  fallback?: DnsServerList;
  "fallback-filter"?: DnsFallbackFilter;
  "fake-ip-filter"?: string[];
  "fake-ip-filter-mode"?: "blacklist" | "rule" | "whitelist";
  "fake-ip-range"?: string;
  "fake-ip-range6"?: string;
  "fake-ip-ttl"?: number;
  ipv6?: boolean;
  listen?: string;
  nameserver?: DnsServerList;
  "nameserver-policy"?: Record<string, DnsPolicyValue>;
  "prefer-h3"?: boolean;
  "proxy-server-nameserver"?: DnsServerList;
  "proxy-server-nameserver-policy"?: Record<string, DnsPolicyValue>;
  "respect-rules"?: boolean;
  "use-hosts"?: boolean;
  "use-system-hosts"?: boolean;
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
