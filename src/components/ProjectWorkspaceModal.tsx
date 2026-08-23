import React, { useState, useEffect } from 'react';
import { RobloxProject, ProjectFile } from '../types/project';
import { 
  Folder, FileCode, Plus, Trash2, Download, HardDrive, 
  Upload, X, Check, Save, Sparkles, RefreshCw, Layers, 
  FileText, ExternalLink, Code2, ChevronRight, FileJson
} from 'lucide-react';
import { LuauCodeViewer } from './LuauCodeViewer';
import { 
  saveSingleScriptToDisk, 
  exportProjectToZip, 
  exportProjectJsonToDisk, 
  loadProjectFromJsonFile, 
  saveProjectToLocalStorage 
} from '../utils/projectDisk';
import { sound } from '../utils/audio';

interface ProjectWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: RobloxProject;
  onUpdateProject: (updated: RobloxProject) => void;
  onShowToast: (msg: string) => void;
}

export const ProjectWorkspaceModal: React.FC<ProjectWorkspaceModalProps> = ({
  isOpen,
  onClose,
  project,
  onUpdateProject,
  onShowToast,
}) => {
  const [activeFileId, setActiveFileId] = useState<string>(project.activeFileId || project.files[0]?.id || '');
  const [isEditingCode, setIsEditingCode] = useState(false);
  const [currentCode, setCurrentCode] = useState('');
  const [isAddingFile, setIsAddingFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileType, setNewFileType] = useState<'Server Script' | 'LocalScript' | 'ModuleScript'>('Server Script');
  const [isExporting, setIsExporting] = useState(false);

  const activeFile = project.files.find(f => f.id === activeFileId) || project.files[0];

  useEffect(() => {
    if (activeFile) {
      setCurrentCode(activeFile.code);
    }
  }, [activeFileId, project]);

  if (!isOpen) return null;

  const handleSelectFile = (fileId: string) => {
    sound.pop();
    // Save current active file changes if edited
    if (activeFile && isEditingCode) {
      saveCurrentFileCode();
    }
    setActiveFileId(fileId);
    setIsEditingCode(false);
  };

  const saveCurrentFileCode = () => {
    if (!activeFile) return;
    sound.success();
    const updatedFiles = project.files.map(f => {
      if (f.id === activeFile.id) {
        return {
          ...f,
          code: currentCode,
          lastModified: Date.now()
        };
      }
      return f;
    });

    const updatedProject = {
      ...project,
      files: updatedFiles,
      updatedAt: Date.now()
    };

    onUpdateProject(updatedProject);
    saveProjectToLocalStorage(updatedProject);
    onShowToast(`Saved "${activeFile.name}" to local workspace.`);
  };

  const handleCreateFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;

    sound.success();
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

    const cleanBase = newFileName.trim().replace(/\.(luau|lua)$/i, '');
    const finalName = cleanBase.includes('.') ? cleanBase : `${cleanBase}${ext}`;
    const newId = `file-${Date.now()}`;

    const newFile: ProjectFile = {
      id: newId,
      name: finalName,
      path: `${defaultPath}${finalName}`,
      code: `--!strict\n-- ${finalName}\nlocal Players = game:GetService("Players")\n\nprint("${finalName} initialized")`,
      scriptType: newFileType,
      targetInstance: target,
      lastModified: Date.now(),
      tags: [newFileType.replace(' Script', '')]
    };

    const updated = {
      ...project,
      files: [...project.files, newFile],
      activeFileId: newId,
      updatedAt: Date.now()
    };

    onUpdateProject(updated);
    saveProjectToLocalStorage(updated);
    setActiveFileId(newId);
    setIsAddingFile(false);
    setNewFileName('');
    onShowToast(`Created new file "${finalName}"`);
  };

  const handleDeleteFile = (fileId: string) => {
    if (project.files.length <= 1) {
      sound.error();
      onShowToast('Cannot delete the only remaining file in project.');
      return;
    }
    sound.click();
    const updatedFiles = project.files.filter(f => f.id !== fileId);
    const nextActive = updatedFiles[0]?.id || '';
    const updated = {
      ...project,
      files: updatedFiles,
      activeFileId: nextActive,
      updatedAt: Date.now()
    };
    onUpdateProject(updated);
    saveProjectToLocalStorage(updated);
    setActiveFileId(nextActive);
    onShowToast('File removed from project.');
  };

  const handleExportZip = async () => {
    sound.zap();
    setIsExporting(true);
    try {
      if (isEditingCode) {
        saveCurrentFileCode();
      }
      await exportProjectToZip(project);
      sound.success();
      onShowToast(`Exported "${project.name}" Studio ZIP to local disk! 📦`);
    } catch (err) {
      console.error('Export error:', err);
      sound.error();
      onShowToast('Failed to export ZIP.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveActiveToDisk = async () => {
    if (!activeFile) return;
    try {
      sound.click();
      const res = await saveSingleScriptToDisk(activeFile.name, currentCode);
      if (res.success) {
        sound.success();
        onShowToast(`Saved "${res.filename}" to local disk.`);
      }
    } catch (err) {
      console.error('Save to disk error:', err);
      sound.error();
    }
  };

  const handleImportProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    sound.whoosh();
    loadProjectFromJsonFile(file)
      .then(loaded => {
        onUpdateProject(loaded);
        saveProjectToLocalStorage(loaded);
        if (loaded.files[0]) {
          setActiveFileId(loaded.files[0].id);
        }
        sound.success();
        onShowToast(`Imported project "${loaded.name}" from disk! 📂`);
      })
      .catch(err => {
        sound.error();
        onShowToast(`Failed to load project: ${err.message}`);
      });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#0B120D]/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#142019] text-[#FFFDF6] border border-white/15 rounded-3xl w-full max-w-6xl h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Top Bar */}
        <div className="px-6 py-4 bg-[#1D2E24] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FFC93C] flex items-center justify-center text-[#0B120D] shadow-[0_3px_0_#F0A500]">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-[#FFFDF6] tracking-tight">{project.name}</h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#A8E6B0]/15 text-[#A8E6B0] font-bold border border-[#A8E6B0]/30">
                  ● Synced to Local Disk
                </span>
              </div>
              <p className="text-xs text-[#FFFDF6]/60 font-mono">
                Roblox Studio &amp; Rojo Workspace · {project.files.length} files
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Save Active to Disk */}
            <button
              onClick={handleSaveActiveToDisk}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-[#FFFDF6] text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              title="Save active script to local disk (.luau)"
            >
              <Save className="w-3.5 h-3.5 text-[#FFC93C]" />
              <span className="hidden sm:inline">Save Script</span>
            </button>

            {/* Export Entire Project ZIP */}
            <button
              onClick={handleExportZip}
              disabled={isExporting}
              className="btn-squeeze px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="Export complete Studio/Rojo project as ZIP archive"
            >
              {isExporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>Export Project (.zip)</span>
            </button>

            {/* Import Project File */}
            <label className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[#FFFDF6]/80 text-xs font-mono font-semibold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95">
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Import</span>
              <input type="file" accept=".json" onChange={handleImportProject} className="hidden" />
            </label>

            {/* Close Button */}
            <button
              onClick={() => {
                sound.click();
                onClose();
              }}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/15 active:scale-95 text-[#FFFDF6]/70 hover:text-[#FFFDF6] transition-colors cursor-pointer ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Body (2 Columns: File Tree & Code Editor) */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-[280px_1fr] overflow-hidden">
          
          {/* Left Column: Explorer Tree */}
          <div className="bg-[#142019] border-r border-white/10 flex flex-col overflow-y-auto">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <span className="text-xs font-mono uppercase font-bold text-[#FFFDF6]/60 tracking-wider flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-[#FFC93C]" />
                Explorer
              </span>
              <button
                onClick={() => {
                  sound.click();
                  setIsAddingFile(!isAddingFile);
                }}
                className="p-1 rounded-lg bg-white/10 hover:bg-[#FFC93C] hover:text-[#0B120D] active:scale-95 text-[#FFFDF6] transition-all cursor-pointer"
                title="Add new script to project"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* New File Creation Form */}
            {isAddingFile && (
              <form onSubmit={handleCreateFile} className="p-3 bg-[#1D2E24] border-b border-white/10 space-y-2 animate-in fade-in">
                <input
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="Script name (e.g. CombatSystem)"
                  autoFocus
                  className="w-full bg-[#142019] border border-white/20 rounded-lg px-2.5 py-1.5 text-xs text-[#FFFDF6] font-mono focus:outline-none focus:border-[#FFC93C]"
                />
                <select
                  value={newFileType}
                  onChange={(e) => setNewFileType(e.target.value as any)}
                  className="w-full bg-[#142019] border border-white/20 rounded-lg px-2.5 py-1.5 text-xs text-[#FFFDF6] font-mono focus:outline-none focus:border-[#FFC93C]"
                >
                  <option value="Server Script">Server Script (.server.luau)</option>
                  <option value="LocalScript">LocalScript (.client.luau)</option>
                  <option value="ModuleScript">ModuleScript (.luau)</option>
                </select>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 btn-squeeze py-1 text-xs font-bold rounded-lg active:scale-95"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingFile(false)}
                    className="px-2.5 py-1 bg-white/10 text-xs font-semibold rounded-lg text-[#FFFDF6] active:scale-95"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* File List */}
            <div className="p-2 space-y-1 flex-1">
              {project.files.map((file) => {
                const isActive = file.id === activeFileId;
                const isServer = file.scriptType === 'Server Script';
                const isClient = file.scriptType === 'LocalScript';
                const isModule = file.scriptType === 'ModuleScript';

                return (
                  <div
                    key={file.id}
                    onClick={() => handleSelectFile(file.id)}
                    className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all active:scale-[0.98] ${
                      isActive
                        ? 'bg-[#FFC93C] text-[#0B120D] font-bold shadow-md'
                        : 'text-[#FFFDF6]/80 hover:bg-white/5 hover:text-[#FFFDF6]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <FileCode className={`w-4 h-4 shrink-0 ${
                        isActive 
                          ? 'text-[#0B120D]' 
                          : isServer ? 'text-[#FF6B4A]' : isClient ? 'text-[#79C0FF]' : isModule ? 'text-[#A8E6B0]' : 'text-[#FFC93C]'
                      }`} />
                      <div className="truncate">
                        <div className="text-xs truncate">{file.name}</div>
                        <div className={`text-[10px] font-mono truncate ${isActive ? 'text-[#0B120D]/70' : 'text-[#FFFDF6]/40'}`}>
                          {file.targetInstance}
                        </div>
                      </div>
                    </div>

                    {/* Delete button (except if single file) */}
                    {project.files.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFile(file.id);
                        }}
                        className={`opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-black/20 transition-all ${
                          isActive ? 'text-[#0B120D]' : 'text-[#E85C4A]'
                        }`}
                        title="Delete file"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Project Stats Footer */}
            <div className="p-3 bg-[#1D2E24]/60 border-t border-white/10 text-[11px] font-mono text-[#FFFDF6]/50 flex items-center justify-between">
              <span>Rojo 7.x Compatible</span>
              <span className="text-[#A8E6B0]">Ready for Studio</span>
            </div>
          </div>

          {/* Right Column: Code Editor & Viewer */}
          <div className="bg-[#0D1117] flex flex-col overflow-hidden">
            {/* Editor Action Header */}
            <div className="px-5 py-3 bg-[#161B22] border-b border-white/10 flex items-center justify-between font-mono text-xs text-[#8B949E]">
              <div className="flex items-center gap-2 truncate">
                <span className="text-[#79C0FF]">{activeFile?.path || activeFile?.name}</span>
                <span className="text-white/20">|</span>
                <span className="text-[#7EE787] text-[11px]">Explorer: {activeFile?.targetInstance}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    sound.click();
                    setIsEditingCode(!isEditingCode);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                    isEditingCode
                      ? 'bg-[#FFC93C] text-[#0B120D]'
                      : 'bg-white/10 text-[#FFFDF6] hover:bg-white/20'
                  }`}
                >
                  {isEditingCode ? 'Viewing Mode' : 'Edit Script'}
                </button>

                {isEditingCode && (
                  <button
                    onClick={saveCurrentFileCode}
                    className="btn-squeeze px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer active:scale-95"
                  >
                    <Save className="w-3 h-3" />
                    <span>Save Edits</span>
                  </button>
                )}
              </div>
            </div>

            {/* Code Workspace */}
            <div className="flex-1 overflow-y-auto p-4">
              {isEditingCode ? (
                <div className="h-full flex flex-col">
                  <textarea
                    value={currentCode}
                    onChange={(e) => setCurrentCode(e.target.value)}
                    className="w-full h-full min-h-[400px] bg-[#0D1117] text-[#E6EDF3] font-mono text-xs sm:text-[13px] leading-relaxed p-4 border border-white/15 rounded-xl focus:outline-none focus:border-[#FFC93C] resize-none"
                    spellCheck={false}
                  />
                  <div className="mt-2 flex items-center justify-between text-xs font-mono text-[#8B949E]">
                    <span>Press "Save Edits" to persist changes to your local project.</span>
                    <span>{currentCode.split('\n').length} lines</span>
                  </div>
                </div>
              ) : (
                <LuauCodeViewer
                  code={currentCode || activeFile?.code || ''}
                  filename={activeFile?.name}
                  theme="dark"
                  maxHeight="100%"
                  onSavedToDisk={(fname) => onShowToast(`Saved ${fname} to local disk.`)}
                />
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

