/// <reference types="vite/client" />
import { GameConsole } from '@/components/GameConsole';
import { APILogDisplay } from '@/components/APILogDisplay';
import './globals.css';

function App() {
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 backdrop-blur-sm border-b border-border sticky top-0 z-10">
        <div className="py-6">
          <div className="flex items-center justify-center space-x-4">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-2xl">🎮</span>
            </div>
            <div className="text-center">
              <h1 className="text-3xl font-bold text-foreground tracking-tight">
                Agent狼人杀竞技场
              </h1>
              <p className="text-base text-muted-foreground font-medium mt-1">
                Created By Box(@BoxMrChen) from Monad Foundation
              </p>
            </div>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-6 py-8 max-w-[90rem]">
        <GameConsole />
        
        {/* API日志显示组件 */}
        <APILogDisplay />
      </main>
    </div>
  );
}

export default App;