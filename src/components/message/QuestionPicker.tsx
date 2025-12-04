import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UserQuestion } from "@/types/claude";

interface QuestionPickerProps {
  /**
   * List of questions to display
   */
  questions: UserQuestion[];
  /**
   * Callback when user submits answers
   * @param answers - Map of question index to selected option(s)
   */
  onSubmit: (answers: Record<string, string | string[]>) => void;
  /**
   * Callback when user cancels
   */
  onCancel: () => void;
  /**
   * Whether the submission is in progress
   */
  isLoading?: boolean;
}

/**
 * QuestionPicker - Interactive question selection component
 *
 * Features:
 * - Wizard-style multi-question flow
 * - Single-select and multi-select modes
 * - Keyboard navigation (↑↓ arrows, Enter, Tab, Esc)
 * - Visual feedback and animations
 * - Inline display in message stream
 *
 * @example
 * <QuestionPicker
 *   questions={[...]}
 *   onSubmit={(answers) => console.log(answers)}
 *   onCancel={() => console.log('Cancelled')}
 * />
 */
export const QuestionPicker: React.FC<QuestionPickerProps> = ({
  questions,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const isFirstQuestion = currentQuestionIndex === 0;

  // Reset selected option index when question changes
  useEffect(() => {
    setSelectedOptionIndex(0);
  }, [currentQuestionIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if loading or no current question
      if (isLoading || !currentQuestion) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedOptionIndex((prev) =>
            Math.min(prev + 1, currentQuestion.options.length - 1)
          );
          break;

        case 'ArrowUp':
          e.preventDefault();
          setSelectedOptionIndex((prev) => Math.max(prev - 1, 0));
          break;

        case 'Enter':
          e.preventDefault();
          handleSelectOption(currentQuestion.options[selectedOptionIndex].label);
          break;

        case 'Tab':
          if (!isLastQuestion) {
            e.preventDefault();
            handleNext();
          }
          break;

        case 'Escape':
          e.preventDefault();
          onCancel();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentQuestionIndex,
    selectedOptionIndex,
    isLoading,
    currentQuestion,
    isLastQuestion,
  ]);

  /**
   * Handle option selection
   */
  const handleSelectOption = (label: string) => {
    if (isLoading) return;

    const key = currentQuestionIndex.toString();

    if (currentQuestion.multiSelect) {
      // Multi-select: toggle selection
      setAnswers((prev) => {
        const current = (prev[key] as string[]) || [];
        const newValue = current.includes(label)
          ? current.filter((l) => l !== label)
          : [...current, label];
        return { ...prev, [key]: newValue };
      });
    } else {
      // Single-select: set answer and auto-advance if not last question
      setAnswers((prev) => ({
        ...prev,
        [key]: label,
      }));

      if (!isLastQuestion) {
        // Auto-advance to next question after a short delay
        setTimeout(() => {
          handleNext();
        }, 300);
      }
    }
  };

  /**
   * Navigate to next question
   */
  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  /**
   * Navigate to previous question
   */
  const handleBack = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  /**
   * Submit all answers
   */
  const handleSubmit = () => {
    if (isLoading) return;
    onSubmit(answers);
  };

  /**
   * Check if an option is selected
   */
  const isOptionSelected = (label: string): boolean => {
    const key = currentQuestionIndex.toString();
    if (currentQuestion.multiSelect) {
      return ((answers[key] as string[]) || []).includes(label);
    } else {
      return answers[key] === label;
    }
  };

  if (!currentQuestion) {
    return null;
  }

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="my-4 p-6 border-2 border-blue-500 rounded-lg bg-background/95 backdrop-blur shadow-lg"
    >
      {/* Progress indicator */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 bg-blue-500 text-white text-sm font-medium rounded-full">
            {currentQuestion.header}
          </div>
        </div>
        <span className="text-sm text-muted-foreground font-medium">
          问题 {currentQuestionIndex + 1} / {questions.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-6 h-1 bg-gray-200 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-blue-500"
          initial={{ width: 0 }}
          animate={{
            width: `${((currentQuestionIndex + 1) / questions.length) * 100}%`,
          }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Question text */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {currentQuestion.question}
        </h3>
        {currentQuestion.multiSelect && (
          <p className="text-sm text-muted-foreground">
            可以选择多个选项
          </p>
        )}
      </div>

      {/* Options list */}
      <div className="space-y-3 mb-6">
        {currentQuestion.options.map((option, idx) => {
          const isSelected = isOptionSelected(option.label);
          const isHovered = idx === selectedOptionIndex;

          return (
            <motion.div
              key={option.label}
              onClick={() => handleSelectOption(option.label)}
              onMouseEnter={() => setSelectedOptionIndex(idx)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "p-4 rounded-lg border-2 cursor-pointer transition-all",
                isSelected && "border-blue-500 bg-blue-500/10",
                isHovered && !isSelected && "border-gray-400 bg-accent/50",
                !isSelected && !isHovered && "border-gray-300 hover:border-gray-400"
              )}
            >
              <div className="flex items-start gap-3">
                {/* Selection indicator */}
                <div
                  className={cn(
                    "mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                    isSelected && "bg-blue-500 border-blue-500",
                    !isSelected && "border-gray-400"
                  )}
                >
                  {isSelected && (
                    <svg
                      className="w-3 h-3 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                    </svg>
                  )}
                </div>

                {/* Option content */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground">
                    {option.label}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {option.description}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
          className="min-w-[80px]"
        >
          取消
        </Button>

        <div className="flex gap-2">
          {!isFirstQuestion && (
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={isLoading}
              className="min-w-[80px]"
            >
              上一题
            </Button>
          )}

          {isLastQuestion ? (
            <Button
              onClick={handleSubmit}
              disabled={isLoading}
              className="min-w-[100px] bg-blue-500 hover:bg-blue-600"
            >
              {isLoading ? '提交中...' : '提交答案'}
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              disabled={isLoading}
              className="min-w-[80px] bg-blue-500 hover:bg-blue-600"
            >
              下一题
            </Button>
          )}
        </div>
      </div>

      {/* Keyboard hints */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-muted-foreground text-center">
          <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">
            ↑↓
          </kbd>{' '}
          导航 •{' '}
          <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">
            Enter
          </kbd>{' '}
          选择 •{' '}
          <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">
            Tab
          </kbd>{' '}
          下一题 •{' '}
          <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">
            Esc
          </kbd>{' '}
          取消
        </p>
      </div>
    </motion.div>
  );
};
