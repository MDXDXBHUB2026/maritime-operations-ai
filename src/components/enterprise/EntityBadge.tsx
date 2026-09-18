import React from 'react';
import { Bot, User, Sparkles } from 'lucide-react';
import { EntityType } from '../../domain/enterprise';

interface EntityBadgeProps {
  type: EntityType;
  size?: 'sm' | 'md';
}

export const EntityBadge: React.FC<EntityBadgeProps> = ({ type, size = 'md' }) => {
  const isSm = size === 'sm';
  const padding = isSm ? '0.12rem 0.4rem' : '0.2rem 0.55rem';
  const fontSize = isSm ? '0.68rem' : '0.75rem';
  const iconSize = isSm ? 11 : 13;

  if (type === 'HUMAN') {
    return (
      <span
        className="entity-badge human"
        data-entity-type="HUMAN"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.3rem',
          padding,
          fontSize,
          fontWeight: 600,
          borderRadius: '4px',
          background: 'rgba(56, 189, 248, 0.12)',
          color: '#38bdf8',
          border: '1px solid rgba(56, 189, 248, 0.35)',
          whiteSpace: 'nowrap',
        }}
      >
        <User size={iconSize} />
        <span>HUMAN</span>
      </span>
    );
  }

  if (type === 'AI_ADVISOR') {
    return (
      <span
        className="entity-badge ai-advisor"
        data-entity-type="AI_ADVISOR"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.3rem',
          padding,
          fontSize,
          fontWeight: 600,
          borderRadius: '4px',
          background: 'rgba(192, 132, 252, 0.14)',
          color: '#c084fc',
          border: '1px solid rgba(192, 132, 252, 0.35)',
          whiteSpace: 'nowrap',
        }}
      >
        <Sparkles size={iconSize} />
        <span>AI ADVISOR</span>
      </span>
    );
  }

  return (
    <span
      className="entity-badge ai-agent"
      data-entity-type="AI_AGENT"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        padding,
        fontSize,
        fontWeight: 600,
        borderRadius: '4px',
        background: 'rgba(37, 194, 216, 0.14)',
        color: '#25c2d8',
        border: '1px solid rgba(37, 194, 216, 0.35)',
        whiteSpace: 'nowrap',
      }}
    >
      <Bot size={iconSize} />
      <span>AI AGENT</span>
    </span>
  );
};
