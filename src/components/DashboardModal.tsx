import React from 'react';
import { User, UserQuota, GeneratedScript } from '../types';
import { RobloxProject } from '../types/project';
import { AppShell } from './AppShell';

interface DashboardModalProps {
  isOpen: boolean;
  user: User | null;
  quota: UserQuota | null;
  project: RobloxProject;
  onClose: () => void;
  onUpdateProject: (updated: RobloxProject) => void;
  onSelectScript: (script: GeneratedScript) => void;
  onUpgradePlan: (planId: 'free' | 'pro' | 'studio') => void;
  onOpenStudioGuide: () => void;
  onShowToast: (msg: string) => void;
  initialTab?: 'overview' | 'chat' | 'ideas' | 'files' | 'generator' | 'history' | 'billing' | 'apikeys';
}

export const DashboardModal: React.FC<DashboardModalProps> = ({
  isOpen,
  user,
  quota,
  project,
  onClose,
  onUpdateProject,
  onSelectScript,
  onUpgradePlan,
  onOpenStudioGuide,
  onShowToast,
  initialTab = 'overview',
}) => {
  // Map legacy dashboard tabs to new AppShell workspaces & subtabs
  let workspace: 'ai' | 'development' | 'roblox' | 'history' | 'project' = 'project';
  let subTab = 'overview';

  if (initialTab === 'overview') {
    workspace = 'project';
    subTab = 'overview';
  } else if (initialTab === 'chat') {
    workspace = 'ai';
    subTab = 'chat';
  } else if (initialTab === 'ideas') {
    workspace = 'ai';
    subTab = 'intelligence';
  } else if (initialTab === 'files') {
    workspace = 'development';
    subTab = 'files';
  } else if (initialTab === 'generator') {
    workspace = 'development';
    subTab = 'generator';
  } else if (initialTab === 'apikeys') {
    workspace = 'roblox';
    subTab = 'plugin';
  } else if (initialTab === 'history') {
    workspace = 'history';
    subTab = 'scripts';
  } else if (initialTab === 'billing') {
    workspace = 'history';
    subTab = 'billing';
  }

  return (
    <AppShell
      isOpen={isOpen}
      user={user}
      quota={quota}
      project={project}
      onClose={onClose}
      onUpdateProject={onUpdateProject}
      onSelectScript={onSelectScript}
      onUpgradePlan={onUpgradePlan}
      onOpenStudioGuide={onOpenStudioGuide}
      onShowToast={onShowToast}
      initialWorkspace={workspace}
      initialTab={subTab}
    />
  );
};
