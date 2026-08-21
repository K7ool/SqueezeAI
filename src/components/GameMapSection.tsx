import React from 'react';
import { InteractiveGameMap } from './InteractiveGameMap';
import { RobloxProject } from '../types/project';

interface GameMapSectionProps {
  project?: RobloxProject;
  onUpdateProject?: (updated: RobloxProject) => void;
  onShowToast?: (msg: string) => void;
  onOpenCodeInEditor?: (fileId: string) => void;
  onSendPromptToAgent?: (prompt: string) => void;
}

export const GameMapSection: React.FC<GameMapSectionProps> = ({
  project,
  onUpdateProject,
  onShowToast,
  onOpenCodeInEditor,
  onSendPromptToAgent,
}) => {
  const dummyProject: RobloxProject = project || {
    id: 'proj-default',
    name: 'Roblox Studio Game',
    description: 'Roblox Studio Luau project workspace',
    version: '1.0.0',
    files: [],
    activeFileId: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  return (
    <div className="w-full h-full min-h-[550px] rounded-xl overflow-hidden border border-gray-800">
      <InteractiveGameMap
        project={dummyProject}
        onUpdateProject={onUpdateProject || (() => {})}
        onShowToast={onShowToast || (() => {})}
        onOpenCodeInEditor={onOpenCodeInEditor || (() => {})}
        onSendPromptToAgent={onSendPromptToAgent || (() => {})}
      />
    </div>
  );
};
