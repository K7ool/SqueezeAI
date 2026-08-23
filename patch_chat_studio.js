const fs = require('fs');
let code = fs.readFileSync('src/components/ChatStudio.tsx', 'utf8');

const isSendingReplacement = `          {/* Active Sending State */}
          {isSending && (
             <div className="flex flex-col items-start space-y-1 w-full">
               <div className="flex items-center gap-2 mb-1.5 text-[11px] font-mono text-[#FFC93C]">
                  <span className="font-bold">⚡ Squeeze is executing...</span>
               </div>
               <div className="bg-[#161B22] border border-[#FFC93C]/30 text-white rounded-2xl rounded-tl-sm p-5 text-sm w-[85%] shadow-xl">
                 <div className="mb-4 bg-[#0D1117] rounded-lg p-3.5 border border-white/10 font-mono text-[11px] space-y-2 shadow-inner">
                   <div className="text-white/40 uppercase tracking-wider font-bold mb-2 flex items-center justify-between">
                     <span>Live Execution Trace</span>
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
                             <span className={\`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider border \${stepStyle.bg} \${stepStyle.text} \${stepStyle.border}\`}>
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
          )}`;

code = code.replace(/\{\/\* Active Sending State \*\/\}[\s\S]*?isSending && \([\s\S]*?<\/[dD]iv>\n\s*\)\}/, isSendingReplacement);
fs.writeFileSync('src/components/ChatStudio.tsx', code);
