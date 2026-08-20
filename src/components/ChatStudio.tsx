import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, Sparkles, Plus, Trash2, MessageSquare, HardDrive, 
  FileCode, Check, Copy, Download, RefreshCw, Layers, ArrowRight, Lightbulb, Terminal,
  Search, BookOpen, ExternalLink, Zap, ShieldCheck
} from 'lucide-react';
import { RobloxProject, ChatSession, ChatMessage, ProjectFile, RobloxSkillCitation } from '../types/project';
import { LuauCodeViewer } from './LuauCodeViewer';
import { RobloxSkillSearchModal } from './RobloxSkillSearchModal';
import { 
  loadChatSessionsFromStorage, 
  saveChatSessionsToStorage, 
  generateRandomChatName,
  saveFileToDiskHandle,
  saveProjectToLocalStorage 
} from '../utils/projectDisk';
import { formatAndSanitizeLuau } from '../utils/luauFormatter';

interface ChatStudioProps {
  project: RobloxProject;
  onUpdateProject: (updated: RobloxProject) => void;
  onShowToast: (msg: string) => void;
  onOpenCodeInEditor: (fileId: string) => void;
}

export const ChatStudio: React.FC<ChatStudioProps> = ({
  project,
  onUpdateProject,
  onShowToast,
  onOpenCodeInEditor,
}) => {
  const [sessions, setSessions] = useState<ChatSession[]>(() => loadChatSessionsFromStorage());
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const loaded = loadChatSessionsFromStorage();
    return loaded[0]?.id || `chat-${Date.now()}`;
  });
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSkillSearchOpen, setIsSkillSearchOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages, isSending]);

  // Automatically adjust textarea height when multiline content or Shift+Enter is pressed
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(Math.max(textareaRef.current.scrollHeight, 44), 160)}px`;
    }
  }, [inputText]);

  const handleCreateNewChat = () => {
    const newName = generateRandomChatName();
    const newSession: ChatSession = {
      id: `chat-${Date.now()}`,
      name: newName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [
        {
          id: `msg-init-${Date.now()}`,
          role: 'assistant',
          content: `New session started for **${newName}**! I have full access to your game files in \`${project.name}\` and the complete **Roblox Skills & Creator Hub Knowledge Base**.\n\nAsk me any question about Roblox engine APIs (Pathfinding, DataStores, TweenService, Raycasting, Raycast hitboxes, ContextActionService), or ask me to **build and implement any system directly for you**!`,
          timestamp: Date.now(),
          suggestedPrompts: [
            "Make admin commands for my game",
            "How does PathfindingService work?",
            "Create a safe DataStore with auto-save",
            "Make a high-speed raycast combat hitbox"
          ]
        }
      ]
    };

    const updated = [newSession, ...sessions];
    setSessions(updated);
    setActiveSessionId(newSession.id);
    saveChatSessionsToStorage(updated);
    onShowToast(`Created new chat: ${newName}`);
  };

  const handleDeleteChat = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sessions.length <= 1) {
      onShowToast('Cannot delete the only active chat session.');
      return;
    }
    const updated = sessions.filter(s => s.id !== sessionId);
    setSessions(updated);
    if (activeSessionId === sessionId) {
      setActiveSessionId(updated[0].id);
    }
    saveChatSessionsToStorage(updated);
    onShowToast('Chat session deleted.');
  };

  const handleSendMessage = async (textToSend?: string) => {
    const prompt = (textToSend || inputText).trim();
    if (!prompt || isSending) return;

    setInputText('');
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: Date.now()
    };

    // Add user message to state
    const currentMessages = [...(activeSession?.messages || []), userMsg];
    const updatedSessionsWithUser = sessions.map(s => {
      if (s.id === activeSessionId) {
        return {
          ...s,
          messages: currentMessages,
          updatedAt: Date.now()
        };
      }
      return s;
    });

    setSessions(updatedSessionsWithUser);
    saveChatSessionsToStorage(updatedSessionsWithUser);
    setIsSending(true);

    try {
      // Build project context string from real project files
      const projectContext = `PROJECT NAME: ${project.name}\nTOTAL SCRIPTS: ${project.files.length}\nFILES SUMMARY:\n` +
        project.files.map(f => `--- ${f.path} (${f.scriptType} -> ${f.targetInstance}) ---\n${f.code.slice(0, 1000)}`).join('\n\n');

      const token = localStorage.getItem('squeeze_token');
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          messages: currentMessages.map(m => ({ role: m.role, content: m.content })),
          projectContext
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response from AI assistant.');
      }

      // If script was generated, save into project files!
      let modifiedFilesList: ChatMessage['modifiedFiles'] = undefined;
      let targetFileId: string | undefined = undefined;

      if (data.generatedScript && data.generatedScript.code) {
        const cleanCode = formatAndSanitizeLuau(data.generatedScript.code);
        const fileName = (data.generatedScript.filePath?.split('/').pop()) || `${data.generatedScript.title.replace(/[^a-zA-Z0-9]/g, '')}.server.luau`;
        const filePath = data.generatedScript.filePath || `src/server/${fileName}`;

        const existingFileIndex = project.files.findIndex(f => f.path === filePath || f.name === fileName);
        let updatedProjectFiles = [...project.files];
        let fileActionType: 'created' | 'updated' = 'created';

        if (existingFileIndex >= 0) {
          fileActionType = 'updated';
          targetFileId = project.files[existingFileIndex].id;
          updatedProjectFiles[existingFileIndex] = {
            ...project.files[existingFileIndex],
            code: cleanCode,
            lastModified: Date.now()
          };
        } else {
          const newFile: ProjectFile = {
            id: `file-chat-${Date.now()}`,
            name: fileName,
            path: filePath,
            code: cleanCode,
            scriptType: data.generatedScript.scriptType || 'Server Script',
            targetInstance: data.generatedScript.targetInstance || 'ServerScriptService',
            lastModified: Date.now(),
            tags: ['ChatGenerated']
          };
          targetFileId = newFile.id;
          updatedProjectFiles.push(newFile);
        }

        // Direct write to disk if native folder is attached
        if (project.dirHandle) {
          const fileToSave = updatedProjectFiles.find(f => f.id === targetFileId);
          if (fileToSave) {
            await saveFileToDiskHandle(fileToSave, cleanCode, project.dirHandle);
          }
        }

        const updatedProject: RobloxProject = {
          ...project,
          files: updatedProjectFiles,
          activeFileId: targetFileId || project.activeFileId,
          updatedAt: Date.now()
        };

        onUpdateProject(updatedProject);
        saveProjectToLocalStorage(updatedProject);

        modifiedFilesList = [
          {
            path: filePath,
            name: fileName,
            action: fileActionType
          }
        ];

        onShowToast(`⚡ Luau script ${fileActionType === 'created' ? 'created' : 'updated'} in ${fileName}!`);
      }

      const assistantMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.message || 'Here is the implementation for your game.',
        timestamp: Date.now(),
        skillsFound: data.skillsFound,
        actionPerformed: data.actionPerformed,
        generatedScript: data.generatedScript,
        modifiedFiles: modifiedFilesList,
        suggestedPrompts: data.suggestedPrompts || [
          "Add cooldown timer debounce",
          "Create a companion LocalScript",
          "Save data to DataStoreService"
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
        content: `I ran into an issue connecting with the AI engine: ${err.message}. Please try again.`,
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
            title="Create New Chat with Random Name"
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
        
        {/* Chat Feed Header with Roblox Skills Explorer Button */}
        <div className="px-4 py-2.5 border-b border-white/10 bg-[#161B22]/80 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-bold text-xs sm:text-sm text-[#FFFDF6] truncate font-display">
              {activeSession?.name}
            </h3>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-[#A8E6B0]/15 text-[#A8E6B0] font-bold border border-[#A8E6B0]/30 shrink-0">
              Project Context Active
            </span>
          </div>

          <div className="flex items-center gap-2">
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

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 font-body">
          {activeSession?.messages.map((msg, index) => {
            const isAi = msg.role === 'assistant';
            return (
              <div
                key={msg.id || index}
                className={`flex flex-col ${isAi ? 'items-start' : 'items-end'}`}
              >
                <div className={`flex items-center gap-2 mb-1 text-[11px] font-mono ${isAi ? 'text-[#FFC93C]' : 'text-[#79C0FF]'}`}>
                  <span className="font-bold">{isAi ? '⚡ Squeeze AI Co-Pilot' : 'You'}</span>
                  <span className="text-white/30 text-[10px]">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div
                  className={`max-w-[95%] sm:max-w-[85%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                    isAi
                      ? 'bg-[#161B22] border border-white/10 text-[#FFFDF6] rounded-tl-sm shadow-md'
                      : 'bg-[#FFC93C] text-[#0B120D] font-medium rounded-tr-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {/* Action Performed Badge */}
                  {isAi && msg.actionPerformed && (
                    <div className="mt-3 p-2.5 rounded-xl bg-[#0D1117] border border-[#A8E6B0]/30 flex items-start gap-2">
                      <Zap className="w-4 h-4 text-[#A8E6B0] shrink-0 mt-0.5 fill-current" />
                      <div className="text-xs font-mono">
                        <div className="font-bold text-[#A8E6B0]">
                          {msg.actionPerformed.summary}
                        </div>
                        {msg.actionPerformed.details && (
                          <div className="text-white/60 text-[11px] mt-0.5">
                            {msg.actionPerformed.details}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Roblox Skill Citations / Search Results */}
                  {isAi && msg.skillsFound && msg.skillsFound.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-mono text-[#FFC93C] font-bold">
                        <span className="flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5" />
                          Roblox Engine Skills &amp; Reference Docs
                        </span>
                        <span className="text-white/40 text-[10px]">
                          {msg.skillsFound.length} skill{msg.skillsFound.length > 1 ? 's' : ''} cited
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        {msg.skillsFound.slice(0, 3).map((skill, sIdx) => (
                          <div key={sIdx} className="p-2.5 rounded-xl bg-[#0D1117] border border-white/10 text-xs space-y-1.5">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-[#FFFDF6] font-display flex items-center gap-1.5">
                                <Sparkles className="w-3 h-3 text-[#FFC93C]" />
                                {skill.title}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-white/70">
                                {skill.category}
                              </span>
                            </div>

                            <p className="text-[11px] text-white/70 leading-relaxed font-body">
                              {skill.summary}
                            </p>

                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                              {skill.apiDocsUrl && (
                                <a
                                  href={skill.apiDocsUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] font-mono text-[#79C0FF] hover:underline"
                                >
                                  Creator Hub Docs
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}

                              <button
                                onClick={() => handleSendMessage(`Build and implement the ${skill.title} system for my Roblox game with --!strict typing and create the file in my workspace.`)}
                                className="px-2 py-0.5 rounded bg-[#FFC93C]/20 hover:bg-[#FFC93C]/30 text-[#FFC93C] text-[10px] font-mono font-bold flex items-center gap-1 transition-all cursor-pointer"
                              >
                                <Zap className="w-2.5 h-2.5 fill-current" />
                                <span>⚡ Do It For Me</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* If Luau code was generated, show inline code viewer */}
                  {msg.generatedScript && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <div className="flex items-center justify-between mb-2 text-xs font-mono text-[#A8E6B0]">
                        <span className="flex items-center gap-1 font-bold">
                          <FileCode className="w-3.5 h-3.5" />
                          {msg.generatedScript.title}
                        </span>
                        <span className="text-[10px] text-white/50">{msg.generatedScript.targetInstance}</span>
                      </div>

                      <LuauCodeViewer
                        code={msg.generatedScript.code}
                        filename={msg.generatedScript.filePath?.split('/').pop() || `${msg.generatedScript.title}.server.luau`}
                        theme="dark"
                        maxHeight="280px"
                        onOpenInProject={() => {
                          const fileMatch = project.files.find(f => f.name === (msg.generatedScript?.filePath?.split('/').pop()));
                          if (fileMatch) {
                            onOpenCodeInEditor(fileMatch.id);
                          }
                        }}
                        onSavedToDisk={(fname) => onShowToast(`Saved ${fname} to disk!`)}
                      />
                    </div>
                  )}

                  {/* Modified Files Badge */}
                  {msg.modifiedFiles && msg.modifiedFiles.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {msg.modifiedFiles.map((mf, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#A8E6B0]/15 text-[#A8E6B0] border border-[#A8E6B0]/30 font-mono text-[10px] font-bold">
                          <Check className="w-3 h-3" />
                          {mf.action === 'created' ? 'Created' : 'Updated'}: {mf.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Follow-up Suggestion Chips */}
                  {isAi && msg.suggestedPrompts && msg.suggestedPrompts.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-white/10 flex flex-wrap gap-1.5">
                      {msg.suggestedPrompts.map((sug, i) => (
                        <button
                          key={i}
                          onClick={() => handleSendMessage(sug)}
                          className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-white/5 hover:bg-[#FFC93C] hover:text-[#0B120D] text-white/70 border border-white/15 transition-all cursor-pointer"
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isSending && (
            <div className="flex flex-col items-start">
              <div className="flex items-center gap-2 mb-1 text-[11px] font-mono text-[#FFC93C]">
                <span className="font-bold">⚡ Squeeze AI Co-Pilot</span>
              </div>
              <div className="bg-[#161B22] border border-white/10 text-[#FFFDF6]/80 rounded-2xl rounded-tl-sm p-4 text-xs font-mono flex items-center gap-2.5">
                <RefreshCw className="w-4 h-4 animate-spin text-[#FFC93C]" />
                <span>Searching Roblox skills, reading project files &amp; engineering Luau solution…</span>
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
                      // Shift + Enter: let browser insert newline/space
                      return;
                    } else {
                      // Plain Enter: submit prompt
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }
                }}
                placeholder={`Ask Squeeze anything about Roblox skills or "make X for me"…`}
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
                Press <kbd className="px-1 py-0.5 rounded bg-white/10 text-white/70">Enter</kbd> to send, <kbd className="px-1 py-0.5 rounded bg-white/10 text-white/70">Shift + Enter</kbd> for space
              </span>
              {inputText.includes('\n') && (
                <span className="text-[#FFC93C] font-semibold">
                  {inputText.split('\n').length} lines
                </span>
              )}
            </div>

            <button
              onClick={() => setIsSkillSearchOpen(true)}
              className="text-[#FFC93C] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3 h-3" />
              <span>Browse 10+ Roblox Skills</span>
            </button>
          </div>
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

