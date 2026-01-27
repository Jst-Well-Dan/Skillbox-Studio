import { useState } from 'react';
import { LocalSkill } from '../lib/api';
import { Box, Code, FileCode } from 'lucide-react';
import { Checkbox } from './ui/checkbox';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";

interface SkillCardProps {
    skill: LocalSkill;
    isSelected?: boolean;
    onToggle?: () => void;
    className?: string;
}

export function SkillCard({ skill, isSelected, onToggle, className }: SkillCardProps) {

    const [isExpanded, setIsExpanded] = useState(false);
    const isLongDescription = (skill.description?.length || 0) > 100;

    return (
        <Card
            className={`flex flex-col transition-all cursor-pointer border h-full ${isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"} ${className}`}
            onClick={onToggle}
        >
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-lg leading-tight break-words truncate" title={skill.name}>{skill.name}</CardTitle>
                    {onToggle && (
                        <div className="pt-1" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
                            <Checkbox checked={isSelected} className="pointer-events-none" />
                        </div>
                    )}
                </div>
                <Badge className="w-fit mt-2 bg-primary text-primary-foreground hover:bg-primary/80 font-normal border-transparent">LOCAL</Badge>
            </CardHeader>
            <CardContent className="flex-1">
                <p className={`text-sm text-muted-foreground ${isExpanded ? "" : "line-clamp-3"}`} title={!isExpanded ? skill.description : undefined}>
                    {skill.description}
                </p>
                {isLongDescription && (
                    <button
                        className="text-xs text-primary hover:underline mt-1 bg-transparent border-none p-0 h-auto cursor-pointer font-medium"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsExpanded(!isExpanded);
                        }}
                    >
                        {isExpanded ? "收起" : "显示更多"}
                    </button>
                )}
            </CardContent>
            <CardFooter className="text-xs text-muted-foreground justify-between border-t p-4 mt-auto bg-muted/20">
                <div className="flex items-center gap-3">
                    <div className="flex gap-1.5 ml-1">
                        {skill.has_scripts && (
                            <div title="Scripts" className="flex items-center text-foreground/80">
                                <Code className="h-3 w-3" />
                            </div>
                        )}
                        {skill.has_references && (
                            <div title="References" className="flex items-center text-foreground/80">
                                <FileCode className="h-3 w-3" />
                            </div>
                        )}
                        {skill.has_assets && (
                            <div title="Assets" className="flex items-center text-foreground/80">
                                <Box className="h-3 w-3" />
                            </div>
                        )}
                    </div>
                </div>
            </CardFooter>
        </Card>
    );
}
