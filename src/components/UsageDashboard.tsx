import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api, type UsageStats } from "@/lib/api";
import {
  Filter,
  Loader2,
  ArrowLeft,
  RefreshCw
} from "lucide-react";

interface UsageDashboardProps {
  /**
   * Callback when back button is clicked
   */
  onBack: () => void;
}

// Cache for storing fetched data
const dataCache = new Map<string, { data: any; timestamp: number }>();

// 🚀 性能优化：差异化缓存策略
// 历史数据（7d, 30d, all）缓存30分钟，因为不常变化
// 当日数据（today）缓存5分钟，因为可能有新会话
const CACHE_DURATION_HISTORICAL = 30 * 60 * 1000; // 30 minutes for historical data
const CACHE_DURATION_TODAY = 5 * 60 * 1000; // 5 minutes for today's data

/**
 * Optimized UsageDashboard component with caching and progressive loading
 */
export const UsageDashboard: React.FC<UsageDashboardProps> = ({ onBack }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [selectedDateRange, setSelectedDateRange] = useState<"today" | "7d" | "30d" | "all">("7d");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Memoized formatters to prevent recreation on each render
  const formatCurrency = useMemo(() => (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }, []);

  const formatNumber = useMemo(() => (num: number): string => {
    return new Intl.NumberFormat('en-US').format(num);
  }, []);

  const formatTokens = useMemo(() => (num: number): string => {
    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(2)}M`;
    } else if (num >= 1_000) {
      return `${(num / 1_000).toFixed(1)}K`;
    }
    return formatNumber(num);
  }, [formatNumber]);

  // Function to get cached data or null
  const getCachedData = useCallback((key: string, dateRange: string) => {
    const cached = dataCache.get(key);
    if (!cached) return null;

    // 🚀 差异化缓存时间：历史数据缓存更久
    const cacheDuration = dateRange === 'today'
      ? CACHE_DURATION_TODAY
      : CACHE_DURATION_HISTORICAL;

    if (Date.now() - cached.timestamp < cacheDuration) {
      return cached.data;
    }
    return null;
  }, []);

  // Function to set cached data
  const setCachedData = useCallback((key: string, data: any) => {
    dataCache.set(key, { data, timestamp: Date.now() });
  }, []);

  const loadUsageStats = useCallback(async () => {
    const cacheKey = `usage-${selectedDateRange}`;

    // Check cache first - 🚀 传入 dateRange 使用差异化缓存
    const cachedStats = getCachedData(`${cacheKey}-stats`, selectedDateRange);

    if (cachedStats) {
      setStats(cachedStats);
      setLoading(false);
      return;
    }

    try {
      // Always show loading when fetching
        setLoading(true);
      setError(null);

      // Get today's date range
      const today = new Date();
      // 🚀 修复时区问题：使用本地日期格式而不是 ISO 字符串
      const formatLocalDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      let statsData: UsageStats;

      // 🚀 性能优化：优先使用缓存API
      if (selectedDateRange === "today") {
        // Today only - 使用本地日期字符串避免时区问题
        const todayDateStr = formatLocalDate(today);
        statsData = await api.getUsageByDateRange(todayDateStr, todayDateStr);
      } else if (selectedDateRange === "all") {
        // 🚀 使用缓存API获取全部数据（性能提升关键）
        try {
          statsData = await api.getUsageStatsCached();  // 缓存版本
        } catch (error) {
          // 降级：缓存失败则使用原API
          console.warn("Cache API failed, falling back to original API:", error);
          statsData = await api.getUsageStats();
        }
      } else {
        const days = selectedDateRange === "7d" ? 7 : 30;
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // 🚀 性能优化：使用缓存API（7d/30d场景）
        try {
          statsData = await api.getUsageStatsCached(days);  // 使用缓存API + 天数过滤
        } catch (error) {
          // 降级：缓存失败则使用原API
          console.warn("Cache API failed, falling back to date range API:", error);
          statsData = await api.getUsageByDateRange(
            formatLocalDate(startDate),
            formatLocalDate(endDate)
          );
        }
      }

      // Update state
      setStats(statsData);
      setLastUpdated(new Date());

      // Cache the data
      setCachedData(`${cacheKey}-stats`, statsData);
    } catch (err: any) {
      console.error("Failed to load usage stats:", err);
      setError("Failed to load usage statistics. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [selectedDateRange, getCachedData, setCachedData]);  // ⚡ 移除 stats, sessionStats 依赖，避免无限循环

  // 手动刷新数据（清除缓存）
  const handleRefresh = useCallback(() => {
    // 清除当前日期范围的缓存
    const cacheKey = `usage-${selectedDateRange}`;
    dataCache.delete(`${cacheKey}-stats`);

    // 重新加载数据
    loadUsageStats();
  }, [selectedDateRange, loadUsageStats]);

  // Load data on mount and when date range changes
  useEffect(() => {
    loadUsageStats();
  }, [loadUsageStats])

  // Memoize expensive computations
  const summaryCards = useMemo(() => {
    if (!stats) return null;
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 shimmer-hover">
          <div>
            <p className="text-caption text-muted-foreground">总费用</p>
            <p className="text-display-2 mt-1">
              {formatCurrency(stats.total_cost)}
            </p>
          </div>
        </Card>

        <Card className="p-4 shimmer-hover">
          <div>
            <p className="text-caption text-muted-foreground">总会话数</p>
            <p className="text-display-2 mt-1">
              {formatNumber(stats.total_sessions)}
            </p>
          </div>
        </Card>

        <Card className="p-4 shimmer-hover">
          <div>
            <p className="text-caption text-muted-foreground">总令牌数</p>
            <p className="text-display-2 mt-1">
              {formatTokens(stats.total_tokens)}
            </p>
          </div>
        </Card>

        <Card className="p-4 shimmer-hover">
          <div>
                        <p className="text-caption text-muted-foreground">平均成本/会话</p>
            <p className="text-display-2 mt-1">
              {formatCurrency(
                stats.total_sessions > 0 
                  ? stats.total_cost / stats.total_sessions 
                  : 0
              )}
            </p>
          </div>
        </Card>
      </div>
    );
  }, [stats, formatCurrency, formatNumber, formatTokens]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto flex flex-col h-full">
        {/* Header */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回主页
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-heading-1">使用情况仪表板</h1>
              <p className="mt-1 text-body-small text-muted-foreground">
                跟踪您的 Claude Code 使用情况和费用
              </p>
              {lastUpdated && (
                <p className="text-xs text-muted-foreground/70 mt-1">
                  最后更新: {lastUpdated.toLocaleString('zh-CN', {
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              )}
            </div>
            {/* Date Range Filter and Refresh */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={loading}
                title="刷新数据"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <div className="flex space-x-1">
                  {(["today", "7d", "30d", "all"] as const).map((range) => (
                    <Button
                      key={range}
                      variant={selectedDateRange === range ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedDateRange(range)}
                      disabled={loading}
                    >
                      {range === "today" ? "今日" : range === "all" ? "全部" : range === "7d" ? "最近7天" : "最近30天"}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">正在加载使用统计...</p>
              <p className="text-xs text-muted-foreground/60">首次加载可能需要几秒钟</p>
            </div>
          ) : error ? (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/50 text-body-small text-destructive">
              {error}
              <Button onClick={() => loadUsageStats()} size="sm" className="ml-4">
                Try Again
              </Button>
            </div>
          ) : stats ? (
            <div className="space-y-6">
              {/* 🎯 简化版：只保留核心概览 */}
              {/* Summary Cards */}
              {summaryCards}

              {/* Token 统计详情 */}
              <Card className="p-6">
                <h3 className="text-label mb-4">Token 统计</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-caption text-muted-foreground">输入 Tokens</p>
                    <p className="text-heading-4">{formatTokens(stats.total_input_tokens)}</p>
                  </div>
                  <div>
                    <p className="text-caption text-muted-foreground">输出 Tokens</p>
                    <p className="text-heading-4">{formatTokens(stats.total_output_tokens)}</p>
                  </div>
                  <div>
                    <p className="text-caption text-muted-foreground">Cache 写入</p>
                    <p className="text-heading-4">{formatTokens(stats.total_cache_creation_tokens)}</p>
                  </div>
                  <div>
                    <p className="text-caption text-muted-foreground">Cache 读取</p>
                    <p className="text-heading-4">{formatTokens(stats.total_cache_read_tokens)}</p>
                  </div>
                </div>
              </Card>

              {/* 💡 小白用户友好提示 */}
              <Card className="p-6 bg-muted/30">
                <p className="text-sm text-muted-foreground text-center">
                  这是您使用 Claude 的总体情况概览
                </p>
              </Card>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};