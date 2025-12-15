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
 * installed_plugins.json的数据结构（用于获取 installPath）
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
 * settings.json 的数据结构
 */
interface SettingsData {
  enabledPlugins?: {
    [key: string]: boolean;
  };
  [key: string]: unknown;
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
 * 从 settings.json 的 enabledPlugins 字段读取已启用的插件
 */
export async function loadInstalledPlugins(): Promise<PluginCard[]> {
  try {
    const cards: PluginCard[] = [];
    const home = await homeDir();

    // 1. 读取 settings.json 获取已启用的插件列表
    const settingsPath = await join(home, '.claude', 'settings.json');
    let enabledPlugins: { [key: string]: boolean } = {};

    try {
      const settingsContent = await api.readFile(settingsPath);
      const settings: SettingsData = JSON.parse(settingsContent);
      enabledPlugins = settings.enabledPlugins || {};
    } catch (err) {
      console.error('Failed to read settings.json:', err);
      return [];
    }

    // 2. 读取 installed_plugins.json 获取 installPath（可选）
    const pluginsJsonPath = await join(home, '.claude', 'plugins', 'installed_plugins.json');
    let installedData: InstalledPluginsData = { version: 1, plugins: {} };

    try {
      const content = await api.readFile(pluginsJsonPath);
      installedData = JSON.parse(content);
    } catch (err) {
      console.warn('Failed to read installed_plugins.json:', err);
      // 继续处理，installPath 将为空
    }

    // 3. 为每个已启用的插件获取描述
    for (const [pluginId, enabled] of Object.entries(enabledPlugins)) {
      if (!enabled) continue; // 跳过未启用的插件

      try {
        // 从 id 中提取 plugin 名称和 marketplace 名称
        // id 格式: "plugin-name@marketplace-name"
        const parts = pluginId.split('@');
        const pluginNameFromId = parts[0];
        const marketplaceName = parts[1] || '';

        let description = '暂无描述';
        let pluginName = pluginNameFromId;

        // marketplace.json 位于 marketplaces/<marketplace-name>/.claude-plugin/marketplace.json
        if (marketplaceName) {
          try {
            const marketplacePath = await join(home, '.claude', 'plugins', 'marketplaces', marketplaceName, '.claude-plugin', 'marketplace.json');
            const marketplaceContent = await api.readFile(marketplacePath);
            const marketplace: MarketplaceData = JSON.parse(marketplaceContent);

            // 在marketplace中查找对应的plugin信息
            const pluginInfo = marketplace.plugins.find(p => p.name === pluginNameFromId);
            if (pluginInfo) {
              pluginName = pluginInfo.name;
              description = pluginInfo.description || '暂无描述';
            }
          } catch (marketplaceErr) {
            console.warn(`Failed to read marketplace.json for ${pluginId}:`, marketplaceErr);
          }
        }

        // 获取 installPath（如果存在）
        const installInfo = installedData.plugins[pluginId];
        const installPath = installInfo?.installPath || '';

        // 4. 创建PluginCard
        cards.push({
          id: pluginId,
          name: pluginName,
          description,
          installPath,
          workspacePath: await getPluginWorkspacePath(pluginId),
        });
      } catch (err) {
        console.error(`Failed to process plugin ${pluginId}:`, err);
      }
    }

    return cards;
  } catch (err) {
    console.error('Failed to load installed plugins:', err);
    return [];
  }
}
