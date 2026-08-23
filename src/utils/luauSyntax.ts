export type TokenType = 
  | 'comment' 
  | 'string' 
  | 'keyword' 
  | 'builtin' 
  | 'function' 
  | 'type' 
  | 'number' 
  | 'operator' 
  | 'property' 
  | 'punctuation' 
  | 'text';

export interface Token {
  type: TokenType;
  text: string;
}

const KEYWORDS = new Set([
  'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function',
  'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return', 'then',
  'true', 'until', 'while', 'export', 'type', 'typeof', 'continue'
]);

const BUILTINS = new Set([
  'game', 'workspace', 'script', 'math', 'table', 'string', 'task', 'Enum',
  'Instance', 'Vector3', 'Vector2', 'CFrame', 'TweenInfo', 'Color3', 'ColorSequence',
  'NumberSequence', 'UDim', 'UDim2', 'RaycastParams', 'OverlapParams', 'PathfindingModifiers',
  'pcall', 'xpcall', 'ypcall', 'print', 'warn', 'error', 'assert', 'require',
  'pairs', 'ipairs', 'next', 'select', 'tostring', 'tonumber', 'tick', 'time',
  'os', 'utf8', 'debug', 'bit32', 'shared', '_G', '_VERSION', 'delay', 'spawn', 'wait'
]);

const ROBLOX_SERVICES = new Set([
  'Players', 'Workspace', 'ReplicatedStorage', 'ServerScriptService', 'ServerStorage',
  'StarterPlayer', 'StarterGui', 'StarterPack', 'Lighting', 'SoundService',
  'TweenService', 'DataStoreService', 'MarketplaceService', 'UserInputService',
  'ContextActionService', 'RunService', 'HttpService', 'TeleportService',
  'PhysicsService', 'CollectionService', 'Debris', 'Chat', 'TextChatService',
  'ProximityPromptService', 'PathfindingService', 'BadgeService', 'GroupService'
]);

const TYPES = new Set([
  'any', 'boolean', 'buffer', 'number', 'string', 'thread', 'vector', 'nil',
  'Player', 'Character', 'Humanoid', 'BasePart', 'Part', 'Model', 'Folder',
  'RemoteEvent', 'RemoteFunction', 'BindableEvent', 'BindableFunction',
  'Tool', 'ProximityPrompt', 'Sound', 'Animation', 'AnimationTrack',
  'ScreenGui', 'Frame', 'TextLabel', 'TextButton', 'ImageLabel', 'ImageButton',
  'ScrollingFrame', 'UIListLayout', 'UIGridLayout', 'UICorner', 'UIStroke'
]);

export function tokenizeLuauLine(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = line.length;

  while (i < len) {
    // 1. Comments
    if (line[i] === '-' && line[i + 1] === '-') {
      // Check block comment --[[
      if (line.slice(i, i + 4) === '--[[') {
        tokens.push({ type: 'comment', text: line.slice(i) });
        break;
      }
      tokens.push({ type: 'comment', text: line.slice(i) });
      break;
    }

    // 2. Strings
    if (line[i] === '"' || line[i] === "'") {
      const quote = line[i];
      let str = quote;
      i++;
      let escaped = false;
      while (i < len) {
        const char = line[i];
        str += char;
        if (escaped) {
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === quote) {
          i++;
          break;
        }
        i++;
      }
      tokens.push({ type: 'string', text: str });
      continue;
    }

    // 3. Multi-line / raw string [[ ... ]] on single line
    if (line[i] === '[' && line[i + 1] === '[') {
      let str = '[[';
      i += 2;
      while (i < len) {
        if (line[i] === ']' && line[i + 1] === ']') {
          str += ']]';
          i += 2;
          break;
        }
        str += line[i];
        i++;
      }
      tokens.push({ type: 'string', text: str });
      continue;
    }

    // 4. Numbers
    if (/\d/.test(line[i]) || (line[i] === '.' && /\d/.test(line[i + 1] || ''))) {
      let num = '';
      if (line[i] === '0' && (line[i + 1] === 'x' || line[i + 1] === 'X')) {
        num += line.slice(i, i + 2);
        i += 2;
        while (i < len && /[0-9a-fA-F_]/.test(line[i])) {
          num += line[i];
          i++;
        }
      } else {
        while (i < len && /[\d._eE+-]/.test(line[i])) {
          num += line[i];
          i++;
        }
      }
      tokens.push({ type: 'number', text: num });
      continue;
    }

    // 5. Identifiers (keywords, builtins, function calls, variables, types)
    if (/[a-zA-Z_]/.test(line[i])) {
      let ident = '';
      while (i < len && /[a-zA-Z0-9_]/.test(line[i])) {
        ident += line[i];
        i++;
      }

      // Check preceding char for method/property access
      const prevNonWhitespaceIndex = findPrevNonWhitespace(tokens);
      const isColonCall = prevNonWhitespaceIndex !== -1 && tokens[prevNonWhitespaceIndex]?.text === ':';
      const isDotCall = prevNonWhitespaceIndex !== -1 && tokens[prevNonWhitespaceIndex]?.text === '.';
      const isTypeAnnotation = prevNonWhitespaceIndex !== -1 && (tokens[prevNonWhitespaceIndex]?.text === '::' || tokens[prevNonWhitespaceIndex]?.text === ':');

      // Check following char for function call
      let j = i;
      while (j < len && (line[j] === ' ' || line[j] === '\t')) j++;
      const isFunctionCall = j < len && line[j] === '(';

      if (KEYWORDS.has(ident)) {
        tokens.push({ type: 'keyword', text: ident });
      } else if (BUILTINS.has(ident) || ROBLOX_SERVICES.has(ident)) {
        tokens.push({ type: 'builtin', text: ident });
      } else if (TYPES.has(ident) || isTypeAnnotation) {
        tokens.push({ type: 'type', text: ident });
      } else if (isColonCall || isFunctionCall) {
        tokens.push({ type: 'function', text: ident });
      } else if (isDotCall) {
        tokens.push({ type: 'property', text: ident });
      } else {
        tokens.push({ type: 'text', text: ident });
      }
      continue;
    }

    // 6. Operators & Punctuation
    const twoChars = line.slice(i, i + 2);
    if (['==', '~=', '<=', '>=', '..', '::', '+=', '-=', '*=', '/=', '^=', '%=', '//'].includes(twoChars)) {
      tokens.push({ type: 'operator', text: twoChars });
      i += 2;
      continue;
    }

    if (['+', '-', '*', '/', '%', '^', '#', '=', '<', '>'].includes(line[i])) {
      tokens.push({ type: 'operator', text: line[i] });
      i++;
      continue;
    }

    if (['(', ')', '{', '}', '[', ']', ';', ':', ',', '.'].includes(line[i])) {
      tokens.push({ type: 'punctuation', text: line[i] });
      i++;
      continue;
    }

    // 7. Whitespace and other characters
    tokens.push({ type: 'text', text: line[i] });
    i++;
  }

  return tokens;
}

function findPrevNonWhitespace(tokens: Token[]): number {
  for (let idx = tokens.length - 1; idx >= 0; idx--) {
    if (tokens[idx].text.trim().length > 0) {
      return idx;
    }
  }
  return -1;
}

export function tokenizeLuauScript(code: string): Token[][] {
  const lines = code.split('\n');
  return lines.map(line => tokenizeLuauLine(line));
}
