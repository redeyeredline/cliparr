import React from 'react';
import { useToast } from '../components/ToastContext';

export default function ToastTest() {
  const toast = useToast();

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Toast Component Test</h1>
      <div className="space-y-4">
        <button
          onClick={() => toast({ type: 'success', message: 'Operation completed successfully!' })}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
        >
          Show Success Toast
        </button>
        <br />
        <button
          onClick={() => toast({ type: 'error', message: 'Something went wrong!' })}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
        >
          Show Error Toast
        </button>
        <br />
        <button
          onClick={() => toast({ type: 'info', message: 'Here is some information.' })}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Show Info Toast
        </button>
      </div>
    </div>
  );
}
