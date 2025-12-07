import React from 'react';
import { APP_NAME, APP_VERSION, COPYRIGHT_TEXT } from '../constants';

const WelcomeScreen: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center h-full relative p-4">
      <div className="flex flex-col items-center justify-center space-y-4 mb-20">
        <h1 className="text-6xl md:text-8xl font-bold tracking-tighter text-center">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 animate-gradient-x bg-[length:200%_auto]">
            {APP_NAME}
          </span>
        </h1>
        <p className="text-gray-400 text-2xl md:text-3xl font-light tracking-wide">
          How Can Help You?
        </p>
      </div>

      <div className="absolute bottom-24 text-center space-y-1 opacity-60">
        <p className="text-xs uppercase tracking-widest text-gray-500">{COPYRIGHT_TEXT}</p>
        <p className="text-[10px] text-gray-600 font-mono">{APP_VERSION}</p>
      </div>
    </div>
  );
};

export default WelcomeScreen;
