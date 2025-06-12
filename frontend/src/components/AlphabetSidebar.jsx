import React from 'react';

const letters = [
  '#',
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
];

const sidebarStyle = {
  width: 40,
  background: '#23272b',
  color: '#fff',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  borderLeft: '1px solid #222',
  userSelect: 'none',
  height: '100%',
  position: 'relative',
};

const letterStyle = (active) => ({
  fontSize: 16,
  fontWeight: 600,
  margin: '2px 0',
  padding: '2px 0',
  opacity: active ? 1 : 0.6,
  color: active ? '#00bfff' : '#fff',
  cursor: 'pointer',
  borderRadius: 4,
  background: active ? 'rgba(0,191,255,0.08)' : 'none',
  transition: 'background 0.2s, color 0.2s, opacity 0.2s',
  width: 28,
  textAlign: 'center',
});

function AlphabetSidebar({ onLetterClick, activeLetter }) {
  return (
    <div style={sidebarStyle}>
      {letters.map((letter) => (
        <div
          key={letter}
          style={letterStyle(activeLetter === letter)}
          onClick={() => onLetterClick && onLetterClick(letter)}
          onMouseDown={e => e.preventDefault()}
        >
          {letter}
        </div>
      ))}
    </div>
  );
}

export default AlphabetSidebar; 