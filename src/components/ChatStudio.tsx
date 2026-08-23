import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, RefreshCw, Cpu, MessageSquare, Plus, Trash2, ChevronDown, ChevronRight, CheckCircle2,
  FileCode, Play, AlertTriangle, Layers, Code2, Brain, Search, Copy, Check, Wand2, RotateCcw, Sliders, Sparkles, Power
} from 'lucide-react';
import { User, UserQuota } from '../types';
import { RobloxProject, ChatSession, ChatMessage, GeneratedFilePayload, ThinkingStep } from '../types/project';
import { MarkdownRenderer } from './MarkdownRenderer';
import { TypewriterText } from './TypewriterText';
import { LuauCodeViewer } from './LuauCodeViewer';
import { AgentMemoryModal } from './AgentMemoryModal';
import { safeFetchJson, getClientSideEmergencyResponse } from '../utils/api';
import { ExecutionEventItem, ExecutionEvent } from './ExecutionEventItem';
import { renderHighlightedText, getStepBadgeStyle } from '../utils/textHighlighter';
import { sound } from '../utils/audio';

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
  const [thinkingLevel, setThinkingLevel] = useState<'fast' | 'medium' | 'deep'>('medium');
  const [chatMode, setChatMode] = useState<'manual' | 'edit' | 'plan' | 'explain'>('manual');
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);
  const [previousInputText, setPreviousInputText] = useState<string | null>(null);
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);
  const [activeExecutionId, setActiveExecutionId] = useState<string | null>(null);
  const [activeExecutionEvents, setActiveExecutionEvents] = useState<ExecutionEvent[]>([]);
  const sseRef = useRef<EventSource | null>(null);
  const [dbStatus, setDbStatus] = useState<{
    hasAttemptedSync: boolean;
    hasErrors: boolean;
    errors: { table: string; code: string; message: string }[];
    isUsingLocalMode: boolean;
  } | null>(null);

  useEffect(() => {
    const fetchDbStatus = async () => {
      try {
        const res = await safeFetchJson('/api/db/status');
        if (res.ok && res.data?.success) {
          setDbStatus(res.data);
        }
      } catch (err) {
        console.error('Error fetching database status:', err);
      }
    };
    fetchDbStatus();
  }, []);

  const handleCancelExecution = async () => {
    if (!activeExecutionId) return;
    try {
      onShowToast('⏳ Sending cancellation signal to Squeeze...');
      await safeFetchJson(`/api/agent/executions/${activeExecutionId}/cancel`, {
        method: 'POST'
      });
      onShowToast('✓ Squeeze Agent stopped.');
    } catch (err) {
      console.error('Error cancelling execution:', err);
    } finally {
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
      setIsSending(false);
    }
  };

  const handleCopyMessage = (msgId: string, content: string) => {
    try {
      sound.click();
    } catch {}
    navigator.clipboard.writeText(content);
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const handleEnhancePrompt = async () => {
    if (!inputText.trim() || isEnhancingPrompt) return;
    setIsEnhancingPrompt(true);
    try {
      const token = localStorage.getItem('squeeze_token');
      const res = await safeFetchJson('/api/ai/enhance-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ prompt: inputText })
      });
      if (res.ok && res.data?.success && res.data?.enhancedPrompt) {
        setPreviousInputText(inputText);
        setInputText(res.data.enhancedPrompt);
        onShowToast('✨ Prompt enhanced by AI!');
      } else {
        onShowToast('Could not enhance prompt right now.');
      }
    } catch (err) {
      console.error('Enhance prompt error:', err);
      onShowToast('Failed to enhance prompt.');
    } finally {
      setIsEnhancingPrompt(false);
    }
  };

  const handleUndoEnhance = () => {
    if (previousInputText !== null) {
      setInputText(previousInputText);
      setPreviousInputText(null);
      onShowToast('Prompt reverted.');
    }
  };

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
        loadedSessions.forEach(s => fetchMessagesForConversation(s.id));
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
      const token = localStorage.getItem('squeeze_token');
      const res = await safeFetchJson(`/api/conversations/${convId}/messages`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
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
      const token = localStorage.getItem('squeeze_token');
      await safeFetchJson(`/api/conversations/${sessionId}`, { 
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
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

    const executionId = `exec_${Date.now()}`;
    setActiveExecutionId(executionId);
    setActiveExecutionEvents([]);

    let sse: EventSource | null = null;

    try {
      // Connect to Server-Sent Events execution event stream
      sse = new EventSource(`/api/agent/executions/${executionId}/stream`);
      sseRef.current = sse;
      sse.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'connected') return;
          setActiveExecutionEvents((prev) => {
            if (prev.some(e => e.type === data.type && e.message === data.message && e.timestamp === data.timestamp)) {
              return prev;
            }
            return [...prev, data];
          });
        } catch (err) {
          console.error('Error parsing execution event:', err);
        }
      };
      sse.onerror = () => {
        if (sse) sse.close();
      };

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
          executionId,
          thinkingLevel,
          mode: chatMode,
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
        isTyping: true,
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

      const realConvId = data.conversationId || activeSessionId;

      const finalSessions = sessions.map(s => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            id: realConvId,
            messages: [...currentMessages, aiMsg],
            updatedAt: Date.now()
          };
        }
        return s;
      });

      setSessions(finalSessions);
      if (realConvId !== activeSessionId) {
        setActiveSessionId(realConvId);
      }
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
      if (sse) {
        sse.close();
      }
      sseRef.current = null;
    }
  };

  const toggleCodeView = (msgId: string) => {
    setExpandedCodeForMsg(prev => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const mapThinkingStepToEvent = (step: any, index: number): ExecutionEvent => {
    if (step.type) {
      return step as ExecutionEvent;
    }
    
    const stageLower = (step.stage || '').toLowerCase();
    let type = 'Reasoning';
    if (stageLower.includes('read')) {
      type = 'Read';
    } else if (stageLower.includes('search') || stageLower.includes('grep')) {
      type = 'Search';
    } else if (stageLower.includes('edit') || stageLower.includes('implement')) {
      type = 'Edit';
    } else if (stageLower.includes('create')) {
      type = 'Create';
    } else if (stageLower.includes('verify') || stageLower.includes('review') || stageLower.includes('sync')) {
      type = 'Verification';
    } else if (stageLower.includes('complete') || stageLower.includes('success')) {
      type = 'Success';
    } else if (stageLower.includes('error')) {
      type = 'Error';
    } else if (stageLower.includes('intent') || stageLower.includes('plan')) {
      type = 'Plan';
    }
    
    return {
      type,
      timestamp: Date.now() - (10 - index) * 1000,
      message: step.details || step.stage || 'Thinking...',
      status: step.completed ? 'completed' : 'running',
      metadata: step.metadata || {},
      executionId: 'hist'
    };
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

        {/* Sessions & Projects Sidebar */}
        <div className="w-68 border-r border-white/10 flex flex-col bg-[#0B0F17]">
          <div className="p-3 border-b border-white/10 flex items-center justify-between gap-2">
            <button 
              onClick={handleCreateNewChat}
              className="flex-1 py-2 px-3 bg-[#FFC93C] text-[#0B120D] font-bold rounded-xl text-xs flex items-center justify-center gap-2 hover:bg-[#ffe082] transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              New Chat / Session
            </button>
            
            <button
              onClick={() => setIsMemoryModalOpen(true)}
              className="p-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-xl transition-all"
              title="Open Agent Persistent Memory Engine"
            >
              <Brain className="w-4 h-4 animate-pulse" />
            </button>
          </div>

          {/* Projects Section */}
          <div className="px-3 pt-3 pb-1 border-b border-white/5">
            <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-2 px-1">Active Roblox Project</div>
            <div className="bg-[#11161D] border border-white/10 rounded-xl p-2.5 flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-white truncate">{project.name}</div>
                <div className="text-[10px] font-mono text-white/50">{project.files.length} scripts loaded</div>
              </div>
            </div>
          </div>

          {/* Conversation Search Bar */}
          <div className="px-3 pt-3 pb-1">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-white/40 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search sessions..."
                value={chatSearchQuery}
                onChange={(e) => setChatSearchQuery(e.target.value)}
                className="w-full bg-[#11161D] border border-white/10 text-xs text-white rounded-xl pl-8 pr-3 py-1.5 focus:border-[#FFC93C] outline-none font-mono"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider px-2 py-1">Chat Sessions</div>
            {filteredSessions.map(s => (
              <div 
                key={s.id}
                onClick={() => {
                  setActiveSessionId(s.id);
                  fetchMessagesForConversation(s.id);
                }}
                className={`p-2.5 rounded-xl cursor-pointer text-xs flex justify-between items-center group transition-all ${
                  activeSessionId === s.id ? 'bg-white/10 text-white font-medium border-l-2 border-[#FFC93C]' : 'text-white/60 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <MessageSquare className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                  <span className="truncate">{s.name}</span>
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
        {dbStatus && (dbStatus.hasErrors || dbStatus.isUsingLocalMode) && (
          <div className="mx-6 mt-4 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-xs text-amber-200/90 font-sans flex items-start gap-3 shadow-md">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              {dbStatus.hasErrors ? (
                <>
                  <p className="font-bold text-amber-300 mb-1">⚠️ Database Schema Missing</p>
                  <p className="leading-relaxed">
                    Squeeze is connected to your Supabase project, but some required database tables are missing in your schema.
                    Please copy the contents of <code className="bg-[#0B120D] text-[#FFC93C] px-1 py-0.5 rounded border border-white/5 font-mono text-[11px]">supabase_schema.sql</code> and execute it in your <strong>Supabase SQL Editor</strong> to enable persistent chat history.
                  </p>
                  {dbStatus.errors && dbStatus.errors.length > 0 && (
                    <div className="mt-2 text-[11px] font-mono opacity-80 max-h-16 overflow-y-auto bg-[#0B120D] p-2 rounded-lg border border-white/5">
                      {dbStatus.errors.map((e, idx) => (
                        <div key={idx}>❌ Table &apos;{e.table}&apos;: {e.message}</div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="font-bold text-amber-300 mb-1">💡 Running in Local Database Mode</p>
                  <p className="leading-relaxed">
                    Squeeze is running in offline local JSON mode. Your chats are stored on this container but will be wiped when the server restarts or sleeps.
                    To enable durable, permanent cloud chat history across sessions, please configure <code className="bg-[#0B120D] text-[#FFC93C] px-1 py-0.5 rounded border border-white/5 font-mono text-[11px]">SUPABASE_URL</code> and <code className="bg-[#0B120D] text-[#FFC93C] px-1 py-0.5 rounded border border-white/5 font-mono text-[11px]">SUPABASE_SERVICE_ROLE_KEY</code> in your environment.
                  </p>
                </>
              )}
            </div>
          </div>
        )}
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
              <div key={msg.id} className={`flex flex-col group relative ${isAi ? 'items-start' : 'items-end'}`}>
                <div className={`flex items-center justify-between w-full max-w-[85%] mb-1.5 text-[11px] font-mono ${isAi ? 'text-[#FFC93C]' : 'text-[#79C0FF]'}`}>
                  <span className="font-bold">{isAi ? '⚡ Squeeze' : 'You'}</span>
                  
                  {/* Message Copy Button */}
                  <button
                    onClick={() => handleCopyMessage(msg.id, msg.content)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center gap-1 text-[10px] font-mono"
                    title="Copy clean message content"
                  >
                    {copiedMsgId === msg.id ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400 font-semibold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                
                <div className={`max-w-[85%] rounded-2xl p-5 text-sm leading-relaxed relative ${
                  isAi 
                    ? isError ? 'bg-red-500/10 border border-red-500/20 text-red-100 rounded-tl-sm' : 'bg-[#161B22] border border-white/10 text-white rounded-tl-sm'
                    : 'bg-[#FFC93C] text-[#0B120D] font-medium rounded-tr-sm'
                }`}>
                  {/* Thinking Steps / Execution Trace */}
                  {isAi && !isError && msg.thinkingSteps && (
                    <div className="mb-4 bg-[#0D1117] rounded-lg p-3.5 border border-white/10 font-mono text-[11px] space-y-2 shadow-inner">
                      <div className="text-white/40 uppercase tracking-wider font-bold mb-2 flex items-center justify-between">
                        <span>Execution Trace</span>
                        <span className="text-[10px] text-white/30">{msg.thinkingSteps.length} steps executed</span>
                      </div>
                      {msg.thinkingSteps.map((step: ThinkingStep, i: number) => {
                        const stepStyle = getStepBadgeStyle(step.stage || '');
                        const isCompleted = step.completed !== false;
                        return (
                          <div key={i} className="flex items-start gap-2.5 py-1 border-l-2 pl-2" style={{ borderColor: stepStyle.iconColor }}>
                            <div className="shrink-0 mt-0.5">
                              {isCompleted ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#3FB950]" />
                              ) : (
                                <RefreshCw className="w-3.5 h-3.5 text-[#D29922] animate-spin" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider border ${stepStyle.bg} ${stepStyle.text} ${stepStyle.border}`}>
                                  {step.stage || 'Processing'}
                                </span>
                              </div>
                              <div className="text-white/90 leading-relaxed text-[11px]">
                                {renderHighlightedText(step.details || '')}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {operations.length > 0 && (
                        <div className="mt-2.5 pt-2.5 border-t border-white/10 space-y-1">
                          {operations.map((op: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 text-white/80">
                              <Layers className="w-3.5 h-3.5 text-[#FFC93C]" />
                              <span className="font-mono text-[#BC8CFF]">{op.path}</span>
                              <span className="text-white/40">:</span>
                              <span className="text-[#3FB950] font-bold">{op.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {msg.isTyping ? (
                    <TypewriterText content={msg.content} theme={isAi ? 'dark' : 'light'} speed={15} />
                  ) : (
                    <MarkdownRenderer content={msg.content} theme={isAi ? 'dark' : 'light'} />
                  )}
                  
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
             <div className="flex flex-col items-start space-y-1 w-full">
               <div className="flex items-center gap-2 mb-1.5 text-[11px] font-mono text-[#FFC93C]">
                  <span className="font-bold">⚡ Squeeze is executing...</span>
               </div>
               <div className="bg-[#161B22] border border-[#FFC93C]/30 text-white rounded-2xl rounded-tl-sm p-5 text-sm w-[85%] shadow-xl">
                 <div className="mb-4 bg-[#0D1117] rounded-lg p-3.5 border border-white/10 font-mono text-[11px] space-y-2 shadow-inner">
                   <div className="text-white/40 uppercase tracking-wider font-bold mb-2 flex items-center justify-between">
                     <span className="flex items-center gap-1.5">
                       <span className="relative flex h-2 w-2">
                         <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FFC93C] opacity-75"></span>
                         <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FFC93C]"></span>
                       </span>
                       <span>Live Execution Trace</span>
                     </span>
                     
                     <button
                       onClick={handleCancelExecution}
                       className="px-2 py-0.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/30 rounded text-[10px] font-mono font-bold transition-all flex items-center gap-1 cursor-pointer"
                       title="Cancel Squeeze agent execution"
                     >
                       <Power className="w-3 h-3" />
                       <span>STOP AGENT</span>
                     </button>
                     <span className="text-[10px] text-white/30">{activeExecutionEvents.length} events</span>
                   </div>
                   {activeExecutionEvents.length === 0 && (
                     <div className="flex items-center gap-2 text-white/50">
                       <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                       <span>Initializing pipeline...</span>
                     </div>
                   )}
                   {activeExecutionEvents.map((step, i) => {
                     const stepStyle = getStepBadgeStyle(step.type || 'Processing');
                     const isCompleted = step.status === 'completed' || step.status === 'failed';
                     return (
                       <div key={i} className="flex items-start gap-2.5 py-1 border-l-2 pl-2" style={{ borderColor: stepStyle.iconColor }}>
                         <div className="shrink-0 mt-0.5">
                           {isCompleted ? (
                             <CheckCircle2 className="w-3.5 h-3.5 text-[#3FB950]" />
                           ) : (
                             <RefreshCw className="w-3.5 h-3.5 text-[#D29922] animate-spin" />
                           )}
                         </div>
                         <div className="flex-1">
                           <div className="flex items-center gap-2 mb-0.5">
                             <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider border ${stepStyle.bg} ${stepStyle.text} ${stepStyle.border}`}>
                               {step.type || 'Processing'}
                             </span>
                           </div>
                           <div className="text-white/90 leading-relaxed text-[11px]">
                             {renderHighlightedText(step.message || '')}
                           </div>
                         </div>
                       </div>
                     );
                   })}
                 </div>
               </div>
             </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-[#11161D] border-t border-white/10">
          <div className="max-w-4xl mx-auto mb-2.5 flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex flex-wrap items-center gap-3">
              {/* Mode Selector Dropdown */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-mono text-white/50 flex items-center gap-1">
                  <Sliders className="w-3.5 h-3.5 text-[#FFC93C]" />
                  Mode:
                </span>
                <select
                  value={chatMode}
                  onChange={(e) => setChatMode(e.target.value as any)}
                  className="bg-[#161B22] border border-white/15 text-[11px] font-mono text-emerald-300 font-semibold rounded-lg px-2.5 py-1 outline-none focus:border-[#FFC93C] cursor-pointer hover:border-white/30 transition-colors"
                >
                  <option value="manual">⚡ Manual / Build Mode (Default)</option>
                  <option value="edit">🛠️ Edit Mode (Modify Existing)</option>
                  <option value="plan">📐 Plan Mode (Design Only)</option>
                  <option value="explain">📖 Explain Mode (Explanation Only)</option>
                </select>
              </div>

              {/* Thinking Budget Dropdown */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-mono text-white/50 flex items-center gap-1">
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                  Thinking:
                </span>
                <select
                  value={thinkingLevel}
                  onChange={(e) => setThinkingLevel(e.target.value as any)}
                  className="bg-[#161B22] border border-white/15 text-[11px] font-mono text-cyan-300 rounded-lg px-2.5 py-1 outline-none focus:border-[#FFC93C] cursor-pointer hover:border-white/30 transition-colors"
                >
                  <option value="fast">⚡ Fast (Low)</option>
                  <option value="medium">🧠 Medium (Balanced)</option>
                  <option value="deep">🔬 Deep Reasoning (High)</option>
                </select>
              </div>
            </div>

            <div className="text-[10px] font-mono text-white/40">
              Roblox Studio Auto-Sync Active
            </div>
          </div>

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
              placeholder={
                chatMode === 'explain'
                  ? "Ask Squeeze to explain any concept or script..."
                  : chatMode === 'plan'
                    ? "Ask Squeeze to plan architecture or design system..."
                    : chatMode === 'edit'
                      ? "Describe changes to make to existing scripts..."
                      : "Tell Squeeze what to build in Studio..."
              }
              className="w-full bg-[#161B22] text-white border border-white/20 rounded-2xl py-4 pl-4 pr-28 focus:outline-none focus:border-[#FFC93C] transition-colors resize-none font-mono text-sm leading-relaxed min-h-[60px] max-h-[200px]"
              rows={1}
              style={{
                height: inputText ? `${Math.min(Math.max(inputText.split('\n').length * 24 + 32, 60), 200)}px` : '60px'
              }}
            />

            <div className="absolute right-3 bottom-3 flex items-center gap-1.5">
              {/* Undo Enhancement Button */}
              {previousInputText !== null && (
                <button
                  onClick={handleUndoEnhance}
                  className="p-2 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white rounded-xl transition-all cursor-pointer"
                  title="Undo prompt enhancement"
                >
                  <RotateCcw className="w-4 h-4 text-slate-300" />
                </button>
              )}

              {/* Enhance Prompt AI Button */}
              {inputText.trim().length > 0 && (
                <button
                  onClick={handleEnhancePrompt}
                  disabled={isEnhancingPrompt}
                  className={`p-2 rounded-xl transition-all flex items-center gap-1 ${
                    isEnhancingPrompt
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 cursor-wait'
                      : 'bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-400/40 cursor-pointer'
                  }`}
                  title="Enhance prompt with AI (✏️)"
                >
                  {isEnhancingPrompt ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-purple-300" />
                  ) : (
                    <Wand2 className="w-4 h-4 text-purple-300" />
                  )}
                </button>
              )}

              {/* Send Button */}
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim() || isSending}
                className="p-2 bg-[#FFC93C] text-[#0B120D] rounded-xl hover:bg-[#ffe082] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                title="Send Message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="text-center mt-2 text-[10px] font-mono text-white/30">
            Squeeze will automatically apply changes to Roblox Studio if connected.
          </div>
        </div>
      </div>
    </div>
  );
};
