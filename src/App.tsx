import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getAgents, getMarketplaceData, installPlugin, installLocalSkill, AgentConfig, Plugin, LocalSkill } from "./lib/api";
import { Topbar } from "./components/Topbar";
import { SkillMarket } from "./components/SkillMarket";
import { InstallScope } from "./components/InstallScope";
import { AgentSelector } from "./components/AgentSelector";
import { InstallResult } from "./components/InstallResult";
import { InstalledPluginsPage } from "./components/InstalledPluginsPage";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "./components/ui/button";

function App() {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState<"install" | "installed">("install");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [plugins, setPlugins] = useState<Plugin[]>([]);

  // Selection State
  const [selectedPlugins, setSelectedPlugins] = useState<string[]>([]);
  const [scope, setScope] = useState<"global" | "project">("global");
  const [projectPath, setProjectPath] = useState("");
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);

  // Local Install State
  const [installMode, setInstallMode] = useState<'marketplace' | 'local'>('marketplace');
  const [selectedLocalSkills, setSelectedLocalSkills] = useState<LocalSkill[]>([]);

  // Installation State
  const [installStatus, setInstallStatus] = useState<"idle" | "installing" | "success" | "error">("idle");
  const [installMessage, setInstallMessage] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      // Load Agents locally first, then try loading marketplace
      const agentsData = await getAgents();
      setAgents(agentsData);

      // Determine default selection
      let defaultSelection: string[] = [];
      try {
        const starred = localStorage.getItem("starred_agents");
        if (starred) {
          const starredList = JSON.parse(starred);
          if (Array.isArray(starredList) && starredList.length > 0) {
            defaultSelection = starredList;
          }
        }
      } catch (e) {
        console.error("Failed to read starred agents for default selection", e);
      }

      // Fallback to strict default if no stars
      if (defaultSelection.length === 0) {
        defaultSelection = ["claude"];
      }

      const pre = agentsData.filter(a => defaultSelection.includes(a.id)).map(a => a.id);
      setSelectedAgents(pre);

      const marketData = await getMarketplaceData();
      setPlugins(marketData.plugins);
      setError(null);
    } catch (e: any) {
      console.error(e);
      setError(e.toString() || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleInstall = async () => {
    setInstallStatus("installing");
    setInstallMessage(t('common.installing'));

    try {
      if (installMode === 'local' && selectedLocalSkills.length > 0) {
        const results = [];
        for (const skill of selectedLocalSkills) {
          setInstallMessage(prev => prev ? prev + `\n` + t('common.installing_local', { name: skill.name }) : t('common.installing_local', { name: skill.name }));
          const res = await installLocalSkill(skill.path, scope, selectedAgents, projectPath || undefined);
          results.push(t('common.install_result', { name: skill.name, result: res }));
        }
        setInstallMessage(results.join("\n"));
        setInstallStatus("success");
      } else {
        // Marketplace Install
        const results = [];
        for (const pluginName of selectedPlugins) {
          // Update message for current plugin
          setInstallMessage(prev => prev ? prev + `\n` + t('common.installing_market', { name: pluginName }) : t('common.installing_market', { name: pluginName }));

          const res = await installPlugin(pluginName, selectedAgents, scope, projectPath || undefined);
          results.push(t('common.install_result', { name: `${t('common.plugin')} ${pluginName}`, result: res }));
        }
        setInstallMessage(results.join("\n"));
        setInstallStatus("success");
        // Clear selections on success
        setSelectedPlugins([]);
      }
    } catch (e: any) {
      setInstallMessage(`${t('dialogs.titles.error')}: ${e.toString()}`);
      setInstallStatus("error");
    }
  };

  const handleLocalInstallRequest = (skills: LocalSkill[]) => {
    setInstallMode('local');
    setSelectedLocalSkills(skills);
    setStep(2); // Move to Scope selection
  };

  // Reset install mode when going back to step 1
  useEffect(() => {
    if (step === 1) {
      setInstallMode('marketplace');
      setSelectedLocalSkills([]);
    }
  }, [step]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-6 text-center space-y-4 bg-background">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h1 className="text-xl font-bold">{t('common.error')}</h1>
        <p className="text-muted-foreground max-w-lg">{error}</p>
        <div className="text-sm border p-4 rounded-md bg-muted max-w-lg text-left">
          <p className="font-semibold mb-2">{t('common.troubleshoot')}</p>
          <ul className="list-disc list-inside space-y-1">
            <li dangerouslySetInnerHTML={{ __html: t('common.troubleshoot_repo') }} />
            <li dangerouslySetInnerHTML={{ __html: t('common.troubleshoot_market') }} />
          </ul>
        </div>
        <Button onClick={() => window.location.reload()}>{t('common.retry')}</Button>
      </div >
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden font-sans antialiased">
      <Topbar currentPage={currentPage} onPageChange={setCurrentPage} currentStep={currentPage === "install" ? step : undefined} onRefresh={loadData} />

      <main className="flex-1 overflow-hidden relative">
        {currentPage === "install" ? (
          <>
            {step === 1 && (
              <SkillMarket
                plugins={plugins}
                selectedPlugins={selectedPlugins}
                onTogglePlugin={(name) => {
                  setSelectedPlugins(prev =>
                    prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
                  );
                }}
                onNext={() => setStep(2)}
                onLocalInstall={handleLocalInstallRequest}
                onRefresh={loadData}
              />
            )}

            {step === 2 && (
              <InstallScope
                scope={scope}
                projectPath={projectPath}
                onScopeChange={setScope}
                onProjectPathChange={setProjectPath}
                onNext={() => setStep(3)}
                onBack={() => setStep(1)}
              />
            )}

            {step === 3 && (
              <AgentSelector
                agents={agents}
                selectedAgents={selectedAgents}
                onToggleAgent={(id) => {
                  setSelectedAgents(prev =>
                    prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
                  );
                }}
                onBack={() => setStep(2)}
                onInstall={handleInstall}
                installing={installStatus === 'installing'}
              />
            )}
          </>
        ) : (
          <InstalledPluginsPage />
        )}
      </main>

      {installStatus !== 'idle' && (
        <InstallResult
          status={installStatus as any}
          message={installMessage}
          onClose={() => {
            setInstallStatus("idle");
            if (installStatus === 'success') {
              setStep(1);
            }
          }}
        />
      )}
    </div>
  );
}

export default App;
