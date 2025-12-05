import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import type { SiteConfig, ProxyConfig } from '../types/index.js';

const DEFAULT_SITES_FILE = './config/sites.json';
const DEFAULT_PROXIES_FILE = './config/proxies.json';

export interface StoredSiteConfig extends SiteConfig {
  username?: string;
  password?: string;
  proxyName?: string;
  workflowImplemented?: boolean;
  createdAt?: string;
}

export interface StoredProxy {
  name: string;
  server: string;
  username?: string;
  password?: string;
}

export class SiteConfigManager {
  private sitesFile: string;
  private proxiesFile: string;
  private sites: Map<string, StoredSiteConfig> = new Map();
  private proxies: Map<string, StoredProxy> = new Map();

  constructor(sitesFile?: string, proxiesFile?: string) {
    this.sitesFile = sitesFile ?? DEFAULT_SITES_FILE;
    this.proxiesFile = proxiesFile ?? DEFAULT_PROXIES_FILE;
  }

  /** Load all configs from disk */
  async load(): Promise<void> {
    await this.loadSites();
    await this.loadProxies();
  }

  private async loadSites(): Promise<void> {
    if (!existsSync(this.sitesFile)) return;
    try {
      const data = await readFile(this.sitesFile, 'utf-8');
      const sites = JSON.parse(data) as StoredSiteConfig[];
      this.sites.clear();
      for (const site of sites) {
        this.sites.set(site.id, site);
      }
      console.log(`📂 Loaded ${sites.length} site configs`);
    } catch (err) {
      console.error('Failed to load site configs:', err);
    }
  }

  private async loadProxies(): Promise<void> {
    if (!existsSync(this.proxiesFile)) return;
    try {
      const data = await readFile(this.proxiesFile, 'utf-8');
      const proxies = JSON.parse(data) as StoredProxy[];
      this.proxies.clear();
      for (const proxy of proxies) {
        this.proxies.set(proxy.name, proxy);
      }
      console.log(`📂 Loaded ${proxies.length} proxy configs`);
    } catch (err) {
      console.error('Failed to load proxy configs:', err);
    }
  }

  private async ensureDir(file: string): Promise<void> {
    const dir = file.substring(0, file.lastIndexOf('/'));
    if (dir && !existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }

  async saveSites(): Promise<void> {
    await this.ensureDir(this.sitesFile);
    const sites = Array.from(this.sites.values());
    await writeFile(this.sitesFile, JSON.stringify(sites, null, 2), 'utf-8');
  }

  async saveProxies(): Promise<void> {
    await this.ensureDir(this.proxiesFile);
    const proxies = Array.from(this.proxies.values());
    await writeFile(this.proxiesFile, JSON.stringify(proxies, null, 2), 'utf-8');
  }

  // Sites
  async addSite(site: StoredSiteConfig): Promise<void> {
    this.sites.set(site.id, {
      ...site,
      createdAt: site.createdAt || new Date().toISOString(),
    });
    await this.saveSites();
  }

  getSite(id: string): StoredSiteConfig | undefined {
    return this.sites.get(id);
  }

  listSites(): StoredSiteConfig[] {
    return Array.from(this.sites.values());
  }

  async deleteSite(id: string): Promise<boolean> {
    const deleted = this.sites.delete(id);
    if (deleted) await this.saveSites();
    return deleted;
  }

  async updateSite(id: string, updates: Partial<StoredSiteConfig>): Promise<StoredSiteConfig | null> {
    const existing = this.sites.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    this.sites.set(id, updated);
    await this.saveSites();
    return updated;
  }

  // Proxies
  async addProxy(proxy: StoredProxy): Promise<void> {
    this.proxies.set(proxy.name, proxy);
    await this.saveProxies();
  }

  getProxy(name: string): StoredProxy | undefined {
    return this.proxies.get(name);
  }

  listProxies(): StoredProxy[] {
    return Array.from(this.proxies.values());
  }

  async deleteProxy(name: string): Promise<boolean> {
    const deleted = this.proxies.delete(name);
    if (deleted) await this.saveProxies();
    return deleted;
  }

  /** Get proxy config for a site */
  getProxyForSite(siteId: string): ProxyConfig | undefined {
    const site = this.sites.get(siteId);
    if (!site?.proxyName) return undefined;
    const proxy = this.proxies.get(site.proxyName);
    if (!proxy) return undefined;
    return {
      server: proxy.server,
      username: proxy.username,
      password: proxy.password,
    };
  }
}
