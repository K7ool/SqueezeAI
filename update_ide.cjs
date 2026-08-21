const fs = require('fs');
let code = fs.readFileSync('src/components/SqueezeIDE.tsx', 'utf-8');

const popoverCode = `
          {/* Studio Connection Status Widget */}
          <div className="relative group">
            <button className={\`flex items-center gap-2 px-3 py-1.5 rounded border text-xs font-bold transition-all \${
              isConnected 
                ? 'bg-[#182618] border-[#3FB950]/30 text-[#3FB950]' 
                : 'bg-[#161B22] border-white/10 text-white/40'
            }\`}>
              {isConnected ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#3FB950] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#3FB950]"></span>
                  </span>
                  <span>Studio Connected</span>
                  <span className="text-[10px] opacity-60 ml-2 font-normal border-l border-[#3FB950]/30 pl-2">
                    {syncState?.pendingChangesCount || 0} pending
                  </span>
                </>
              ) : (
                <>
                  <Power className="w-3.5 h-3.5 opacity-50" />
                  <span>Studio Offline</span>
                </>
              )}
            </button>
            {/* Popover */}
            <div className="absolute top-full right-0 mt-2 w-56 bg-[#0D1117] border border-white/10 rounded-xl shadow-xl p-3 hidden group-hover:block z-50">
               <div className="text-xs font-bold mb-1">{isConnected ? 'Studio Connected' : 'Offline'}</div>
               <div className="text-[10px] text-white/50 mb-3 font-mono">
                 Project: {project.name}<br/>
                 Plugin: 3.0<br/>
                 Pending: {syncState?.pendingChangesCount || 0}
               </div>
               <div className="space-y-1">
                 <button className="w-full text-left px-2 py-1.5 rounded bg-white/5 hover:bg-white/10 text-xs font-mono transition-colors">Sync All</button>
                 <button onClick={handleDisconnect} className="w-full text-left px-2 py-1.5 rounded bg-white/5 hover:bg-[#FF7B72]/20 text-[#FF7B72] text-xs font-mono transition-colors">Disconnect</button>
               </div>
            </div>
          </div>
`;

code = code.replace(/\{\/\* Studio Connection Status Widget \*\/\}[\s\S]*?\n          \}\)/, popoverCode);
fs.writeFileSync('src/components/SqueezeIDE.tsx', code);
