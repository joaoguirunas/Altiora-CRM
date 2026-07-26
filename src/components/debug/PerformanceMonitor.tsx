import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useUnifiedSessionManager } from '@/hooks/useUnifiedSessionManager';
import { Activity, Wifi, Database, Clock, RefreshCw } from 'lucide-react';

interface PerformanceStats {
  memoryUsage: number;
  renderCount: number;
  lastActivity: Date;
  sessionHealth: 'good' | 'warning' | 'critical';
  realtimeHealth: 'connected' | 'disconnected' | 'recovering';
}

export const PerformanceMonitor: React.FC = () => {
  const [stats, setStats] = useState<PerformanceStats>({
    memoryUsage: 0,
    renderCount: 0,
    lastActivity: new Date(),
    sessionHealth: 'good',
    realtimeHealth: 'connected'
  });

  const [isVisible, setIsVisible] = useState(false);
  
  const { 
    isConnected: sessionConnected, 
    sessionValid, 
    minutesLeft, 
    retryAttempts: sessionRetries 
  } = useUnifiedSessionManager();
  
  
  
  // Valores padrão para realtime (removido useRealtimeRecovery)
  const realtimeConnected = false;
  const realtimeRetries = 0;
  const forceReconnect = () => {};

  // Contador de renders
  const renderCountRef = React.useRef(0);
  renderCountRef.current++;

  // Atualizar estatísticas
  useEffect(() => {
    const updateStats = () => {
      // Calcular uso de memória (aproximado)
      const memoryUsage = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Determinar saúde da sessão
      let sessionHealth: 'good' | 'warning' | 'critical' = 'good';
      if (!sessionConnected || !sessionValid) {
        sessionHealth = 'critical';
      } else if (minutesLeft !== null && minutesLeft <= 15) {
        sessionHealth = 'warning';
      }

      // Determinar saúde do realtime
      let realtimeHealth: 'connected' | 'disconnected' | 'recovering' = 'connected';
      if (!realtimeConnected) {
        realtimeHealth = realtimeRetries > 0 ? 'recovering' : 'disconnected';
      }

      setStats({
        memoryUsage: Math.round(memoryUsage / 1024 / 1024), // MB
        renderCount: renderCountRef.current,
        lastActivity: new Date(),
        sessionHealth,
        realtimeHealth
      });
    };

    updateStats();
    const interval = setInterval(updateStats, 5000); // A cada 5 segundos

    return () => clearInterval(interval);
  }, [sessionConnected, sessionValid, minutesLeft, realtimeConnected, realtimeRetries]);

  // Mostrar monitor apenas no desenvolvimento ou com Ctrl+Shift+P
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        setIsVisible(!isVisible);
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isVisible]);

  // Mostrar apenas se visível
  if (!isVisible && process.env.NODE_ENV === 'production') {
    return null;
  }

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'good':
      case 'connected':
        return 'bg-green-500';
      case 'warning':
      case 'recovering':
        return 'bg-yellow-500';
      case 'critical':
      case 'disconnected':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getHealthText = (health: string) => {
    switch (health) {
      case 'good':
        return 'Saudável';
      case 'warning':
        return 'Atenção';
      case 'critical':
        return 'Crítico';
      case 'connected':
        return 'Conectado';
      case 'recovering':
        return 'Recuperando';
      case 'disconnected':
        return 'Desconectado';
      default:
        return health;
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!isVisible ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsVisible(true)}
          className="bg-background border-border"
        >
          <Activity className="w-4 h-4" />
        </Button>
      ) : (
        <Card className="w-80 bg-background border-border shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Performance Monitor</CardTitle>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsVisible(false)}
                className="h-6 w-6 p-0"
              >
                ×
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-3">
            {/* Saúde da Sessão */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Sessão</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge 
                  variant="outline" 
                  className={`${getHealthColor(stats.sessionHealth)} text-white border-none`}
                >
                  {getHealthText(stats.sessionHealth)}
                </Badge>
                {minutesLeft && (
                  <span className="text-xs text-muted-foreground">
                    {minutesLeft}m
                  </span>
                )}
              </div>
            </div>

            {/* Saúde do Realtime */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Realtime</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge 
                  variant="outline" 
                  className={`${getHealthColor(stats.realtimeHealth)} text-white border-none`}
                >
                  {getHealthText(stats.realtimeHealth)}
                </Badge>
                {realtimeRetries > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={forceReconnect}
                    className="h-6 w-6 p-0"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>

            {/* Tentativas de Reconexão */}
            {(sessionRetries > 0 || realtimeRetries > 0) && (
              <div className="flex items-center justify-between">
                <span className="text-sm">Tentativas</span>
                <div className="flex gap-2">
                  {sessionRetries > 0 && (
                    <Badge variant="outline" className="text-xs">
                      Sessão: {sessionRetries}
                    </Badge>
                  )}
                  {realtimeRetries > 0 && (
                    <Badge variant="outline" className="text-xs">
                      RT: {realtimeRetries}
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Estatísticas de Performance */}
            <div className="pt-2 border-t border-border space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Memória</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {stats.memoryUsage} MB
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Renders</span>
                <span className="text-xs text-muted-foreground">
                  {stats.renderCount}
                </span>
              </div>
            </div>

            {/* Informações do Tenant */}
            {true && (
              <div className="pt-2 border-t border-border">
                <div className="text-xs text-muted-foreground">
                  Tenant: {'single-tenant'.slice(0, 8)}...
                </div>
              </div>
            )}
            
            <div className="text-xs text-muted-foreground text-center">
              Ctrl+Shift+P para alternar
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};