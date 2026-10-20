import React, { useState } from 'react';

interface ClickToCopyProps {
  text: string;
  label?: string;
  className?: string;
  title?: string;
  showIcon?: boolean;
  style?: React.CSSProperties;
}

export const ClickToCopy: React.FC<ClickToCopyProps> = ({
  text,
  label,
  className = 'tag',
  title = 'Click to copy',
  showIcon = true,
  style,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for non-https or older environments
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // Ignore copy error
    }
  };

  const displayText = label !== undefined ? label : text;

  return (
    <span
      className={`copyable-badge ${className} ${copied ? 'copied' : ''}`}
      onClick={handleCopy}
      style={style}
      title={copied ? 'Copied to clipboard!' : `${title} (${text})`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleCopy(e as any);
        }
      }}
    >
      <span>{copied ? 'Copied!' : displayText}</span>
      {showIcon && !copied && (
        <svg
          className="copy-icon"
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
      {copied && (
        <svg
          className="copy-check"
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </span>
  );
};
