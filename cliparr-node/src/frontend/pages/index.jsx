import React from 'react';
import DatabaseTest from '../components/DatabaseTest';

const Index = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-8">Cliparr Migration Progress</h1>
      
      <div className="space-y-8">
        <DatabaseTest />
        
        {/* Other components will be added here */}
      </div>
    </div>
  );
};

export default Index; 