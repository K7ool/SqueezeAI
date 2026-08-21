import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, RefreshCw, Cpu, MessageSquare, Plus, Trash2, ChevronDown, ChevronRight, CheckCircle2,
  FileCode, Play, AlertTriangle, Layers, Code2, Brain, Search
} from 'lucide-react';
import { User, UserQuota } from '../types';
import { RobloxProject, ChatSession, ChatMessage, GeneratedFilePayload, ThinkingStep } from '../types/project';
import { MarkdownRenderer } from './MarkdownRenderer';
import { LuauCodeViewer } from './LuauCodeViewer';
import { AgentMemoryModal } from './AgentMemoryModal';
import { safeFetchJson, getClientSideEmergencyResponse } from '../utils/api';

interface ChatStudioProps {
  user: User | null;
  quota: UserQuota | null;
  project: RobloxProject;
  onSelectScript: (script: any) => void;
  onUpdateProject: (upd: RobloxProject) => void;
  onOpenFileInEditor: (fileId: string) => void;
  pendingAgentPrompt?: string;
  onShowToast: (msg: string) => void;
}

export const ChatStudio: React.FC<ChatStudioProps> = ({
  user,
  quota,
  project,
  onUpdateProject,
  onOpenFileInEditor,
  pendingAgentPrompt,
  onShowToast
}) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [expandedCodeForMsg, setExpandedCodeForMsg] = useState<Record<string, boolean>>({});
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, isSending, expandedCodeForMsg]);

  useEffect(() => {
    loadConversationsFromBackend();
  }, [project.id]);

  const loadConversationsFromBackend = async () => {
    try {
      const token = localStorage.getItem('squeeze_token');
      const res = await safeFetchJson(`/api/conversations?projectId=${project.id}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      if (res.ok && res.data?.success && Array.isArray(res.data.conversations) && res.data.conversations.length > 0) {
        const loadedSessions: ChatSession[] = res.data.conversations.map((c: any) => ({
          id: c.id,
          name: c.title,
          createdAt: new Date(c.createdAt).getTime(),
          updatedAt: new Date(c.updatedAt).getTime(),
          messages: []
        }));

        setSessions(loadedSessions);
        const targetId = loadedSessions[0].id;
        setActiveSessionId(targetId);
        fetchMessagesForConversation(targetId);
        return;
      }
    } catch (err) {
      console.warn("Backend conversation fetch offline, falling back to local storage:", err);
    }

    const saved = localStorage.getItem(`squeeze_chat_sessions_${project.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) {
          setSessions(parsed);
          setActiveSessionId(parsed[0].id);
          return;
        }
      } catch (e) {}
    }
    handleCreateNewChat();
  };

  const fetchMessagesForConversation = async (convId: string) => {
    try {
      const res = await safeFetchJson(`/api/conversations/${convId}/messages`);
      if (res.ok && res.data?.success && Array.isArray(res.data.messages) && res.data.messages.length > 0) {
        const msgs: ChatMessage[] = res.data.messages.map((m: any) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          timestamp: new Date(m.timestamp).getTime(),
          thinkingSteps: m.thinkingSteps,
          changePlan: m.changePlan,
          codeReview: m.codeReview,
          actionPerformed: m.actionPerformed,
          filesGenerated: m.filesGenerated,
          suggestedPrompts: m.suggestedPrompts
        }));

        setSessions(prev => prev.map(s => s.id === convId ? { ...s, messages: msgs } : s));
      }
    } catch (err) {
      console.warn("Failed to fetch messages for conversation:", err);
    }
  };

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];

  const saveChatSessionsToStorage = (updated: ChatSession[]) => {
    localStorage.setItem(`squeeze_chat_sessions_${project.id}`, JSON.stringify(updated));
  };

  const handleCreateNewChat = async () => {
    try {
      const token = localStorage.getItem('squeeze_token');
      const res = await safeFetchJson('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          title: 'New Roblox System',
          projectId: project.id
        })
      });

      if (res.ok && res.data?.success && res.data.conversation) {
        const newConv = res.data.conversation;
        const newSession: ChatSession = {
          id: newConv.id,
          name: newConv.title,
          createdAt: new Date(newConv.createdAt).getTime(),
          updatedAt: new Date(newConv.updatedAt).getTime(),
          messages: [
            {
              id: `welcome-${Date.now()}`,
              role: 'assistant',
              content: `Hey! I'm **Squeeze**, your Elite Roblox Luau Engineer & Architect. I have full visibility over your project (**${project.name}**) with **${project.files.length} scripts** loaded.\n\nTell me what you want to build, and I will execute it directly in Studio.`,
              timestamp: Date.now()
            }
          ]
        };
        const updated = [newSession, ...sessions];
        setSessions(updated);
        setActiveSessionId(newSession.id);
        saveChatSessionsToStorage(updated);
        return;
      }
    } catch (err) {
      console.warn("Offline conversation creation fallback:", err);
    }

    const newSession: ChatSession = {
      id: `chat-${Date.now()}`,
      name: 'New Conversation',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [
        {
          id: `welcome-${Date.now()}`,
          role: 'assistant',
          content: `Hey! I'm **Squeeze**, your Elite Roblox Luau Engineer & Architect. I have full visibility over your project (**${project.name}**) with **${project.files.length} scripts** loaded.\n\nTell me what you want to build, and I will execute it directly in Studio.`,
          timestamp: Date.now()
        }
      ]
    };
    const updated = [newSession, ...sessions];
    setSessions(updated);
    setActiveSessionId(newSession.id);
    saveChatSessionsToStorage(updated);
  };

  const handleDeleteChat = async (sessionId: string, e: React.MouseEvent) => {
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

    try {
      await safeFetchJson(`/api/conversations/${sessionId}`, { method: 'DELETE' });
    } catch (err) {}

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
    
    // Auto title
    const existingUserMessages = (activeSession?.messages || []).filter(m => m.role === 'user');
    let derivedTitle = activeSession?.name;
    if (existingUserMessages.length === 0) {
      const cleaned = promptToSend.replace(/\s+/g, ' ').trim();
      derivedTitle = cleaned.length > 30 ? cleaned.slice(0, 27) + '...' : cleaned;
    }

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
      const projectContext = `Current Roblox Project: "${project.name}"\nTotal Scripts: ${project.files.length}`;
      const token = localStorage.getItem('squeeze_token');

      const apiResult = await safeFetchJson('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          conversationId: activeSessionId,
          projectId: project.id,
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
        if (data.success === false && data.error) {
          throw new Error(data.error.message || data.error);
        }
      } else {
        throw new Error('API failed to respond or offline.');
      }

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.message || "Execution completed.",
        timestamp: Date.now(),
        thinkingSteps: data.thinkingSteps,
        actionPerformed: data.actionPerformed,
        filesGenerated: data.filesGenerated,
        generatedScript: data.generatedScript,
        suggestedPrompts: data.suggestedPrompts,
        modifiedFiles: data.operationResults ? data.operationResults.map((op: any) => ({
           path: op.operation,
           name: op.result?.success ? 'Success' : 'Failed',
           action: 'updated' as const
        })) : undefined
      };

      const finalSessions = sessions.map(s => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            messages: [...currentMessages, aiMsg],
            updatedAt: Date.now()
          };
        }
        return s;
      });

      setSessions(finalSessions);
      saveChatSessionsToStorage(finalSessions);
      
      if (data.studioSyncResult && data.studioSyncResult.success) {
         onShowToast('✓ Changes synced to Studio');
      }

    } catch (err: any) {
      console.error(err);
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `❌ **Execution Failed**\n\n${err.message}`,
        timestamp: Date.now()
      };
      
      const finalSessions = sessions.map(s => {
        if (s.id === activeSessionId) {
          return { ...s, messages: [...currentMessages, errorMsg], updatedAt: Date.now() };
        }
        return s;
      });
      setSessions(finalSessions);
      saveChatSessionsToStorage(finalSessions);
      onShowToast(`❌ ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const toggleCodeView = (msgId: string) => {
    setExpandedCodeForMsg(prev => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const filteredSessions = sessions.filter(s => 
    !chatSearchQuery.trim() || s.name.toLowerCase().includes(chatSearchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full w-full bg-[#0B120D] text-white">
      {/* Agent Memory Manager Modal */}
      <AgentMemoryModal
        isOpen={isMemoryModalOpen}
        onClose={() => setIsMemoryModalOpen(false)}
        projectId={project.id}
        projectName={project.name}
        onShowToast={onShowToast}
      />

      {/* Sessions Sidebar */}
      <div className="w-64 border-r border-white/10 flex flex-col bg-[#0D1117]">
        <div className="p-3 border-b border-white/10 flex items-center justify-between gap-2">
          <button 
            onClick={handleCreateNewChat}
            className="flex-1 py-1.5 px-3 bg-[#FFC93C] text-[#0B120D] font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 hover:bg-[#ffe082] transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Session
          </button>
          
          <button
            onClick={() => setIsMemoryModalOpen(true)}
            className="p-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-xl transition-all"
            title="Open Agent Persistent Memory Engine"
          >
            <Brain className="w-4 h-4 animate-pulse" />
          </button>
        </div>

        {/* Conversation Search Bar */}
        <div className="px-3 pt-2 pb-1">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search chats..."
              value={chatSearchQuery}
              onChange={(e) => setChatSearchQuery(e.target.value)}
              className="w-full bg-[#080d1a] border border-slate-800 text-xs text-white rounded-lg pl-8 pr-2 py-1 focus:border-cyan-400 outline-none font-mono"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredSessions.map(s => (
            <div 
              key={s.id}
              onClick={() => {
                setActiveSessionId(s.id);
                fetchMessagesForConversation(s.id);
              }}
              className={`p-3 rounded-xl cursor-pointer text-sm flex justify-between items-center group transition-all ${
                activeSessionId === s.id ? 'bg-white/10 text-white font-medium border-l-2 border-[#FFC93C]' : 'text-white/60 hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <MessageSquare className="w-4 h-4 shrink-0 opacity-50 text-cyan-400" />
                <span className="truncate text-xs">{s.name}</span>
              </div>
              <button 
                onClick={(e) => handleDeleteChat(s.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col relative bg-[#11161D]">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeSession?.messages.map((msg, index) => {
            const isAi = msg.role === 'assistant';
            const isError = msg.content.includes('❌');
            
            // Collect files generated or modified
            const displayFiles: GeneratedFilePayload[] = [];
            if (msg.filesGenerated) displayFiles.push(...msg.filesGenerated);
            if (msg.generatedScript) displayFiles.push(msg.generatedScript);
            const hasFiles = displayFiles.length > 0;
            const isCodeExpanded = expandedCodeForMsg[msg.id];
            
            // Collect operations
            const operations = msg.modifiedFiles || [];

            return (
              <div key={msg.id} className={`flex flex-col ${isAi ? 'items-start' : 'items-end'}`}>
                <div className={`flex items-center gap-2 mb-1.5 text-[11px] font-mono ${isAi ? 'text-[#FFC93C]' : 'text-[#79C0FF]'}`}>
                  <span className="font-bold">{isAi ? '⚡ Squeeze' : 'You'}</span>
                </div>
                
                <div className={`max-w-[85%] rounded-2xl p-5 text-sm leading-relaxed ${
                  isAi 
                    ? isError ? 'bg-red-500/10 border border-red-500/20 text-red-100 rounded-tl-sm' : 'bg-[#161B22] border border-white/10 text-white rounded-tl-sm'
                    : 'bg-[#FFC93C] text-[#0B120D] font-medium rounded-tr-sm'
                }`}>
                  {/* Thinking Steps / Execution Trace */}
                  {isAi && !isError && msg.thinkingSteps && (
                    <div className="mb-4 bg-[#0D1117] rounded-lg p-3 border border-white/5 font-mono text-[11px] space-y-1.5">
                      <div className="text-white/40 uppercase tracking-wider font-bold mb-2">Execution Trace</div>
                      {msg.thinkingSteps.map((step: ThinkingStep, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-white/70">
                          {step.completed ? <CheckCircle2 className="w-3.5 h-3.5 text-[#3FB950] shrink-0 mt-0.5" /> : <ChevronRight className="w-3.5 h-3.5 text-white/30 shrink-0 mt-0.5" />}
                          <div>
                            <span className="font-bold">{step.stage}</span>
                            <span className="mx-2 opacity-30">|</span>
                            <span>{step.details}</span>
                          </div>
                        </div>
                      ))}
                      {operations.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-white/5 space-y-1">
                          {operations.map((op: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 text-white/70">
                              <Layers className="w-3.5 h-3.5 text-[#FFC93C]" />
                              <span>{op.path}: {op.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <MarkdownRenderer content={msg.content} theme={isAi ? 'dark' : 'light'} />
                  
                  {/* Summary & View Changes Button instead of huge code block */}
                  {isAi && hasFiles && !isError && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-[#3FB950] font-mono text-xs font-bold">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{displayFiles.length} files generated & synced</span>
                        </div>
                        <button 
                          onClick={() => toggleCodeView(msg.id)}
                          className="px-3 py-1.5 bg-white/10 hover:bg-white/15 rounded-lg text-xs font-mono flex items-center gap-2 transition-colors"
                        >
                          <Code2 className="w-3.5 h-3.5" />
                          {isCodeExpanded ? 'Hide Code' : 'View Changes'}
                        </button>
                      </div>
                      
                      {isCodeExpanded && (
                        <div className="space-y-4 mt-3 animate-fadeIn">
                          {displayFiles.map((f, idx) => (
                            <div key={idx} className="border border-white/10 rounded-xl overflow-hidden">
                              <div className="bg-[#0D1117] px-4 py-2 border-b border-white/10 flex justify-between items-center text-xs font-mono">
                                <span>{f.filePath || f.title}</span>
                                <span className="text-white/40">{f.scriptType}</span>
                              </div>
                              <LuauCodeViewer code={f.code} filename={f.filePath || f.title} theme="dark" maxHeight="300px" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          
          {/* Active Sending State */}
          {isSending && (
             <div className="flex flex-col items-start space-y-1">
               <div className="flex items-center gap-2 mb-1.5 text-[11px] font-mono text-[#FFC93C]">
                  <span className="font-bold">⚡ Squeeze is executing...</span>
               </div>
               <div className="bg-[#161B22] border border-[#FFC93C]/30 text-white rounded-2xl rounded-tl-sm p-4 text-sm w-64 shadow-xl">
                 <div className="flex items-center gap-3">
                    <RefreshCw className="w-4 h-4 text-[#FFC93C] animate-spin" />
                    <span className="font-mono text-xs">Processing intent & Studio queue...</span>
                 </div>
               </div>
             </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-[#11161D] border-t border-white/10">
          <div className="max-w-4xl mx-auto relative flex items-end">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Tell Squeeze what to build in Studio..."
              className="w-full bg-[#161B22] text-white border border-white/20 rounded-2xl py-4 pl-4 pr-14 focus:outline-none focus:border-[#FFC93C] transition-colors resize-none font-mono text-sm leading-relaxed min-h-[60px] max-h-[200px]"
              rows={1}
              style={{
                
                height: inputText ? `${Math.min(Math.max(inputText.split('\n').length * 24 + 32, 60), 200)}px` : '60px'
              }}
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim() || isSending}
              className="absolute right-3 bottom-3 p-2 bg-[#FFC93C] text-[#0B120D] rounded-xl hover:bg-[#ffe082] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="text-center mt-2 text-[10px] font-mono text-white/30">
            Squeeze will automatically apply changes to Roblox Studio if connected.
          </div>
        </div>
      </div>
    </div>
  );
};
