import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, Sparkles, Plus, Trash2, MessageSquare, HardDrive, 
  FileCode, Check, Copy, Download, RefreshCw, Layers, ArrowRight, Lightbulb, Terminal,
  Search, BookOpen, ExternalLink, Zap, ShieldCheck, ChevronDown, ChevronRight,
  Cpu, AlertTriangle, Shield, CheckCircle2, Clock, FilePlus, Code2, Play, Folder
} from 'lucide-react';
import { 
  RobloxProject, 
  ChatSession, 
  ChatMessage, 
  ProjectFile, 
  RobloxSkillCitation, 
  ThinkingStep, 
  ChangePlan, 
  CodeReviewPayload, 
  GeneratedFilePayload 
} from '../types/project';
import { LuauCodeViewer } from './LuauCodeViewer';
import { RobloxSkillSearchModal } from './RobloxSkillSearchModal';
import { MarkdownRenderer } from './MarkdownRenderer';
import { 
  loadChatSessionsFromStorage, 
  saveChatSessionsToStorage, 
  generateRandomChatName,
  saveFileToDiskHandle,
  saveProjectToLocalStorage 
} from '../utils/projectDisk';
import { formatAndSanitizeLuau } from '../utils/luauFormatter';
import { safeFetchJson, getClientSideEmergencyResponse } from '../utils/api';
import { syncFileToStudio } from '../utils/syncClient';

interface ChatStudioProps {
  project: RobloxProject;
  onUpdateProject: (updated: RobloxProject) => void;
  onShowToast: (msg: string) => void;
  onOpenCodeInEditor: (fileId: string) => void;
  initialPrompt?: string;
}

export const ChatStudio: React.FC<ChatStudioProps> = ({
  project,
  onUpdateProject,
  onShowToast,
  onOpenCodeInEditor,
  initialPrompt,
}) => {
  const [sessions, setSessions] = useState<ChatSession[]>(() => loadChatSessionsFromStorage());
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const loaded = loadChatSessionsFromStorage();
    return loaded[0]?.id || `chat-${Date.now()}`;
  });
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSkillSearchOpen, setIsSkillSearchOpen] = useState(false);
  const [expandedThinkingMessageIds, setExpandedThinkingMessageIds] = useState<Record<string, boolean>>({});
  const [selectedFileTabByMsg, setSelectedFileTabByMsg] = useState<Record<string, number>>({});
  const [thinkingStageIndex, setThinkingStageIndex] = useState(0);

  // Auto trigger initialPrompt if passed from GameMap or other workspaces
  useEffect(() => {
    if (initialPrompt && initialPrompt.trim().length > 0) {
      handleSendMessage(initialPrompt.trim());
    }
  }, [initialPrompt]);

  // Context-aware right side panel state
  const [rightPanelMode, setRightPanelMode] = useState<'none' | 'files' | 'intelligence'>('none');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages, isSending]);

  // Thinking stage cycling during request
  useEffect(() => {
    if (!isSending) {
      setThinkingStageIndex(0);
      return;
    }
    const stages = [
      "Analyzing Roblox Studio requirements...",
      "Reading workspace context & hierarchy...",
      "Formulating client-server architecture...",
      "Writing production Luau code with --!strict...",
      "Verifying security, rate limits & signal cleanups..."
    ];
    const interval = setInterval(() => {
      setThinkingStageIndex((prev) => (prev + 1) % stages.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [isSending]);

  const toggleThinking = (msgId: string) => {
    setExpandedThinkingMessageIds(prev => ({
      ...prev,
      [msgId]: !prev[msgId]
    }));
  };

  const handleCreateNewChat = () => {
    const newSession: ChatSession = {
      id: `chat-${Date.now()}`,
      name: 'New Conversation',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [
        {
          id: `welcome-${Date.now()}`,
          role: 'assistant',
          content: `Hey! I'm **Squeeze**, your Elite Roblox Luau Engineer & Architect. I have full visibility over your project (**${project.name}**) with **${project.files.length} scripts** loaded.\n\nAsk me to build game mechanics, create modular systems, debug memory leaks, or generate full multi-file architectures!`,
          timestamp: Date.now(),
          thinkingSteps: [
            { stage: "Request Understanding", details: "Initialized session with active workspace context.", completed: true, durationMs: 40 },
            { stage: "Project Context Analysis", details: `Loaded ${project.files.length} files into memory.`, completed: true, durationMs: 60 },
            { stage: "Completed", details: "Ready for development commands.", completed: true, durationMs: 10 }
          ],
          suggestedPrompts: [
            "Analyze my project architecture",
            "Build an admin commands system",
            "Create a safe DataStore manager",
            "Make an interactive loot chest"
          ]
        }
      ]
    };

    const updated = [newSession, ...sessions];
    setSessions(updated);
    setActiveSessionId(newSession.id);
    saveChatSessionsToStorage(updated);
    onShowToast(`Created new chat "${newSession.name}"!`);
  };

  const handleDeleteChat = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sessions.length <= 1) {
      onShowToast('Cannot delete the last chat session.');
      return;
    }
    const filtered = sessions.filter(s => s.id !== sessionId);
    setSessions(filtered);
    if (activeSessionId === sessionId) {
      setActiveSessionId(filtered[0].id);
    }
    saveChatSessionsToStorage(filtered);
    onShowToast('Chat session deleted.');
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const promptToSend = (customPrompt || inputText).trim();
    if (!promptToSend || isSending) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: promptToSend,
      timestamp: Date.now()
    };

    const currentMessages = [...(activeSession?.messages || []), userMsg];
    
    // Check if this is the first user message in the session
    const existingUserMessages = (activeSession?.messages || []).filter(m => m.role === 'user');
    const isFirstUserMessage = existingUserMessages.length === 0;

    let derivedTitle = activeSession?.name;
    if (isFirstUserMessage || !derivedTitle || derivedTitle === 'New Conversation' || derivedTitle.startsWith('⚡') || derivedTitle.startsWith('🏰') || derivedTitle.startsWith('⚔️')) {
      const cleaned = promptToSend.replace(/\s+/g, ' ').trim();
      if (cleaned.length > 0) {
        derivedTitle = cleaned.length > 100 ? cleaned.slice(0, 97) + '...' : cleaned;
      }
    }

    // Update local state with user message and derived title immediately
    const updatedSessionsWithUser = sessions.map(s => {
      if (s.id === activeSessionId) {
        return {
          ...s,
          name: derivedTitle || s.name,
          messages: currentMessages,
          updatedAt: Date.now()
        };
      }
      return s;
    });

    setSessions(updatedSessionsWithUser);
    saveChatSessionsToStorage(updatedSessionsWithUser);
    setInputText('');
    setIsSending(true);

    try {
      // Build high-density project context
      const projectContext = `Current Roblox Project: "${project.name}"
Root Folder: "${project.folderName || project.name || 'RobloxStudioGame'}"
Total Scripts: ${project.files.length}

Files Overview:
${project.files.map(f => `- ${f.path} [${f.scriptType} -> ${f.targetInstance}] (${f.code.split('\n').length} lines)`).join('\n')}`;

      const token = localStorage.getItem('squeeze_token');

      // Attempt AI backend endpoint
      const apiResult = await safeFetchJson('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          messages: currentMessages.map(m => ({ role: m.role, content: m.content })),
          projectContext,
          projectFiles: project.files.map(f => ({
            path: f.path,
            name: f.name,
            code: f.code,
            scriptType: f.scriptType,
            targetInstance: f.targetInstance
          }))
        })
      });

      let data: any = null;

      if (apiResult.ok && apiResult.data) {
        data = apiResult.data;
      } else {
        // Fallback for offline or static deployments
        console.warn('API returned non-OK or non-JSON, using client fallback:', apiResult.error);
        data = getClientSideEmergencyResponse(promptToSend, project.files);
      }

      // Collect all generated scripts (both single and multi-file)
      const scriptsToApply: GeneratedFilePayload[] = [];
      if (data.filesGenerated && Array.isArray(data.filesGenerated) && data.filesGenerated.length > 0) {
        scriptsToApply.push(...data.filesGenerated);
      } else if (data.generatedScript && data.generatedScript.code) {
        scriptsToApply.push(data.generatedScript);
      }

      let modifiedFilesList: ChatMessage['modifiedFiles'] = undefined;
      let targetFileId: string | undefined = undefined;

      if (scriptsToApply.length > 0) {
        let updatedProjectFiles = [...project.files];
        const recordedModifications: NonNullable<ChatMessage['modifiedFiles']> = [];

        for (const scriptPayload of scriptsToApply) {
          const cleanCode = formatAndSanitizeLuau(scriptPayload.code);
          const fileName = (scriptPayload.filePath?.split('/').pop()) || `${(scriptPayload.title || 'Script').replace(/[^a-zA-Z0-9]/g, '')}.server.luau`;
          const filePath = scriptPayload.filePath || `src/server/${fileName}`;

          const existingFileIndex = updatedProjectFiles.findIndex(f => f.path === filePath || f.name === fileName);
          let fileActionType: 'created' | 'updated' = 'created';
          let savedFileId = '';

          if (existingFileIndex >= 0) {
            fileActionType = 'updated';
            savedFileId = updatedProjectFiles[existingFileIndex].id;
            updatedProjectFiles[existingFileIndex] = {
              ...updatedProjectFiles[existingFileIndex],
              code: cleanCode,
              lastModified: Date.now()
            };
          } else {
            const newFile: ProjectFile = {
              id: `file-chat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              name: fileName,
              path: filePath,
              code: cleanCode,
              scriptType: scriptPayload.scriptType || 'Server Script',
              targetInstance: scriptPayload.targetInstance || 'ServerScriptService',
              lastModified: Date.now(),
              tags: ['AICreated', 'LuauStrict']
            };
            savedFileId = newFile.id;
            updatedProjectFiles.push(newFile);
          }

          if (!targetFileId) {
            targetFileId = savedFileId;
          }

          // Direct write to disk if native folder handle is available
          if (project.dirHandle) {
            const fileToSave = updatedProjectFiles.find(f => f.id === savedFileId);
            if (fileToSave) {
              await saveFileToDiskHandle(fileToSave, cleanCode, project.dirHandle);
            }
          }

          recordedModifications.push({
            path: filePath,
            name: fileName,
            action: fileActionType
          });

          // Auto-queue for Roblox Studio WebSync
          syncFileToStudio(project.id, {
            path: filePath,
            name: fileName,
            source: cleanCode
          }, 'ai').catch(err => console.warn('Studio WebSync push error:', err));
        }

        const updatedProject: RobloxProject = {
          ...project,
          files: updatedProjectFiles,
          activeFileId: targetFileId || project.activeFileId,
          updatedAt: Date.now()
        };

        onUpdateProject(updatedProject);
        saveProjectToLocalStorage(updatedProject);
        modifiedFilesList = recordedModifications;

        if (scriptsToApply.length === 1) {
          onShowToast(`⚡ Luau script ${recordedModifications[0].action} in ${recordedModifications[0].name}!`);
        } else {
          onShowToast(`⚡ Generated and saved ${scriptsToApply.length} scripts in workspace!`);
        }
      }

      const assistantMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.message || 'Here is the implementation for your game.',
        timestamp: Date.now(),
        thinkingSteps: data.thinkingSteps,
        changePlan: data.changePlan,
        codeReview: data.codeReview,
        skillsFound: data.skillsFound,
        actionPerformed: data.actionPerformed,
        generatedScript: data.generatedScript,
        filesGenerated: data.filesGenerated,
        modifiedFiles: modifiedFilesList,
        suggestedPrompts: data.suggestedPrompts || [
          "Add debounce protection",
          "Create a client-side UI controller",
          "Save player state with DataStoreService"
        ]
      };

      const finalMessages = [...currentMessages, assistantMsg];
      const finalSessions = sessions.map(s => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            messages: finalMessages,
            updatedAt: Date.now()
          };
        }
        return s;
      });

      setSessions(finalSessions);
      saveChatSessionsToStorage(finalSessions);
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `I encountered an issue while processing your request: ${err.message}. Please try again.`,
        timestamp: Date.now()
      };
      const finalMessages = [...currentMessages, errorMsg];
      const finalSessions = sessions.map(s => s.id === activeSessionId ? { ...s, messages: finalMessages } : s);
      setSessions(finalSessions);
      saveChatSessionsToStorage(finalSessions);
    } finally {
      setIsSending(false);
    }
  };

  const thinkingStages = [
    "Analyzing Roblox Studio requirements...",
    "Reading workspace context & hierarchy...",
    "Formulating client-server architecture...",
    "Writing production Luau code with --!strict...",
    "Verifying security, rate limits & signal cleanups..."
  ];

  return (
    <div className="flex flex-col md:flex-row h-full bg-[#0D1117] text-[#FFFDF6] overflow-hidden rounded-xl border border-white/10">
      
      {/* Left Column: Chat History Sidebar */}
      <div className="w-full md:w-[260px] bg-[#161B22] border-r border-white/10 flex flex-col shrink-0">
        
        {/* Sidebar Header: New Chat Button */}
        <div className="p-3.5 border-b border-white/10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#FFC93C]" />
            <span className="font-bold text-xs uppercase tracking-wider text-[#FFFDF6]/80 font-mono">
              Chat History
            </span>
          </div>

          <button
            onClick={handleCreateNewChat}
            className="p-1.5 rounded-lg bg-[#FFC93C] text-[#0B120D] hover:bg-[#ffe082] transition-all cursor-pointer flex items-center gap-1 text-xs font-bold font-mono"
            title="Create New Chat"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New</span>
          </button>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5 max-h-[140px] md:max-h-none">
          {sessions.map(session => {
            const isActive = session.id === activeSessionId;
            return (
              <div
                key={session.id}
                onClick={() => setActiveSessionId(session.id)}
                className={`group flex items-center justify-between p-2.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-white/15 text-[#FFC93C] font-bold border border-white/10' 
                    : 'text-[#FFFDF6]/70 hover:bg-white/5 hover:text-[#FFFDF6]'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="truncate">{session.name}</span>
                </div>

                <button
                  onClick={(e) => handleDeleteChat(session.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-[#FF7B72] transition-opacity cursor-pointer"
                  title="Delete Chat"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Active Project Pill in Sidebar */}
        <div className="p-3 border-t border-white/10 bg-[#0D1117]/60 text-[11px] font-mono text-[#FFFDF6]/60 flex items-center justify-between">
          <span className="flex items-center gap-1.5 truncate">
            <HardDrive className="w-3.5 h-3.5 text-[#A8E6B0] shrink-0" />
            <span className="truncate font-semibold text-[#FFFDF6]">{project.name}</span>
          </span>
          <span className="text-[#A8E6B0] shrink-0 text-[10px] font-bold bg-[#A8E6B0]/10 px-1.5 py-0.5 rounded">
            {project.files.length} files
          </span>
        </div>
      </div>

      {/* Right Column: Active Conversation Feed */}
      <div className="flex-1 flex flex-col bg-[#0D1117] overflow-hidden min-h-[460px]">
        
        {/* Chat Feed Header */}
        <div className="px-4 py-2.5 border-b border-white/10 bg-[#161B22]/80 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2 h-2 rounded-full bg-[#A8E6B0] animate-pulse" />
            <h3 className="font-bold text-xs sm:text-sm text-[#FFFDF6] truncate font-display">
              {activeSession?.name}
            </h3>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-[#A8E6B0]/15 text-[#A8E6B0] font-bold border border-[#A8E6B0]/30 shrink-0">
              Elite Engineer Active
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setRightPanelMode(prev => prev === 'files' ? 'none' : 'files')}
              className={`px-2.5 py-1 rounded-lg border text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                rightPanelMode === 'files'
                  ? 'bg-[#FFC93C] text-[#0B120D] border-[#FFC93C]'
                  : 'bg-white/5 hover:bg-white/10 text-white/80 border-white/10'
              }`}
              title="Toggle Project Files context panel"
            >
              <Folder className="w-3.5 h-3.5" />
              <span>Project Files</span>
            </button>

            <button
              onClick={() => setRightPanelMode(prev => prev === 'intelligence' ? 'none' : 'intelligence')}
              className={`px-2.5 py-1 rounded-lg border text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                rightPanelMode === 'intelligence'
                  ? 'bg-[#FFC93C] text-[#0B120D] border-[#FFC93C]'
                  : 'bg-white/5 hover:bg-white/10 text-white/80 border-white/10'
              }`}
              title="Toggle Game Intelligence context panel"
            >
              <Lightbulb className="w-3.5 h-3.5" />
              <span>Intelligence</span>
            </button>

            <button
              onClick={() => handleSendMessage("Read my project and analyze all scripts, functions, and architecture.")}
              disabled={isSending || project.files.length === 0}
              className="px-2.5 py-1 rounded-lg bg-[#A8E6B0]/15 hover:bg-[#A8E6B0]/25 text-[#A8E6B0] border border-[#A8E6B0]/30 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              title="Inspect and analyze all loaded scripts, functions, and systems in your game"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Read My Project</span>
            </button>

            <button
              onClick={() => setIsSkillSearchOpen(true)}
              className="px-2.5 py-1 rounded-lg bg-[#FFC93C]/15 hover:bg-[#FFC93C]/25 text-[#FFC93C] border border-[#FFC93C]/30 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              title="Search Roblox Creator Hub Skills & APIs"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Roblox Skills &amp; APIs</span>
            </button>

            <div className="text-[11px] font-mono text-white/40 hidden sm:block">
              {activeSession?.messages.length || 0} msgs
            </div>
          </div>
        </div>

        {/* Main Conversation & Optional Context-Aware Right Panel */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Messages & Composer */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 font-body">
              {activeSession?.messages.map((msg, index) => {
                const isAi = msg.role === 'assistant';
                const hasThinking = isAi && msg.thinkingSteps && msg.thinkingSteps.length > 0;
                const isThinkingExpanded = hasThinking ? (expandedThinkingMessageIds[msg.id] ?? false) : false;

                // Determine all generated files to display
                const displayFiles: GeneratedFilePayload[] = [];
                if (msg.filesGenerated && msg.filesGenerated.length > 0) {
                  displayFiles.push(...msg.filesGenerated);
                } else if (msg.generatedScript) {
                  displayFiles.push(msg.generatedScript);
                }

                const activeTabIdx = selectedFileTabByMsg[msg.id] || 0;
                const activeFile = displayFiles[activeTabIdx] || displayFiles[0];

                return (
                  <div
                    key={msg.id || index}
                    className={`flex flex-col ${isAi ? 'items-start' : 'items-end'}`}
                  >
                    <div className={`flex items-center gap-2 mb-1 text-[11px] font-mono ${isAi ? 'text-[#FFC93C]' : 'text-[#79C0FF]'}`}>
                      <span className="font-bold">{isAi ? '⚡ Squeeze Senior Engineer' : 'You'}</span>
                      <span className="text-white/30 text-[10px]">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div
                      className={`max-w-[95%] sm:max-w-[88%] rounded-2xl p-4 sm:p-5 text-xs sm:text-sm leading-relaxed space-y-3.5 ${
                        isAi
                          ? 'bg-[#161B22] border border-white/10 text-[#FFFDF6] rounded-tl-sm shadow-lg'
                          : 'bg-[#FFC93C] text-[#0B120D] font-medium rounded-tr-sm'
                      }`}
                    >
                      {/* Main Message Content */}
                      <div className="w-full">
                        <MarkdownRenderer content={msg.content} theme={isAi ? 'dark' : 'light'} />
                      </div>

                      {/* Multi-File / Single-File Code Viewer */}
                      {displayFiles.length > 0 && activeFile && (
                        <div className="pt-2 border-t border-white/10 space-y-2">
                          {/* Tabs if multi-file generated */}
                          {displayFiles.length > 1 && (
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 font-mono text-[11px]">
                              {displayFiles.map((df, dfIdx) => (
                                <button
                                  key={dfIdx}
                                  onClick={() => setSelectedFileTabByMsg(prev => ({ ...prev, [msg.id]: dfIdx }))}
                                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                                    activeTabIdx === dfIdx
                                      ? 'bg-[#FFC93C] text-[#0B120D] font-bold shadow'
                                      : 'bg-white/5 hover:bg-white/10 text-white/70'
                                  }`}
                                >
                                  <FileCode className="w-3.5 h-3.5" />
                                  <span>{df.filePath?.split('/').pop() || df.title}</span>
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Header bar of active file */}
                          <div className="flex items-center justify-between text-xs font-mono text-[#A8E6B0]">
                            <span className="flex items-center gap-1 font-bold">
                              <FileCode className="w-3.5 h-3.5" />
                              {activeFile.title || activeFile.filePath}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60">
                                {activeFile.scriptType}
                              </span>
                              <span className="text-[10px] text-white/50">{activeFile.targetInstance}</span>
                            </div>
                          </div>

                          <LuauCodeViewer
                            code={activeFile.code}
                            filename={activeFile.filePath?.split('/').pop() || `${activeFile.title}.server.luau`}
                            theme="dark"
                            maxHeight="320px"
                            onOpenInProject={() => {
                              const fileMatch = project.files.find(f => 
                                f.path === activeFile.filePath || 
                                f.name === (activeFile.filePath?.split('/').pop())
                              );
                              if (fileMatch) {
                                onOpenCodeInEditor(fileMatch.id);
                              } else {
                                onShowToast(`Opened ${activeFile.title} in project.`);
                              }
                            }}
                            onSavedToDisk={(fname) => onShowToast(`Saved ${fname} to disk!`)}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Dynamic Thinking State while Waiting for Response */}
              {isSending && (
                <div className="flex flex-col items-start space-y-2">
                  <div className="flex items-center gap-2 text-[11px] font-mono text-[#FFC93C]">
                    <Cpu className="w-3.5 h-3.5 animate-spin text-[#FFC93C]" />
                    <span className="font-bold">⚡ Squeeze Reasoning Engine</span>
                  </div>
                  <div className="bg-[#161B22] border border-white/10 text-[#FFFDF6] rounded-2xl rounded-tl-sm p-4 text-xs font-mono shadow-md space-y-2 max-w-[85%]">
                    <div className="flex items-center gap-2 text-[#A8E6B0]">
                      <RefreshCw className="w-4 h-4 animate-spin text-[#FFC93C]" />
                      <span className="font-bold">{thinkingStages[thinkingStageIndex]}</span>
                    </div>
                    <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
                      <div 
                        className="bg-[#FFC93C] h-full transition-all duration-700 ease-out" 
                        style={{ width: `${((thinkingStageIndex + 1) / thinkingStages.length) * 100}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-white/40">
                      Formulating architecture with strict Luau typing, security validation, and project-aware references.
                    </p>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Box Bar */}
            <div className="p-3 sm:p-4 bg-[#161B22] border-t border-white/10 flex flex-col gap-1.5">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-end gap-2"
              >
                <div className="flex-1 relative flex items-center bg-[#0D1117] border border-white/15 rounded-xl focus-within:border-[#FFC93C] transition-all">
                  <textarea
                    ref={textareaRef}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (e.shiftKey) {
                          return;
                        } else {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }
                    }}
                    placeholder={`Ask Squeeze anything about Roblox skills or "make an admin commands system"…`}
                    disabled={isSending}
                    rows={1}
                    className="w-full bg-transparent px-4 py-2.5 text-xs sm:text-sm text-[#FFFDF6] placeholder:text-white/35 focus:outline-none resize-none font-body custom-scrollbar leading-relaxed"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSending || !inputText.trim()}
                  className="btn-squeeze px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0 h-[42px]"
                  title="Send message (Enter)"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Send</span>
                </button>
              </form>

              {/* Quick Keyboard Helper & Discovery Pills */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 px-1 text-[10px] font-mono text-white/40 select-none">
                <div className="flex items-center gap-2">
                  <span>
                    Press <kbd className="px-1 py-0.5 rounded bg-white/10 text-white/70">Enter</kbd> to send, <kbd className="px-1 py-0.5 rounded bg-white/10 text-white/70">Shift + Enter</kbd> for newline
                  </span>
                  {inputText.includes('\n') && (
                    <span className="text-[#FFC93C] font-semibold">
                      {inputText.split('\n').length} lines
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleSendMessage("Read my project and analyze all scripts, functions, and architecture.")}
                    disabled={isSending || project.files.length === 0}
                    className="text-[#A8E6B0] hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <FileCode className="w-3 h-3" />
                    <span>Read Project ({project.files.length} scripts)</span>
                  </button>

                  <button
                    onClick={() => setIsSkillSearchOpen(true)}
                    className="text-[#FFC93C] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Browse 10+ Skills</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Context-Aware Right Side Panel */}
          {rightPanelMode !== 'none' && (
            <div className="w-80 bg-[#11161D] border-l border-white/10 flex flex-col shrink-0 animate-fadeIn overflow-hidden">
              <div className="p-3.5 border-b border-white/10 flex items-center justify-between bg-[#161B22]">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#FFC93C]">
                  {rightPanelMode === 'files' ? (
                    <>
                      <Folder className="w-4 h-4" />
                      <span>Project Files Context ({project.files.length})</span>
                    </>
                  ) : (
                    <>
                      <Lightbulb className="w-4 h-4" />
                      <span>Intelligence &amp; Gaps</span>
                    </>
                  )}
                </div>

                <button
                  onClick={() => setRightPanelMode('none')}
                  className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white cursor-pointer"
                  title="Close panel"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs font-mono">
                {rightPanelMode === 'files' ? (
                  <div className="space-y-1.5">
                    <p className="text-[11px] text-white/50 mb-2">
                      Loaded project files available as AI context:
                    </p>
                    {project.files.map(file => (
                      <div
                        key={file.id}
                        onClick={() => onOpenCodeInEditor(file.id)}
                        className="p-2 rounded bg-white/5 hover:bg-white/10 border border-white/5 cursor-pointer flex items-center justify-between transition-all group"
                      >
                        <div className="truncate pr-2">
                          <span className="font-semibold text-[#FFFDF6] block truncate">{file.name}</span>
                          <span className="text-[10px] text-white/40 block truncate">{file.path}</span>
                        </div>
                        <span className="text-[10px] text-[#A8E6B0] shrink-0 group-hover:underline">Open &rarr;</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                      <span className="text-[#FFC93C] font-bold block mb-1">Architecture Overview</span>
                      <p className="text-[11px] text-white/70 font-body">
                        Project <strong className="text-[#FFFDF6]">{project.name}</strong> has {project.files.length} scripts structured with server logic and module handlers.
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                      <span className="text-[#7EE787] font-bold block mb-1">Detected Systems</span>
                      <ul className="text-[11px] text-white/70 space-y-1 mt-1">
                        <li>&bull; Leaderstats &amp; Currency</li>
                        <li>&bull; DataStore Save/Load</li>
                        <li>&bull; Combat &amp; Tools</li>
                      </ul>
                    </div>

                    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                      <span className="text-[#79C0FF] font-bold block mb-1">Recommended Next Step</span>
                      <p className="text-[11px] text-white/70 font-body">
                        Ask Squeeze: &quot;Add daily quests and milestone rewards to maintain high retention.&quot;
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>


      {/* Roblox Skills Knowledge Explorer Modal */}
      <RobloxSkillSearchModal
        isOpen={isSkillSearchOpen}
        onClose={() => setIsSkillSearchOpen(false)}
        onSelectSkillForPrompt={(prompt) => {
          setInputText(prompt);
          if (textareaRef.current) {
            textareaRef.current.focus();
          }
        }}
        onExecuteSkillAction={(_skillTitle, instruction) => {
          handleSendMessage(instruction);
        }}
      />
    </div>
  );
};
