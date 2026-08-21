import React, { useState, useEffect, useRef } from 'react';
import { 
  Folder, FileCode, Plus, Trash2, Download, HardDrive, 
  Upload, Check, Save, Sparkles, RefreshCw, Layers, 
  FileText, ExternalLink, Code2, Search, Edit3, Eye, 
  FileJson, Copy, CheckCircle2, AlertCircle, ChevronDown, Wrench,
  X, Cpu, Zap, ArrowRight, MessageSquare
} from 'lucide-react';
import { RobloxProject, ProjectFile } from '../types/project';
import { LuauCodeViewer } from './LuauCodeViewer';
import { 
  openProjectDirectoryNative, 
  parseUploadedFolderList, 
  saveFileToDiskHandle, 
  saveAllProjectFilesToDisk,
  reloadFileFromDisk,
  exportProjectToZip, 
  saveProjectToLocalStorage 
} from '../utils/projectDisk';
import { formatAndSanitizeLuau } from '../utils/luauFormatter';
import { safeFetchJson } from '../utils/api';
import { syncFileToStudio } from '../utils/syncClient';

interface ProjectFolderInspectorProps {
  project: RobloxProject;
  onUpdateProject: (updated: RobloxProject) => void;
  onShowToast: (msg: string) => void;
  selectedFileId?: string;
}

export const ProjectFolderInspector: React.FC<ProjectFolderInspectorProps> = ({
  project,
  onUpdateProject,
  onShowToast,
  selectedFileId,
}) => {
  const [activeFileId, setActiveFileId] = useState<string>(
    selectedFileId || project.activeFileId || project.files[0]?.id || ''
  );
  
  // Tab Support state: array of open file IDs in the center editor
  const [openTabIds, setOpenTabIds] = useState<string[]>(() => {
    const initialId = selectedFileId || project.activeFileId || project.files[0]?.id || '';
    return initialId ? [initialId] : project.files.slice(0, 3).map(f => f.id);
  });

  const [isEditingCode, setIsEditingCode] = useState(false);
  const [currentCode, setCurrentCode] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [isAddingFile, setIsAddingFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileType, setNewFileType] = useState<'Server Script' | 'LocalScript' | 'ModuleScript'>('Server Script');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Right Inspector AI Action state
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiActionMessage, setAiActionMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorTextareaRef = useRef<HTMLTextAreaElement>(null);

  const token = localStorage.getItem('squeeze_token') || '';
  const activeFile = project.files.find(f => f.id === activeFileId) || project.files[0];

  // Track if current editor content has unsaved modifications
  const isDirty = activeFile ? currentCode !== activeFile.code : false;

  useEffect(() => {
    if (selectedFileId) {
      setActiveFileId(selectedFileId);
      if (!openTabIds.includes(selectedFileId)) {
        setOpenTabIds(prev => [...prev, selectedFileId]);
      }
    }
  }, [selectedFileId]);

  useEffect(() => {
    if (activeFile) {
      setCurrentCode(activeFile.code);
      setLastSavedTime(null);
      setAiActionMessage(null);
    }
  }, [activeFileId, project.files]);

  // Global & Textarea Ctrl+S / Cmd+S shortcut handler for direct Save to Disk
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveToDisk(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFile, currentCode, project]);

  // Open file and ensure it is in open tabs
  const handleSelectFile = (fileId: string) => {
    setActiveFileId(fileId);
    if (!openTabIds.includes(fileId)) {
      setOpenTabIds(prev => [...prev, fileId]);
    }
  };

  const handleCloseTab = (e: React.MouseEvent, fileId: string) => {
    e.stopPropagation();
    const newTabs = openTabIds.filter(id => id !== fileId);
    setOpenTabIds(newTabs);
    if (activeFileId === fileId && newTabs.length > 0) {
      setActiveFileId(newTabs[newTabs.length - 1]);
    }
  };

  // Open native directory with showDirectoryPicker
  const handleOpenFolderNative = async () => {
    try {
      const result = await openProjectDirectoryNative();
      if (result.success && result.project) {
        onUpdateProject(result.project);
        const firstId = result.project.files[0]?.id || '';
        setActiveFileId(firstId);
        setOpenTabIds([firstId]);
        onShowToast(`📁 Mounted folder "${result.project.name}" (${result.project.files.length} Luau files) to Local Disk!`);
      } else if (result.error && !result.error.includes('cancelled')) {
        fileInputRef.current?.click();
      }
    } catch (err: any) {
      fileInputRef.current?.click();
    }
  };

  // Upload folder fallback
  const handleFolderUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      try {
        const loaded = await parseUploadedFolderList(e.target.files);
        onUpdateProject(loaded);
        const firstId = loaded.files[0]?.id || '';
        setActiveFileId(firstId);
        setOpenTabIds([firstId]);
        onShowToast(`📁 Loaded ${loaded.files.length} files from folder "${loaded.name}"`);
      } catch (err) {
        onShowToast('Failed to parse uploaded folder.');
      }
    }
  };

  /**
   * Save edited Luau file directly to disk using File System Access API
   */
  const handleSaveToDisk = async (forcePicker = false) => {
    if (!activeFile) return;
    setIsSaving(true);

    try {
      const cleanCode = formatAndSanitizeLuau(currentCode);
      const updatedFile: ProjectFile = {
        ...activeFile,
        code: cleanCode,
        lastModified: Date.now()
      };

      const result = await saveFileToDiskHandle(
        updatedFile, 
        cleanCode, 
        project.dirHandle,
        { forcePicker }
      );

      if (result.success) {
        const updatedFiles = project.files.map(f => f.id === activeFile.id ? updatedFile : f);
        const updatedProject: RobloxProject = {
          ...project,
          files: updatedFiles,
          updatedAt: Date.now()
        };

        onUpdateProject(updatedProject);
        saveProjectToLocalStorage(updatedProject);
        setCurrentCode(cleanCode);
        
        // Auto-sync to Roblox Studio WebSync
        syncFileToStudio(project.id, {
          path: activeFile.path,
          name: activeFile.name,
          source: cleanCode
        }, 'website').catch(err => console.warn('Studio WebSync push error:', err));

        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastSavedTime(timeStr);
        onShowToast(`💾 Successfully saved "${activeFile.name}" to disk!`);
      } else {
        onShowToast(`❌ Save failed: ${result.error}`);
      }
    } catch (err: any) {
      onShowToast(`❌ Save error: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAllToDisk = async () => {
    if (!project.dirHandle) {
      onShowToast('No local directory mounted. Click "Open Folder" first.');
      return;
    }
    setIsSavingAll(true);
    try {
      const result = await saveAllProjectFilesToDisk(project);
      onShowToast(`💾 Successfully saved ${result.savedCount}/${result.total} files to disk!`);
    } catch (err: any) {
      onShowToast(`❌ Save error: ${err.message}`);
    } finally {
      setIsSavingAll(false);
    }
  };

  const handleReloadFromDisk = async () => {
    if (!activeFile || !activeFile.fileHandle) {
      onShowToast('File has no disk handle reference.');
      return;
    }
    setIsReloading(true);
    try {
      const result = await reloadFileFromDisk(activeFile);
      if (result.success && result.code !== undefined) {
        setCurrentCode(result.code);
        onShowToast(`🔄 Reloaded "${activeFile.name}" from disk.`);
      } else {
        onShowToast(`❌ Reload failed: ${result.error || 'Unknown'}`);
      }
    } catch (err) {
      onShowToast('Failed to reload file from disk.');
    } finally {
      setIsReloading(false);
    }
  };

  const handleFormatCode = () => {
    const formatted = formatAndSanitizeLuau(currentCode);
    setCurrentCode(formatted);
    onShowToast('✨ Formatted Luau code cleanly.');
  };

  const handleCreateNewFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;

    let cleanName = newFileName.trim();
    if (!cleanName.endsWith('.luau') && !cleanName.endsWith('.lua')) {
      cleanName += newFileType === 'ModuleScript' ? '.lua' : '.luau';
    }

    const defaultPath = newFileType === 'Server Script' 
      ? `ServerScriptService/${cleanName}`
      : newFileType === 'LocalScript'
      ? `StarterPlayer/StarterPlayerScripts/${cleanName}`
      : `ReplicatedStorage/${cleanName}`;

    const newFile: ProjectFile = {
      id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: cleanName,
      path: defaultPath,
      scriptType: newFileType,
      code: `-- ${cleanName}\n-- Created via Squeeze Studio\n\nlocal ${cleanName.split('.')[0]} = {}\n\nreturn ${cleanName.split('.')[0]}`,
      lastModified: Date.now(),
      targetInstance: newFileType === 'Server Script' ? 'ServerScriptService' : newFileType === 'LocalScript' ? 'StarterPlayerScripts' : 'ReplicatedStorage'
    };

    const updatedFiles = [...project.files, newFile];
    const updatedProject: RobloxProject = {
      ...project,
      files: updatedFiles,
      updatedAt: Date.now()
    };

    onUpdateProject(updatedProject);
    saveProjectToLocalStorage(updatedProject);
    handleSelectFile(newFile.id);
    setIsAddingFile(false);
    setNewFileName('');
    onShowToast(`✓ Created new script "${cleanName}"`);
  };

  const handleDeleteFile = (e: React.MouseEvent, fileId: string) => {
    e.stopPropagation();
    if (project.files.length <= 1) {
      onShowToast('Cannot delete the last remaining file in project.');
      return;
    }

    const updatedFiles = project.files.filter(f => f.id !== fileId);
    const updatedProject: RobloxProject = {
      ...project,
      files: updatedFiles,
      updatedAt: Date.now()
    };

    onUpdateProject(updatedProject);
    saveProjectToLocalStorage(updatedProject);

    if (activeFileId === fileId) {
      const nextId = updatedFiles[0]?.id || '';
      setActiveFileId(nextId);
    }
    setOpenTabIds(prev => prev.filter(id => id !== fileId));
    onShowToast('🗑️ Deleted file from project.');
  };

  const handleCopyCode = () => {
    const textToCopy = currentCode || activeFile?.code || '';
    navigator.clipboard.writeText(textToCopy);
    setCopiedCode(true);
    onShowToast('📋 Copied script to clipboard!');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Quick AI Actions on Active File
  const handleAiAction = async (actionType: 'explain' | 'refactor' | 'comments' | 'optimize') => {
    if (!activeFile) return;
    setIsAiProcessing(true);
    setAiActionMessage(null);

    try {
      const promptMap = {
        explain: `Explain this Luau script clearly with function breakdown and Roblox architecture notes:\n\n${currentCode}`,
        refactor: `Refactor this Luau script to follow strict typing (--!strict), best practices, and clean organization. Return only the refactored code block:\n\n${currentCode}`,
        comments: `Add comprehensive docstrings, type annotations, and clear inline comments to this Luau script. Return only the commented code:\n\n${currentCode}`,
        optimize: `Optimize this Luau script for performance, memory efficiency, and safe connection cleanup. Return only the optimized code:\n\n${currentCode}`
      };

      const res = await safeFetchJson('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ prompt: promptMap[actionType] })
      });

      if (res.ok && res.data) {
        const resultText = res.data.script?.code || res.data.content || '';
        if (actionType === 'explain') {
          setAiActionMessage(resultText);
          onShowToast('💡 AI explanation generated in Inspector panel!');
        } else {
          setCurrentCode(resultText);
          setIsEditingCode(true);
          onShowToast(`✨ AI successfully applied ${actionType} to "${activeFile.name}"!`);
        }
      } else {
        onShowToast('❌ AI action request failed.');
      }
    } catch (err: any) {
      onShowToast(`❌ AI error: ${err.message || 'Failed'}`);
    } finally {
      setIsAiProcessing(false);
    }
  };

  // Filtered files
  const filteredFiles = project.files.filter(f => {
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          f.path.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || f.scriptType === filterType;
    return matchesSearch && matchesType;
  });

  // Calculate lines & size for editor status bar
  const lineCount = (currentCode || '').split('\n').length;
  const byteSize = new Blob([currentCode || '']).size;

  return (
    <div className="flex flex-col h-full bg-[#0D1117] text-[#FFFDF6] overflow-hidden rounded-xl border border-white/10 shadow-2xl">
      
      {/* Hidden File Input for Folder Upload Fallback */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFolderUploadChange}
        // @ts-ignore
        webkitdirectory="true"
        directory="true"
        multiple
        className="hidden"
      />

      {/* Top Project Folder Bar */}
      <div className="p-3 sm:p-3.5 border-b border-white/10 bg-[#161B22] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#FFC93C]/10 border border-[#FFC93C]/30 text-[#FFC93C] shrink-0">
            <Folder className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-sm sm:text-base text-[#FFFDF6] font-display">
                {project.name}
              </h3>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold flex items-center gap-1 ${
                project.isNativeDirectoryMounted 
                  ? 'bg-[#A8E6B0]/15 text-[#A8E6B0] border-[#A8E6B0]/30' 
                  : 'bg-white/10 text-white/70 border-white/20'
              }`}>
                <HardDrive className="w-3 h-3" />
                <span>{project.isNativeDirectoryMounted ? 'Direct Disk Mounted' : 'Workspace Connected'}</span>
              </span>
            </div>
            <p className="text-[11px] text-[#FFFDF6]/60 font-mono">
              {project.files.length} Luau files &middot; 3-Column Project Workspace
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleOpenFolderNative}
            className="px-3 py-1.5 rounded-lg bg-[#FFC93C] text-[#0B120D] text-xs font-mono font-bold flex items-center gap-1.5 hover:bg-[#ffe082] transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Open Folder</span>
          </button>

          {project.isNativeDirectoryMounted && (
            <button
              onClick={handleSaveAllToDisk}
              disabled={isSavingAll}
              className="px-3 py-1.5 rounded-lg bg-[#A8E6B0]/20 text-[#A8E6B0] hover:bg-[#A8E6B0]/30 text-xs font-mono font-bold flex items-center gap-1.5 border border-[#A8E6B0]/30 transition-all cursor-pointer disabled:opacity-50"
            >
              <Save className={`w-3.5 h-3.5 ${isSavingAll ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isSavingAll ? 'Saving All…' : 'Save All to Disk'}</span>
            </button>
          )}

          <button
            onClick={() => exportProjectToZip(project)}
            className="px-3 py-1.5 rounded-lg bg-white/10 text-[#FFFDF6] hover:bg-white/20 text-xs font-mono font-bold flex items-center gap-1.5 border border-white/15 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">ZIP</span>
          </button>
        </div>
      </div>

      {/* Main 3-Column Layout: Left File Tree + Center Editor + Right Inspector */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-[260px_1fr_300px] overflow-hidden min-h-[500px]">
        
        {/* 1. LEFT: File Tree Explorer */}
        <div className="bg-[#161B22]/50 border-r border-white/10 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-white/10 flex flex-col gap-2 bg-[#161B22]/80">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search scripts…"
                className="w-full bg-[#0D1117] border border-white/15 rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#FFFDF6] placeholder:text-white/35 focus:outline-none focus:border-[#FFC93C]"
              />
            </div>

            <div className="flex items-center justify-between gap-1 text-[11px] font-mono">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-[#0D1117] border border-white/15 rounded px-2 py-1 text-xs text-[#FFFDF6]/80 focus:outline-none cursor-pointer"
              >
                <option value="all">All Scripts</option>
                <option value="Server Script">Server</option>
                <option value="LocalScript">Client</option>
                <option value="ModuleScript">Module</option>
              </select>

              <button
                onClick={() => setIsAddingFile(true)}
                className="p-1 px-2.5 rounded bg-white/10 hover:bg-[#FFC93C] hover:text-[#0B120D] text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>New</span>
              </button>
            </div>
          </div>

          {/* New File Modal / Form */}
          {isAddingFile && (
            <form onSubmit={handleCreateNewFile} className="p-3 bg-[#1C2128] border-b border-[#FFC93C]/30 flex flex-col gap-2 animate-fadeIn">
              <span className="text-[10px] font-mono uppercase text-[#FFC93C] font-bold flex items-center gap-1">
                <Code2 className="w-3 h-3" />
                <span>New Luau Script</span>
              </span>
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="e.g. CombatManager"
                className="bg-[#0D1117] border border-white/15 rounded px-2 py-1.5 text-xs text-[#FFFDF6]"
                autoFocus
              />
              <select
                value={newFileType}
                onChange={(e) => setNewFileType(e.target.value as any)}
                className="bg-[#0D1117] border border-white/15 rounded px-2 py-1.5 text-xs text-[#FFFDF6]"
              >
                <option value="Server Script">Server Script (ServerScriptService)</option>
                <option value="LocalScript">LocalScript (StarterPlayerScripts)</option>
                <option value="ModuleScript">ModuleScript (ReplicatedStorage)</option>
              </select>
              <div className="flex items-center justify-end gap-1.5 mt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingFile(false)}
                  className="px-2.5 py-1 rounded bg-white/5 text-white/60 text-xs hover:bg-white/10 cursor-pointer font-mono"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 rounded bg-[#FFC93C] text-[#0B120D] text-xs font-bold font-mono cursor-pointer"
                >
                  Create
                </button>
              </div>
            </form>
          )}

          {/* File Explorer Tree List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-xs">
            {filteredFiles.map(file => {
              const isActive = file.id === activeFileId;
              const isTabOpen = openTabIds.includes(file.id);
              return (
                <div
                  key={file.id}
                  onClick={() => handleSelectFile(file.id)}
                  className={`group px-2.5 py-2 rounded-lg flex items-center justify-between transition-all cursor-pointer ${
                    isActive 
                      ? 'bg-[#FFC93C] text-[#0B120D] font-bold shadow-sm' 
                      : isTabOpen 
                      ? 'bg-white/10 text-[#FFFDF6]' 
                      : 'text-white/80 hover:bg-white/5 hover:text-[#FFFDF6]'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <FileCode className={`w-3.5 h-3.5 shrink-0 ${
                      isActive ? 'text-[#0B120D]' : file.scriptType === 'LocalScript' ? 'text-[#7EE787]' : file.scriptType === 'ModuleScript' ? 'text-[#D2A8FF]' : 'text-[#79C0FF]'
                    }`} />
                    <span className="truncate">{file.name}</span>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleDeleteFile(e, file.id)}
                      className={`p-1 rounded hover:bg-red-500/20 ${isActive ? 'text-[#0B120D]' : 'text-red-400'}`}
                      title="Delete script"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
            {filteredFiles.length === 0 && (
              <div className="text-center py-8 text-white/40 text-xs">
                No scripts found.
              </div>
            )}
          </div>
        </div>

        {/* 2. CENTER: Robust Code Editor with Tab Support */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0D1117] border-r border-white/10">
          
          {/* Tab Bar */}
          {openTabIds.length > 0 ? (
            <div className="flex items-center gap-1 bg-[#161B22] border-b border-white/10 overflow-x-auto px-2 py-1.5 shrink-0">
              {openTabIds.map(tabId => {
                const tabFile = project.files.find(f => f.id === tabId);
                if (!tabFile) return null;
                const isTabActive = tabFile.id === activeFileId;

                return (
                  <div
                    key={tabFile.id}
                    onClick={() => handleSelectFile(tabFile.id)}
                    className={`group px-3 py-1.5 rounded-t-lg flex items-center gap-2 text-xs font-mono cursor-pointer transition-all border-t-2 ${
                      isTabActive
                        ? 'bg-[#0D1117] text-[#FFC93C] border-[#FFC93C] font-bold shadow'
                        : 'bg-[#1C2128]/60 text-white/70 border-transparent hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    <span className="truncate max-w-[140px]">{tabFile.name}</span>
                    <button
                      onClick={(e) => handleCloseTab(e, tabFile.id)}
                      className="p-0.5 rounded-full hover:bg-white/20 text-white/50 hover:text-white"
                      title="Close tab"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-[#161B22] border-b border-white/10 px-4 py-2 text-xs font-mono text-white/50">
              No tabs open. Select a file from the explorer on the left.
            </div>
          )}

          {activeFile ? (
            <div className="flex flex-col h-full overflow-hidden">
              
              {/* Editor Header Bar & Controls */}
              <div className="px-4 py-2 bg-[#161B22]/90 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 text-xs font-mono text-white/70 truncate">
                  <span className="text-[#A8E6B0] font-semibold">{activeFile.path}</span>
                  <span>&bull;</span>
                  <span className="text-[#FFC93C]">{activeFile.targetInstance}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setIsEditingCode(!isEditingCode)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      isEditingCode 
                        ? 'bg-white/20 text-[#FFFDF6] border border-white/20' 
                        : 'bg-white/10 hover:bg-white/15 text-[#FFFDF6] border border-white/10'
                    }`}
                  >
                    {isEditingCode ? <Eye className="w-3.5 h-3.5 text-[#79C0FF]" /> : <Edit3 className="w-3.5 h-3.5 text-[#FFC93C]" />}
                    <span>{isEditingCode ? 'Preview' : 'Edit'}</span>
                  </button>

                  {isEditingCode && (
                    <button
                      onClick={handleFormatCode}
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-mono font-bold flex items-center gap-1 cursor-pointer border border-white/10"
                      title="Format Luau code"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#FFC93C]" />
                      <span className="hidden sm:inline">Format</span>
                    </button>
                  )}

                  <button
                    onClick={handleCopyCode}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-mono font-bold flex items-center gap-1 cursor-pointer border border-white/10"
                    title="Copy code"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-[#A8E6B0]" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={() => handleSaveToDisk(false)}
                    disabled={isSaving}
                    className="px-3 py-1 rounded-lg bg-[#A8E6B0] hover:bg-[#8ee09a] text-[#0B120D] text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
                  >
                    <HardDrive className={`w-3.5 h-3.5 ${isSaving ? 'animate-bounce' : ''}`} />
                    <span>{isSaving ? 'Saving…' : 'Save to Disk'}</span>
                  </button>
                </div>
              </div>

              {/* Editor Code Area */}
              <div className="flex-1 overflow-hidden p-3 flex flex-col">
                {isEditingCode ? (
                  <div className="flex-1 relative flex flex-col bg-[#090D11] rounded-xl border border-white/15 overflow-hidden shadow-inner focus-within:border-[#FFC93C]">
                    <div className="px-3 py-1.5 bg-[#161B22]/70 border-b border-white/10 flex items-center justify-between text-[11px] font-mono text-white/60 select-none">
                      <div className="flex items-center gap-3">
                        <span>Line: {lineCount}</span>
                        <span>Size: {(byteSize / 1024).toFixed(1)} KB</span>
                        {isDirty && <span className="text-[#FFC93C] font-bold">● Unsaved edits</span>}
                      </div>
                      <span>Ctrl+S to save</span>
                    </div>
                    <textarea
                      ref={editorTextareaRef}
                      value={currentCode}
                      onChange={(e) => setCurrentCode(e.target.value)}
                      className="w-full flex-1 bg-transparent p-4 font-mono text-xs sm:text-[13px] text-[#E6EDF3] leading-relaxed focus:outline-none resize-none select-text custom-scrollbar font-normal"
                      spellCheck={false}
                    />
                  </div>
                ) : (
                  <div className="flex-1 overflow-hidden flex flex-col">
                    <LuauCodeViewer
                      code={currentCode}
                      filename={activeFile.name}
                      theme="dark"
                      maxHeight="520px"
                      onSavedToDisk={(fname) => onShowToast(`💾 Saved ${fname} to disk!`)}
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-white/40 text-xs font-mono">
              Select or open a tab to view code.
            </div>
          )}
        </div>

        {/* 3. RIGHT: Inspector Panel for Metadata & Quick AI Actions */}
        <div className="bg-[#11161D] border-l border-white/10 flex flex-col overflow-hidden">
          <div className="p-3.5 bg-[#161B22] border-b border-white/10 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#FFC93C]" />
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#FFC93C]">File Inspector &amp; AI</h4>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5 font-mono text-xs">
            {activeFile ? (
              <>
                {/* File Metadata Section */}
                <div className="space-y-2.5">
                  <span className="text-[10px] uppercase text-white/40 font-bold block">File Metadata</span>
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-white/55">Name:</span>
                      <span className="text-[#FFFDF6] font-bold truncate max-w-[150px]">{activeFile.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/55">Type:</span>
                      <span className="text-[#79C0FF]">{activeFile.scriptType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/55">Instance:</span>
                      <span className="text-[#A8E6B0]">{activeFile.targetInstance}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/55">Lines:</span>
                      <span className="text-[#FFFDF6]">{lineCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/55">Size:</span>
                      <span className="text-[#FFFDF6]">{(byteSize / 1024).toFixed(1)} KB</span>
                    </div>
                  </div>
                </div>

                {/* Quick AI Actions Section */}
                <div className="space-y-2.5">
                  <span className="text-[10px] uppercase text-white/40 font-bold block">Quick AI Actions</span>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={() => handleAiAction('explain')}
                      disabled={isAiProcessing}
                      className="p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-between text-left transition-all cursor-pointer disabled:opacity-50 group"
                    >
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-[#FFC93C]" />
                        <span>Explain Script</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-white/40 group-hover:translate-x-0.5 transition-transform" />
                    </button>

                    <button
                      onClick={() => handleAiAction('refactor')}
                      disabled={isAiProcessing}
                      className="p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-between text-left transition-all cursor-pointer disabled:opacity-50 group"
                    >
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#A8E6B0]" />
                        <span>Refactor &amp; Typecheck</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-white/40 group-hover:translate-x-0.5 transition-transform" />
                    </button>

                    <button
                      onClick={() => handleAiAction('comments')}
                      disabled={isAiProcessing}
                      className="p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-between text-left transition-all cursor-pointer disabled:opacity-50 group"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#79C0FF]" />
                        <span>Add Docstrings</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-white/40 group-hover:translate-x-0.5 transition-transform" />
                    </button>

                    <button
                      onClick={() => handleAiAction('optimize')}
                      disabled={isAiProcessing}
                      className="p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-between text-left transition-all cursor-pointer disabled:opacity-50 group"
                    >
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-[#FF7B72]" />
                        <span>Optimize Performance</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-white/40 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>

                {/* AI Explanation / Result Output */}
                {aiActionMessage && (
                  <div className="space-y-2 animate-fadeIn">
                    <span className="text-[10px] uppercase text-[#FFC93C] font-bold block">AI Explanation</span>
                    <div className="p-3 rounded-lg bg-black/40 border border-[#FFC93C]/30 text-white/90 text-xs font-body leading-relaxed max-h-48 overflow-y-auto">
                      {aiActionMessage}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-white/40">
                Select a file to inspect metadata and run AI actions.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
