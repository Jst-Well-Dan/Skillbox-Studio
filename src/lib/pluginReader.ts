import { api } from './api';
import { homeDir, join } from '@tauri-apps/api/path';

/**
 * Plugin卡片数据结构
 */
export interface PluginCard {
  id: string;                    // 例如: "document-skills@anthropic-agent-skills"
  name: string;                  // 例如: "document-skills"
  description: string;           // 从marketplace.json读取
  installPath: string;           // 安装路径
  workspacePath: string;         // 固定映射的工作区路径
}

/**
 * installed_plugins.json的数据结构
 */
interface InstalledPluginsData {
  version: number;
  plugins: {
    [key: string]: {
      version: string;
      installedAt: string;
      lastUpdated: string;
      installPath: string;
      gitCommitSha?: string;
      isLocal?: boolean;
    };
  };
}

/**
 * marketplace.json的数据结构
 */
interface MarketplaceData {
  name: string;
  owner?: {
    name: string;
    email: string;
  };
  metadata?: {
    description: string;
    version: string;
  };
  plugins: Array<{
    name: string;
    description: string;
    source: string;
    strict?: boolean;
    skills?: string[];
  }>;
}

/**
 * 获取Plugin的固定工作区路径
 */
async function getPluginWorkspacePath(pluginId: string): Promise<string> {
  // 从 "document-skills@anthropic-agent-skills" 提取 "document-skills"
  const pluginName = pluginId.split('@')[0];

  // 返回固定路径：~/Documents/Claude-Workspaces/{plugin-name}/
  const home = await homeDir();
  return join(home, 'Documents', 'Claude-Workspaces', pluginName);
}

/**
 * 加载已安装的所有Plugin并转换为PluginCard
 */
export async function loadInstalledPlugins(): Promise<PluginCard[]> {
  try {
    const cards: PluginCard[] = [];

    // 1. 读取 installed_plugins.json
    const home = await homeDir();
    const pluginsJsonPath = await join(home, '.claude', 'plugins', 'installed_plugins.json');

    let installedData: InstalledPluginsData;
    try {
      const content = await api.readFile(pluginsJsonPath);
      installedData = JSON.parse(content);
    } catch (err) {
      console.error('Failed to read installed_plugins.json:', err);
      return []; // 如果文件不存在或读取失败，返回空数组
    }

    // 2. 为每个plugin读取marketplace.json获取描述
    for (const [id, info] of Object.entries(installedData.plugins)) {
      try {
        const marketplacePath = await join(info.installPath, '.claude-plugin', 'marketplace.json');

        let description = '暂无描述';
        let pluginName = id.split('@')[0]; // 降级方案

        // 尝试读取marketplace.json
        try {
          const marketplaceContent = await api.readFile(marketplacePath);
          const marketplace: MarketplaceData = JSON.parse(marketplaceContent);

          // 在marketplace中查找对应的plugin信息
          const pluginInfo = marketplace.plugins.find(p => id.startsWith(p.name));
          if (pluginInfo) {
            pluginName = pluginInfo.name;
            description = pluginInfo.description || '暂无描述';
          }
        } catch (marketplaceErr) {
          // marketplace.json不存在或读取失败，使用降级方案
          console.warn(`Failed to read marketplace.json for ${id}:`, marketplaceErr);
        }

        // 3. 创建PluginCard
        cards.push({
          id,
          name: pluginName,
          description,
          installPath: info.installPath,
          workspacePath: await getPluginWorkspacePath(id),
        });
      } catch (err) {
        console.error(`Failed to process plugin ${id}:`, err);
        // 即使某个plugin处理失败，也继续处理其他plugin
      }
    }

    return cards;
  } catch (err) {
    console.error('Failed to load installed plugins:', err);
    return [];
  }
}
