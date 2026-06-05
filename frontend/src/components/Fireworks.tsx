/**
 * @file Fireworks.tsx
 * CSS confetti burst shown when the user sets a new daily high score.
 * Pure CSS animation — no dependencies. Auto-dismisses after 3 seconds.
 */

import React, { useEffect, useState } from 'react';

interface Props {
  score: number;
  onDone: () => void;
}

const COLOURS = [
  '#f59e0b', '#10b981', '#3b82f6', '#ec4899',
  '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16',
];

const PARTICLE_COUNT = 60;

interface Particle {
  id: number;
  x: number;       // vw
  y: number;       // vh
  dx: number;      // horizontal drift
  dy: number;      // vertical drift
  size: number;
  colour: string;
  rotation: number;
  rotationSpeed: number;
  shape: 'rect' | 'circle';
  delay: number;
}

function makeParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    x: 30 + Math.random() * 40,          // start roughly centre-ish
    y: 20 + Math.random() * 30,
    dx: (Math.random() - 0.5) * 60,      // spread left/right
    dy: 20 + Math.random() * 60,         // fall down
    size: 6 + Math.random() * 8,
    colour: COLOURS[Math.floor(Math.random() * COLOURS.length)],
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 720,
    shape: Math.random() > 0.5 ? 'rect' : 'circle',
    delay: Math.random() * 0.4,
  }));
}

export function Fireworks({ score, onDone }: Props) {
  const [particles] = useState(makeParticles);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 400); // wait for fade-out
    }, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      aria-live="assertive"
      aria-label={`New personal best! ${score} tasks today!`}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9999,
        overflow: 'hidden',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.4s ease',
      }}
    >
      {/* Burst label */}
      <div
        style={{
          position: 'absolute',
          top: '22%',
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          animation: 'fw-pop 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards',
        }}
      >
        <div style={{ fontSize: '2.5rem', lineHeight: 1 }}>🏆</div>
        <div style={{
          fontSize: '1.1rem',
          fontWeight: 800,
          color: '#fff',
          textShadow: '0 2px 12px rgba(0,0,0,0.6)',
          marginTop: '0.25rem',
          whiteSpace: 'nowrap',
        }}>
          New High Score!
        </div>
        <div style={{
          fontSize: '2rem',
          fontWeight: 900,
          color: '#fbbf24',
          textShadow: '0 2px 12px rgba(0,0,0,0.5)',
          lineHeight: 1.2,
        }}>
          {score} ✨
        </div>
      </div>

      {/* Confetti particles */}
      {particles.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}vw`,
            top: `${p.y}vh`,
            width: p.shape === 'circle' ? p.size : p.size * 0.6,
            height: p.size,
            borderRadius: p.shape === 'circle' ? '50%' : '2px',
            backgroundColor: p.colour,
            animation: `fw-fall 2.5s ${p.delay}s ease-in forwards`,
            '--dx': `${p.dx}vw`,
            '--dy': `${p.dy}vh`,
            '--rot': `${p.rotationSpeed}deg`,
            transform: `rotate(${p.rotation}deg)`,
          } as React.CSSProperties}
        />
      ))}

      <style>{`
        @keyframes fw-fall {
          0%   { transform: rotate(var(--rot, 0deg)) translateX(0) translateY(0); opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: rotate(calc(var(--rot, 0deg) * 3)) translateX(var(--dx, 0)) translateY(var(--dy, 60vh)); opacity: 0; }
        }
        @keyframes fw-pop {
          0%   { transform: translateX(-50%) scale(0.3); opacity: 0; }
          100% { transform: translateX(-50%) scale(1);   opacity: 1; }
        }
      `}</style>
    </div>
  );
}
