import React from "react";
import { ChevronDown, Check } from "lucide-react";
import type { ModelConfig, ModelType } from "./types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface ModelSelectorProps {
  models: ModelConfig[];
  selectedModel: ModelType;
  onSelect: (model: ModelType) => void;
  disabled?: boolean;
}

const getDisplayModel = (
  models: ModelConfig[],
  selectedModel: ModelType
): ModelConfig | undefined => {
  return models.find((model) => model.id === selectedModel);
};

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  models,
  selectedModel,
  onSelect,
  disabled,
}) => {
  const activeModel =
    getDisplayModel(models, selectedModel) ?? models[0] ?? null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 rounded-full px-3"
          disabled={disabled || !activeModel}
        >
          <div className="flex items-center gap-2 text-nowrap">
            {activeModel?.icon && (
              <span className="text-primary">{activeModel.icon}</span>
            )}
            <span className="text-sm font-medium">
              {activeModel?.name ?? "选择模型"}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {models.map((model) => {
          const isActive = model.id === selectedModel;
          return (
            <DropdownMenuItem
              key={model.id}
              disabled={disabled}
              onClick={() => onSelect(model.id)}
              className={cn(
                "flex items-center justify-between gap-2 py-2 text-sm",
                isActive && "text-primary font-medium"
              )}
            >
              <div className="flex items-center gap-3">
                <span className="text-primary">{model.icon}</span>
                <div className="flex flex-col">
                  <span>{model.name}</span>
                  {model.description && (
                    <span className="text-xs text-muted-foreground">
                      {model.description}
                    </span>
                  )}
                </div>
              </div>
              {isActive && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
