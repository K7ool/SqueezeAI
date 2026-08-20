import React, { useState, useEffect, useRef } from 'react';
import { 
  Folder, FileCode, Plus, Trash2, Download, HardDrive, 
  Upload, Check, Save, Sparkles, RefreshCw, Layers, 
  FileText, ExternalLink, Code2, Search, Edit3, Eye, 
  FileJson, Copy, CheckCircle2, AlertCircle, ChevronDown, Wrench
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
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorTextareaRef = useRef<HTMLTextAreaElement>(null);

  const activeFile = project.files.find(f => f.id === activeFileId) || project.files[0];

  // Track if current editor content has unsaved modifications
  const isDirty = activeFile ? currentCode !== activeFile.code : false;

  useEffect(() => {
    if (selectedFileId) {
      setActiveFileId(selectedFileId);
    }
  }, [selectedFileId]);

  useEffect(() => {
    if (activeFile) {
      setCurrentCode(activeFile.code);
      setLastSavedTime(null);
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

  // Open native directory with showDirectoryPicker
  const handleOpenFolderNative = async () => {
    try {
      const result = await openProjectDirectoryNative();
      if (result.success && result.project) {
        onUpdateProject(result.project);
        setActiveFileId(result.project.files[0]?.id || '');
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
        setActiveFileId(loaded.files[0]?.id || '');
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

      // Persist to disk using File System Access API
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
        
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastSavedTime(timeStr);

        if (result.method === 'native-folder') {
          onShowToast(`💾 Saved "${updatedFile.name}" directly to local project folder!`);
        } else if (result.method === 'native-file') {
          onShowToast(`💾 Persisted "${updatedFile.name}" to disk handle!`);
        } else if (result.method === 'native-picker') {
          onShowToast(`💾 Saved "${result.filename}" to local disk file!`);
        } else {
          onShowToast(`📥 Downloaded "${result.filename}" to disk!`);
        }
      } else if (result.error && !result.error.includes('cancelled')) {
        onShowToast(`Save warning: ${result.error}`);
      }
    } catch (err: any) {
      console.error('Save to disk error:', err);
      onShowToast(`Could not save file: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Auto-format Luau code with strict typing
   */
  const handleFormatCode = () => {
    if (!currentCode) return;
    const formatted = formatAndSanitizeLuau(currentCode);
    setCurrentCode(formatted);
    onShowToast('✨ Formatted Luau code with strict typing!');
  };

  /**
   * Reload current file from disk if local handle exists
   */
  const handleReloadFromDisk = async () => {
    if (!activeFile) return;
    setIsReloading(true);
    try {
      const result = await reloadFileFromDisk(activeFile);
      if (result.success && result.code !== undefined) {
        setCurrentCode(result.code);
        const updatedFile = { ...activeFile, code: result.code, lastModified: Date.now() };
        const updatedFiles = project.files.map(f => f.id === activeFile.id ? updatedFile : f);
        const updatedProject = { ...project, files: updatedFiles };
        onUpdateProject(updatedProject);
        saveProjectToLocalStorage(updatedProject);
        onShowToast(`🔄 Reloaded "${activeFile.name}" from local disk!`);
      } else {
        onShowToast(result.error || 'No direct disk handle attached to this file.');
      }
    } catch (err: any) {
      onShowToast(`Reload failed: ${err.message}`);
    } finally {
      setIsReloading(false);
    }
  };

  /**
   * Save all files to disk in bulk
   */
  const handleSaveAllToDisk = async () => {
    setIsSavingAll(true);
    try {
      const res = await saveAllProjectFilesToDisk(project);
      if (res.savedCount > 0) {
        onShowToast(`💾 Saved all ${res.savedCount} files to disk successfully!`);
      } else {
        onShowToast('Mounted folder or disk picker needed to save all files.');
      }
    } catch (err: any) {
      onShowToast(`Save all failed: ${err.message}`);
    } finally {
      setIsSavingAll(false);
    }
  };

  const handleCreateNewFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;

    let ext = '.server.luau';
    let defaultPath = 'src/server/';
    let target = 'ServerScriptService';

    if (newFileType === 'LocalScript') {
      ext = '.client.luau';
      defaultPath = 'src/client/';
      target = 'StarterPlayer.StarterPlayerScripts';
    } else if (newFileType === 'ModuleScript') {
      ext = '.luau';
      defaultPath = 'src/shared/';
      target = 'ReplicatedStorage.Common';
    }

    const cleanBaseName = newFileName.trim().replace(/\.[^/.]+$/, "");
    const finalFileName = `${cleanBaseName}${ext}`;
    const finalPath = `${defaultPath}${finalFileName}`;

    const starterCode = `-- ${newFileType} : ${finalFileName}\n--!strict\nlocal Players = game:GetService("Players")\n\nprint("⚡ [${cleanBaseName}] Initialized.")\n`;

    const newFile: ProjectFile = {
      id: `file-usr-${Date.now()}`,
      name: finalFileName,
      path: finalPath,
      code: starterCode,
      scriptType: newFileType,
      targetInstance: target,
      lastModified: Date.now(),
      tags: ['UserCreated']
    };

    if (project.dirHandle) {
      await saveFileToDiskHandle(newFile, starterCode, project.dirHandle);
    }

    const updatedFiles = [...project.files, newFile];
    const updatedProject = {
      ...project,
      files: updatedFiles,
      activeFileId: newFile.id,
      updatedAt: Date.now()
    };

    onUpdateProject(updatedProject);
    saveProjectToLocalStorage(updatedProject);
    setActiveFileId(newFile.id);
    setIsAddingFile(false);
    setNewFileName('');
    onShowToast(`Created file "${finalFileName}" in project.`);
  };

  const handleDeleteFile = (fileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (project.files.length <= 1) {
      onShowToast('Cannot delete the last file in the project.');
      return;
    }
    const updatedFiles = project.files.filter(f => f.id !== fileId);
    const updatedProject = {
      ...project,
      files: updatedFiles,
      activeFileId: updatedFiles[0]?.id || '',
      updatedAt: Date.now()
    };
    onUpdateProject(updatedProject);
    saveProjectToLocalStorage(updatedProject);
    setActiveFileId(updatedFiles[0]?.id || '');
    onShowToast('File deleted from workspace.');
  };

  const handleCopyCode = () => {
    const textToCopy = isEditingCode ? currentCode : activeFile?.code || '';
    navigator.clipboard.writeText(textToCopy);
    setCopiedCode(true);
    onShowToast('📋 Copied script to clipboard!');
    setTimeout(() => setCopiedCode(false), 2000);
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
      <div className="p-3 sm:p-3.5 border-b border-white/10 bg-[#161B22] flex flex-wrap items-center justify-between gap-3">
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
              {project.files.length} Luau files &middot; File System Access API Sync
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Mount Folder Button */}
          <button
            onClick={handleOpenFolderNative}
            className="px-3 py-1.5 rounded-lg bg-[#FFC93C] text-[#0B120D] text-xs font-mono font-bold flex items-center gap-1.5 hover:bg-[#ffe082] transition-all cursor-pointer shadow-sm active:scale-95"
            title="Mount real project folder directly from your local computer via File System Access API"
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Open Folder</span>
          </button>

          {/* Save All to Disk Button */}
          {project.isNativeDirectoryMounted && (
            <button
              onClick={handleSaveAllToDisk}
              disabled={isSavingAll}
              className="px-3 py-1.5 rounded-lg bg-[#A8E6B0]/20 text-[#A8E6B0] hover:bg-[#A8E6B0]/30 text-xs font-mono font-bold flex items-center gap-1.5 border border-[#A8E6B0]/30 transition-all cursor-pointer disabled:opacity-50"
              title="Persist all project scripts back to local disk folder"
            >
              <Save className={`w-3.5 h-3.5 ${isSavingAll ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isSavingAll ? 'Saving All…' : 'Save All to Disk'}</span>
            </button>
          )}

          {/* Export ZIP */}
          <button
            onClick={() => exportProjectToZip(project)}
            className="px-3 py-1.5 rounded-lg bg-white/10 text-[#FFFDF6] hover:bg-white/20 text-xs font-mono font-bold flex items-center gap-1.5 border border-white/15 transition-all cursor-pointer"
            title="Download full project as ZIP"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">ZIP</span>
          </button>
        </div>
      </div>

      {/* Main Grid: File Tree + Code Editor */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-[270px_1fr] overflow-hidden min-h-[480px]">
        
        {/* Left Column: File Explorer Tree */}
        <div className="bg-[#161B22]/50 border-r border-white/10 flex flex-col overflow-hidden">
          
          {/* Search & Filter Bar */}
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
                title="Create new Luau script"
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
                placeholder="e.g. AdminCommands"
                autoFocus
                className="bg-[#0D1117] border border-white/20 rounded p-1.5 text-xs text-[#FFFDF6] focus:outline-none focus:border-[#FFC93C]"
              />
              <div className="flex gap-1">
                {(['Server Script', 'LocalScript', 'ModuleScript'] as const).map(st => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setNewFileType(st)}
                    className={`flex-1 text-[10px] py-1 rounded font-mono transition-all cursor-pointer ${
                      newFileType === st 
                        ? 'bg-[#FFC93C] text-[#0B120D] font-bold' 
                        : 'bg-white/10 text-white/70 hover:bg-white/20'
                    }`}
                  >
                    {st === 'Server Script' ? 'Server' : st === 'LocalScript' ? 'Client' : 'Module'}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5 justify-end mt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingFile(false)}
                  className="px-2 py-1 text-xs text-white/50 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-[#FFC93C] text-[#0B120D] rounded text-xs font-bold font-mono cursor-pointer hover:bg-[#ffe082]"
                >
                  Create
                </button>
              </div>
            </form>
          )}

          {/* File Items List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredFiles.map(file => {
              const isActive = file.id === activeFileId;
              const fileIsDirty = isActive && isDirty;

              return (
                <div
                  key={file.id}
                  onClick={() => {
                    setActiveFileId(file.id);
                  }}
                  className={`group flex items-center justify-between p-2 rounded-lg text-xs font-mono transition-all cursor-pointer select-none ${
                    isActive
                      ? 'bg-white/15 text-[#FFC93C] font-bold border border-white/15 shadow-sm'
                      : 'text-[#FFFDF6]/80 hover:bg-white/5 hover:text-[#FFFDF6]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileCode className={`w-3.5 h-3.5 shrink-0 ${
                      file.scriptType === 'LocalScript' 
                        ? 'text-[#7EE787]' 
                        : file.scriptType === 'ModuleScript' 
                        ? 'text-[#D2A8FF]' 
                        : 'text-[#79C0FF]'
                    }`} />
                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate block font-semibold">{file.name}</span>
                        {fileIsDirty && (
                          <span className="w-2 h-2 rounded-full bg-[#FFC93C] shrink-0 animate-pulse" title="Unsaved changes in editor" />
                        )}
                      </div>
                      <span className="text-[10px] text-white/40 block truncate">{file.path}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {file.fileHandle && (
                      <span title="Direct disk handle active" className="text-[10px] text-[#A8E6B0] opacity-80 group-hover:opacity-100">
                        💾
                      </span>
                    )}
                    <button
                      onClick={(e) => handleDeleteFile(file.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-[#FF7B72] transition-opacity cursor-pointer rounded"
                      title="Delete File"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Code Editor & Save to Disk Toolbar */}
        <div className="flex flex-col bg-[#0D1117] overflow-hidden">
          
          {activeFile ? (
            <div className="flex flex-col h-full">
              
              {/* File Header Bar & Save To Disk Action Controls */}
              <div className="px-3.5 sm:px-4 py-2.5 bg-[#161B22]/90 border-b border-white/10 flex flex-wrap items-center justify-between gap-2.5">
                
                {/* File Title & Path Indicator */}
                <div className="flex items-center gap-2 min-w-0">
                  <FileCode className={`w-4 h-4 shrink-0 ${
                    activeFile.scriptType === 'LocalScript' ? 'text-[#7EE787]' : activeFile.scriptType === 'ModuleScript' ? 'text-[#D2A8FF]' : 'text-[#79C0FF]'
                  }`} />
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs sm:text-sm font-bold text-[#FFFDF6] truncate">{activeFile.name}</span>
                      {isDirty ? (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#FFC93C]/20 text-[#FFC93C] border border-[#FFC93C]/30 font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#FFC93C]" />
                          Unsaved
                        </span>
                      ) : lastSavedTime ? (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#A8E6B0]/15 text-[#A8E6B0] border border-[#A8E6B0]/30 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Saved {lastSavedTime}
                        </span>
                      ) : null}
                    </div>
                    <span className="text-[10px] font-mono text-white/50 truncate">
                      {activeFile.path} &bull; <span className="text-[#FFC93C]/90">{activeFile.targetInstance}</span>
                    </span>
                  </div>
                </div>

                {/* Primary Actions: Save to Disk + Edit + Format */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  
                  {/* Mode Toggle: Edit vs Syntax View */}
                  <button
                    onClick={() => setIsEditingCode(!isEditingCode)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      isEditingCode 
                        ? 'bg-white/20 text-[#FFFDF6] border border-white/20' 
                        : 'bg-white/10 hover:bg-white/15 text-[#FFFDF6] border border-white/10'
                    }`}
                    title={isEditingCode ? 'Switch to syntax highlighted view' : 'Switch to interactive in-place text editor'}
                  >
                    {isEditingCode ? <Eye className="w-3.5 h-3.5 text-[#79C0FF]" /> : <Edit3 className="w-3.5 h-3.5 text-[#FFC93C]" />}
                    <span>{isEditingCode ? 'Preview' : 'Edit Script'}</span>
                  </button>

                  {/* Format Luau Code */}
                  {isEditingCode && (
                    <button
                      onClick={handleFormatCode}
                      className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/90 text-xs font-mono font-bold flex items-center gap-1 transition-all cursor-pointer border border-white/10"
                      title="Format Luau code with strict types and clean layout"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#FFC93C]" />
                      <span className="hidden lg:inline">Format</span>
                    </button>
                  )}

                  {/* Reload from Disk (if handle exists) */}
                  {activeFile.fileHandle && (
                    <button
                      onClick={handleReloadFromDisk}
                      disabled={isReloading}
                      className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/90 text-xs font-mono font-bold flex items-center gap-1 transition-all cursor-pointer border border-white/10 disabled:opacity-50"
                      title="Sync and reload latest changes from local file on disk"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-[#79C0FF] ${isReloading ? 'animate-spin' : ''}`} />
                      <span className="hidden lg:inline">Sync Disk</span>
                    </button>
                  )}

                  {/* Copy Code Button */}
                  <button
                    onClick={handleCopyCode}
                    className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/90 text-xs font-mono font-bold flex items-center gap-1 transition-all cursor-pointer border border-white/10"
                    title="Copy code to clipboard"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-[#A8E6B0]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{copiedCode ? 'Copied' : 'Copy'}</span>
                  </button>

                  {/* ⭐ PRIMARY 'SAVE TO DISK' BUTTON */}
                  <button
                    onClick={() => handleSaveToDisk(false)}
                    disabled={isSaving}
                    className="px-3.5 py-1.5 rounded-lg bg-[#A8E6B0] hover:bg-[#8ee09a] text-[#0B120D] text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95 disabled:opacity-50"
                    title="Persist edited file directly to disk using File System Access API (Ctrl+S / Cmd+S)"
                  >
                    <HardDrive className={`w-3.5 h-3.5 ${isSaving ? 'animate-bounce' : ''}`} />
                    <span>{isSaving ? 'Saving to Disk…' : 'Save to Disk'}</span>
                  </button>

                  {/* Secondary 'Save As...' file picker */}
                  <button
                    onClick={() => handleSaveToDisk(true)}
                    disabled={isSaving}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[#FFFDF6] text-xs font-mono font-bold transition-all cursor-pointer border border-white/15"
                    title="Save As to a specific local file via File System Access Picker"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* In-Place Text Editor or Luau Code Viewer */}
              <div className="flex-1 overflow-hidden p-3 sm:p-4 flex flex-col">
                {isEditingCode ? (
                  <div className="flex-1 relative flex flex-col bg-[#090D11] rounded-xl border border-white/15 overflow-hidden shadow-inner focus-within:border-[#FFC93C]">
                    
                    {/* Editor Status Bar */}
                    <div className="px-3 py-1.5 bg-[#161B22]/70 border-b border-white/10 flex items-center justify-between text-[11px] font-mono text-white/60 select-none">
                      <div className="flex items-center gap-3">
                        <span>Line: {lineCount}</span>
                        <span>Size: {(byteSize / 1024).toFixed(1)} KB</span>
                        <span className="text-[#A8E6B0] font-semibold">Strict Luau</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-white/40 hidden sm:inline">Press <kbd className="px-1 py-0.5 bg-white/10 rounded text-[10px] text-white/80">Ctrl+S</kbd> to save to disk</span>
                        {isDirty && (
                          <span className="text-[#FFC93C] font-bold">● Unsaved edits</span>
                        )}
                      </div>
                    </div>

                    {/* Textarea Code Editor */}
                    <textarea
                      ref={editorTextareaRef}
                      value={currentCode}
                      onChange={(e) => setCurrentCode(e.target.value)}
                      placeholder="-- Enter Luau code here..."
                      className="w-full flex-1 bg-transparent p-4 font-mono text-xs sm:text-[13px] text-[#E6EDF3] leading-relaxed focus:outline-none resize-none select-text custom-scrollbar font-normal"
                      spellCheck={false}
                      autoCapitalize="off"
                      autoComplete="off"
                      autoCorrect="off"
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

              {/* Bottom Quick Help Tip Bar */}
              <div className="px-4 py-2 bg-[#161B22]/60 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-white/50">
                <div className="flex items-center gap-2 truncate">
                  <span className="text-[#FFC93C]">⚡ Tip:</span>
                  <span className="truncate">Editing saves directly to your local Roblox project via File System Access API without re-downloading.</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-[10px] text-white/70">Ctrl+S</kbd>
                  <span className="hidden sm:inline">Save</span>
                </div>
              </div>

            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-white/40 text-xs font-mono p-8 text-center gap-3">
              <Folder className="w-8 h-8 text-white/20" />
              <p>Select a script from the explorer or click "Open Folder" to mount your local project directory.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
