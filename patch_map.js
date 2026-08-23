const fs = require('fs');
let code = fs.readFileSync('src/components/InteractiveGameMap.tsx', 'utf8');

// 1. Add isStudioConnected to Props
code = code.replace(/isStudioConnected,\n/g, 'isStudioConnected = true,\n');

// 2. Change the Node rendering
const oldNodeRender = `<div
                  key={node.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNodeId(node.id);
                  }}
                  className={\`node-element absolute pointer-events-auto cursor-pointer transition-all duration-200 \${
                    isCore 
                      ? 'w-48 h-48 rounded-full flex flex-col items-center justify-center text-center p-4 shadow-2xl border-2'
                      : 'w-56 rounded-xl p-3.5 shadow-xl border'
                  }\`}
                  style={{
                    transform: \`translate(\${node.x || 0}px, \${node.y || 0}px)\`,
                    backgroundColor: isCore ? '#0D131A' : '#0F161E',
                    borderColor: isSelected ? '#FFC93C' : isCore ? '#FFC93C88' : \`\${color}55\`,
                    boxShadow: isSelected ? \`0 0 25px \${color}44\` : '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                  }}
                >
                  {/* Header & Status Indicator */}
                  <div className="flex items-center justify-between w-full mb-1">
                    <span 
                      className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider font-bold"
                      style={{ backgroundColor: \`\${color}22\`, color }}
                    >
                      {node.category}
                    </span>
                    <span className={\`w-2 h-2 rounded-full \${
                      node.status === 'error' ? 'bg-rose-500 animate-ping' : node.status === 'warning' ? 'bg-amber-400' : 'bg-emerald-400'
                    }\`} />
                  </div>

                  {/* Title */}
                  <div className={\`font-semibold text-gray-100 line-clamp-1 \${isCore ? 'text-sm' : 'text-xs'}\`}>
                    {node.name}
                  </div>

                  {/* Files & Description */}
                  <p className="text-[11px] text-gray-400 line-clamp-2 mt-1 leading-snug">
                    {node.description}
                  </p>

                  {/* Footer Meta */}
                  {!isCore && (
                    <div className="mt-2.5 pt-2 border-t border-gray-800/80 flex items-center justify-between text-[10px] text-gray-500 font-mono">
                      <span>{node.filePaths?.length || 0} Files</span>
                      <span className="flex items-center gap-1 text-amber-400 group-hover:underline">
                        Inspect <ChevronRight className="w-2.5 h-2.5" />
                      </span>
                    </div>
                  )}
                </div>`;

const newNodeRender = `<div
                  key={node.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isStudioConnected) {
                      onShowToast("Connect the Roblox Studio plugin to Interact with nodes");
                      return;
                    }
                    setSelectedNodeId(node.id);
                  }}
                  className={\`node-element absolute pointer-events-auto cursor-pointer transition-all duration-200 group \${
                    isCore 
                      ? 'w-48 h-48 rounded-full flex flex-col items-center justify-center text-center p-4 shadow-2xl border-4'
                      : 'w-40 h-40 rounded-full flex flex-col items-center justify-center text-center p-3 shadow-xl border-2'
                  }\`}
                  style={{
                    transform: \`translate(\${node.x || 0}px, \${node.y || 0}px)\`,
                    backgroundColor: isCore ? '#0D131A' : '#0F161E',
                    borderColor: isSelected ? '#FFC93C' : isCore ? '#FFC93C88' : \`\${color}88\`,
                    boxShadow: isSelected ? \`0 0 35px \${color}66\` : '0 15px 35px -5px rgba(0, 0, 0, 0.6)',
                  }}
                >
                  {!isStudioConnected && (
                    <div className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center z-10 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity">
                      <AlertTriangle className="w-6 h-6 text-amber-400 mb-1" />
                      <span className="text-[9px] font-bold text-center px-4 leading-tight text-amber-400">Connect the Roblox Studio plugin to Interact</span>
                    </div>
                  )}
                  {/* Badge */}
                  <div className="absolute -top-1 -right-1 bg-[#161B22] border border-gray-700 rounded-full flex items-center justify-center p-1 shadow-lg z-20">
                     {node.status === 'healthy' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-amber-400" />}
                     <span className="ml-1 text-[10px] font-bold text-white px-1">+{node.filePaths?.length || 0}</span>
                  </div>
                  
                  {/* Tooltip on hover */}
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-[#161B22] border border-gray-700 text-gray-200 px-3 py-1 rounded text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-30 pointer-events-none shadow-xl">
                    {node.name} ({node.status})
                  </div>

                  {/* Header & Status Indicator */}
                  <div className="flex items-center justify-center w-full mb-1">
                    <span 
                      className="px-2 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-wider font-bold"
                      style={{ backgroundColor: \`\${color}22\`, color }}
                    >
                      {node.category}
                    </span>
                  </div>

                  {/* Title */}
                  <div className={\`font-semibold text-gray-100 line-clamp-2 px-2 \${isCore ? 'text-sm' : 'text-xs'}\`}>
                    {node.name}
                  </div>
                </div>`;

code = code.replace(oldNodeRender, newNodeRender);
fs.writeFileSync('src/components/InteractiveGameMap.tsx', code);
