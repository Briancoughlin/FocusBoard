import React from 'react';
import type { Source } from '../types';

const config: Record<Source, { label: string; bg: string; text: string }> = {
  jira: { label: 'Jira', bg: 'bg-blue-100', text: 'text-blue-700' },
  gmail: { label: 'Gmail', bg: 'bg-red-100', text: 'text-red-700' },
  calendar: { label: 'Calendar', bg: 'bg-green-100', text: 'text-green-700' },
  slack: { label: 'Slack', bg: 'bg-purple-100', text: 'text-purple-700' },
  paste:   { label: 'Notes',  bg: 'bg-violet-100', text: 'text-violet-700' },
  github:  { label: 'GitHub', bg: 'bg-gray-100',   text: 'text-gray-700' },
};

interface Props {
  source: Source;
}

export function SourceBadge({ source }: Props) {
  const { label, bg, text } = config[source];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${bg} ${text}`}
      role="img"
      aria-label={`Source: ${label}`}
    >
      {label}
    </span>
  );
}
