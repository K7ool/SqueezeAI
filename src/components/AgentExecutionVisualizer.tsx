/**
 * ENHANCED AGENT EXECUTION VISUALIZATION
 *
 * React component for showing real-time Engineering Agent execution state
 * Instead of generic spinners, shows actual progress
 */

import React from 'react';
import { Brain, Search, FileSearch, Lightbulb, Hammer, TestTube, Bug, CheckCircle2, AlertCircle } from 'lucide-react';

export type AgentStage =
  | 'understanding'
  | 'inspecting'
  | 'analyzing'
  | 'planning'
  | 'executing'
  | 'testing'
  | 'debugging'
  | 'verifying'
  | 'completed'
  | 'failed';

export interface AgentExecutionState {
  currentStage: AgentStage;
  progress: number; // 0-100
  stageDetails: string;
  completedStages: AgentStage[];
  errors: string[];
}

interface Props {
  state: AgentExecutionState;
}

const stageConfig: Record<AgentStage, { icon: any; label: string; color: string }> = {
  understanding: { icon: Brain, label: 'Understanding Intent', color: 'text-purple-500' },
  inspecting: { icon: FileSearch, label: 'Inspecting Project', color: 'text-blue-500' },
  analyzing: { icon: Search, label: 'Analyzing Dependencies', color: 'text-cyan-500' },
  planning: { icon: Lightbulb, label: 'Creating Implementation Plan', color: 'text-yellow-500' },
  executing: { icon: Hammer, label: 'Executing in Studio', color: 'text-orange-500' },
  testing: { icon: TestTube, label: 'Running Tests', color: 'text-indigo-500' },
  debugging: { icon: Bug, label: 'Debugging Issues', color: 'text-red-500' },
  verifying: { icon: CheckCircle2, label: 'Verifying Success', color: 'text-green-500' },
  completed: { icon: CheckCircle2, label: 'Completed', color: 'text-green-600' },
  failed: { icon: AlertCircle, label: 'Failed', color: 'text-red-600' }
};

export const AgentExecutionVisualizer: React.FC<Props> = ({ state }) => {
  const stages: AgentStage[] = [
    'understanding',
    'inspecting',
    'analyzing',
    'planning',
    'executing',
    'testing',
    'verifying'
  ];

  const currentIndex = stages.indexOf(state.currentStage);

  return (
    <div className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 rounded-xl p-6 border border-slate-700/50">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
          <Brain className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h3 className="text-white font-semibold">Engineering Agent</h3>
          <p className="text-sm text-slate-400">{state.stageDetails}</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-slate-400">Overall Progress</span>
          <span className="text-white font-medium">{Math.round(state.progress)}%</span>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
            style={{ width: `${state.progress}%` }}
          />
        </div>
      </div>

      {/* Stages */}
      <div className="space-y-3">
        {stages.map((stage, index) => {
          const config = stageConfig[stage];
          const Icon = config.icon;
          const isCompleted = state.completedStages.includes(stage);
          const isCurrent = state.currentStage === stage;
          const isPending = index > currentIndex;

          return (
            <div
              key={stage}
              className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                isCurrent ? 'bg-blue-500/10 border border-blue-500/30' :
                isCompleted ? 'bg-green-500/5' :
                'opacity-50'
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                isCompleted ? 'bg-green-500/20' :
                isCurrent ? 'bg-blue-500/20 animate-pulse' :
                'bg-slate-700/50'
              }`}>
                <Icon className={`w-4 h-4 ${
                  isCompleted ? 'text-green-400' :
                  isCurrent ? config.color :
                  'text-slate-600'
                }`} />
              </div>

              <div className="flex-1">
                <p className={`text-sm font-medium ${
                  isCompleted ? 'text-green-400' :
                  isCurrent ? 'text-white' :
                  'text-slate-500'
                }`}>
                  {config.label}
                </p>
              </div>

              {isCompleted && (
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              )}
              {isCurrent && (
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Errors */}
      {state.errors.length > 0 && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-sm font-medium text-red-400 mb-2">Issues Detected:</p>
          <ul className="space-y-1">
            {state.errors.map((error, i) => (
              <li key={i} className="text-sm text-red-300/80 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

/**
 * Hook to track agent execution state from execution events
 */
export function useAgentExecutionState(executionId: string): AgentExecutionState {
  const [state, setState] = React.useState<AgentExecutionState>({
    currentStage: 'understanding',
    progress: 0,
    stageDetails: 'Initializing...',
    completedStages: [],
    errors: []
  });

  React.useEffect(() => {
    // Listen to execution events
    const handleEvent = (event: any) => {
      const stageMap: Record<string, AgentStage> = {
        'Reasoning': 'understanding',
        'Inspection': 'inspecting',
        'Analysis': 'analyzing',
        'Planning': 'planning',
        'Execution': 'executing',
        'Create': 'executing',
        'Edit': 'executing',
        'Testing': 'testing',
        'Debugging': 'debugging',
        'Verification': 'verifying'
      };

      const stage = stageMap[event.type] || state.currentStage;

      setState(prev => {
        const newCompleted = [...prev.completedStages];
        if (event.status === 'completed' && !newCompleted.includes(stage)) {
          newCompleted.push(stage);
        }

        const stages: AgentStage[] = ['understanding', 'inspecting', 'analyzing', 'planning', 'executing', 'testing', 'verifying'];
        const progress = (newCompleted.length / stages.length) * 100;

        return {
          currentStage: event.status === 'failed' ? 'failed' : event.status === 'completed' ? 'completed' : stage,
          progress,
          stageDetails: event.message,
          completedStages: newCompleted,
          errors: event.type === 'Error' ? [...prev.errors, event.message] : prev.errors
        };
      });
    };

    // Subscribe to events (implementation depends on your event system)
    // executionEventBus.on(`event:${executionId}`, handleEvent);

    return () => {
      // executionEventBus.off(`event:${executionId}`, handleEvent);
    };
  }, [executionId]);

  return state;
}
