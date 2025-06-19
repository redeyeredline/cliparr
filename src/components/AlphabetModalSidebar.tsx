import React, { useRef, useState, useLayoutEffect } from 'react';

const MIN_BUTTON_HEIGHT = 20;
const ELLIPSIS = '…';

interface AlphabetModalSidebarProps {
  letters: string[];
  activeLetter: string | null;
  onLetterClick: (letter: string) => void;
}

const AlphabetModalSidebar: React.FC<AlphabetModalSidebarProps> = ({
  letters,
  activeLetter,
  onLetterClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [displayLetters, setDisplayLetters] = useState<string[]>([]);
  const [buttonHeight, setButtonHeight] = useState(0);

  useLayoutEffect(() => {
    const updateLayout = () => {
      if (!containerRef.current || letters.length === 0) {
        setDisplayLetters([]);
        return;
      }

      const containerHeight = containerRef.current.clientHeight;
      if (containerHeight === 0) {
        return;
      }

      const totalLetters = letters.length;
      const maxButtonsPossible = Math.floor(containerHeight / MIN_BUTTON_HEIGHT);

      if (totalLetters <= maxButtonsPossible) {
        setDisplayLetters(letters);
        setButtonHeight(containerHeight / totalLetters);
      } else {
        setButtonHeight(MIN_BUTTON_HEIGHT);
        if (maxButtonsPossible < 3) {
          setDisplayLetters(letters.slice(0, maxButtonsPossible));
          return;
        }

        const topCount = Math.ceil((maxButtonsPossible - 1) / 2);
        const bottomCount = maxButtonsPossible - 1 - topCount;

        const newDisplayLetters = [
          ...letters.slice(0, topCount),
          ELLIPSIS,
          ...letters.slice(totalLetters - bottomCount),
        ];
        setDisplayLetters(newDisplayLetters);
      }
    };

    const resizeObserver = new ResizeObserver(updateLayout);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    updateLayout();

    return () => resizeObserver.disconnect();
  }, [letters]);

  return (
    <div
      ref={containerRef}
      className="absolute top-0 left-0 h-full w-full flex flex-col"
      style={{ backgroundColor: '#23293a' }}
    >
      {displayLetters.map((letter, index) =>
        letter === ELLIPSIS ? (
          <div
            key={`ellipsis-${index}`}
            className="flex items-center justify-center text-gray-400 text-xs"
            style={{ height: `${buttonHeight}px` }}
            aria-hidden="true"
          >
            {letter}
          </div>
        ) : (
          <button
            key={letter}
            onClick={() => onLetterClick(letter)}
            style={{ height: `${buttonHeight}px`, minHeight: `${MIN_BUTTON_HEIGHT}px` }}
            className={`w-full text-xs font-medium transition-colors duration-150 
              flex items-center justify-center border-none outline-none border-b border-gray-700 ${
          activeLetter === letter
            ? 'bg-blue-600 text-white'
            : 'text-gray-400 hover:bg-blue-900 hover:text-gray-100'
          }`}
            aria-pressed={activeLetter === letter}
          >
            {letter}
          </button>
        ),
      )}
    </div>
  );
};

export default AlphabetModalSidebar;
