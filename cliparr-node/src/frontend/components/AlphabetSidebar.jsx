import React from 'react';

function AlphabetSidebar({ availableLetters, activeLetter, onLetterClick }) {
  const alphabet = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];

  return (
    <div className="fixed right-4 top-1/2 transform -translate-y-1/2 bg-gray-800 rounded-lg p-2 shadow-lg">
      {alphabet.map(letter => (
        <button
          key={letter}
          onClick={() => onLetterClick(letter)}
          className={`block w-6 h-6 text-center text-sm rounded ${
            !availableLetters.includes(letter)
              ? 'text-gray-500 cursor-not-allowed'
              : activeLetter === letter
              ? 'bg-blue-500 text-white'
              : 'text-gray-300 hover:bg-gray-700'
          }`}
          disabled={!availableLetters.includes(letter)}
        >
          {letter}
        </button>
      ))}
    </div>
  );
}

export default AlphabetSidebar; 