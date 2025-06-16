import React, { useState } from 'react';
import AlphabetSidebar from '../components/AlphabetSidebar';

export default function AlphabetSidebarTest() {
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  
  // Generate alphabet letters
  const letters = Array.from({ length: 26 }, (_, i) => 
    String.fromCharCode(65 + i)
  );

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Alphabet Sidebar Test</h1>
      <div className="flex">
        <div className="w-96 h-[600px] bg-gray-100 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4">Content Area</h2>
          <p>Active Letter: {activeLetter || 'None'}</p>
          <p className="mt-4">This is a test area to demonstrate the alphabet sidebar functionality.</p>
          <p className="mt-2">Try clicking different letters in the sidebar to see the active state.</p>
        </div>
        <AlphabetSidebar
          letters={letters}
          activeLetter={activeLetter}
          onLetterClick={setActiveLetter}
        />
      </div>
    </div>
  );
} 