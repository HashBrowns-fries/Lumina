import React from 'react';

function getBoldCharCount(word: string, fixation: number): number {
  const len = word.length;
  if (len <= 3) return 1;
  if (len <= 6) return Math.ceil(len * fixation);
  return Math.min(4, Math.ceil(len * fixation));
}

export function formatBionicWord(word: string, fixation: number): string {
  const boldCount = getBoldCharCount(word, fixation);
  const prefix = word.slice(0, boldCount);
  const suffix = word.slice(boldCount);
  return `<span style="font-weight: 700">${prefix}</span>${suffix}`;
}

export function renderBionicWord(
  word: string,
  fixation: number,
  className?: string,
  onClick?: () => void,
  onDoubleClick?: () => void
): React.ReactNode {
  const boldCount = getBoldCharCount(word, fixation);
  const prefix = word.slice(0, boldCount);
  const suffix = word.slice(boldCount);
  
  return (
    <span 
      className={className}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <span style={{ fontWeight: 700 }}>{prefix}</span>
      {suffix}{' '}
    </span>
  );
}

export function isWord(token: string): boolean {
  const trimmed = token.trim();
  if (!trimmed || trimmed.length < 2 || trimmed.length > 100) return false;
  return /^\p{L}+$/u.test(trimmed);
}
