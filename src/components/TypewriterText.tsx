import React, { useState, useEffect } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface TypewriterTextProps {
  content: string;
  theme?: 'dark' | 'light';
  speed?: number;
  isNew?: boolean;
}

export const TypewriterText: React.FC<TypewriterTextProps> = ({ content, theme = 'dark', speed = 12, isNew = true }) => {
  const [displayedContent, setDisplayedContent] = useState(isNew ? '' : content);
  const [isTyping, setIsTyping] = useState(isNew);

  useEffect(() => {
    if (!isNew) {
      setDisplayedContent(content);
      setIsTyping(false);
      return;
    }

    let wordIdx = 0;
    const words = content.split(' ');
    setDisplayedContent('');
    setIsTyping(true);

    const interval = setInterval(() => {
      wordIdx += 2; // Stream 2 words per tick for smooth streaming effect
      if (wordIdx <= words.length) {
        setDisplayedContent(words.slice(0, wordIdx).join(' '));
      } else {
        setDisplayedContent(content);
        setIsTyping(false);
        clearInterval(interval);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [content, isNew, speed]);

  return (
    <div className={`relative ${isTyping ? 'typewriter-active' : ''}`}>
      <MarkdownRenderer content={displayedContent} theme={theme} />
      {isTyping && (
        <span className="inline-block w-2 h-4 bg-[#FFC93C] ml-1 animate-pulse align-middle" />
      )}
    </div>
  );
};
