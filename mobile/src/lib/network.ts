import { useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { onlineManager } from '@tanstack/react-query';

type NetworkListener = (isOnline: boolean) => void;

class NetworkService {
  private static instance: NetworkService;
  private _isOnline: boolean = true;
  private _isChecking: boolean = false;
  private listeners: Set<NetworkListener> = new Set();
  private pollIntervalId: ReturnType<typeof setInterval> | null = null;
  private isInitialized: boolean = false;

  private constructor() {}

  public static getInstance(): NetworkService {
    if (!NetworkService.instance) {
      NetworkService.instance = new NetworkService();
    }
    return NetworkService.instance;
  }

  public init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // TanStack Query onlineManager sync
    onlineManager.setEventListener((setOnline) => {
      return this.subscribe((online) => {
        setOnline(online);
      });
    });

    // App state listener (trigger check when returning from background)
    AppState.addEventListener('change', this.handleAppStateChange);

    // Web browser online/offline events
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('online', () => this.checkConnection());
      window.addEventListener('offline', () => this.setOnline(false));
      if (typeof navigator !== 'undefined') {
        this._isOnline = navigator.onLine;
      }
    }

    // Initial check
    this.checkConnection();

    // Start background ping loop
    this.startPolling();
  }

  private handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      this.checkConnection();
    }
  };

  private startPolling(intervalMs: number = 25000) {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
    }
    this.pollIntervalId = setInterval(() => {
      this.checkConnection();
    }, intervalMs);
  }

  public get isOnline(): boolean {
    return this._isOnline;
  }

  public get isChecking(): boolean {
    return this._isChecking;
  }

  private setOnline(status: boolean) {
    if (this._isOnline !== status) {
      this._isOnline = status;
      this.listeners.forEach((listener) => {
        try {
          listener(status);
        } catch (e) {
          console.warn('[NetworkService] listener error:', e);
        }
      });
    }
  }

  public async checkConnection(): Promise<boolean> {
    if (this._isChecking) return this._isOnline;
    this._isChecking = true;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      // Fast, lightweight 204 endpoint or Supabase health
      const response = await fetch('https://clients3.google.com/generate_204', {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const online = response.status >= 200 && response.status < 400;
      this.setOnline(online);
      return online;
    } catch {
      // If primary ping fails, try secondary check before marking offline
      try {
        const fallbackController = new AbortController();
        const fallbackTimeout = setTimeout(() => fallbackController.abort(), 3500);

        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://oaczurouvaevebpimply.supabase.co';
        const fallbackRes = await fetch(`${supabaseUrl}/rest/v1/`, {
          method: 'HEAD',
          cache: 'no-store',
          signal: fallbackController.signal,
        });

        clearTimeout(fallbackTimeout);
        const online = fallbackRes.status > 0;
        this.setOnline(online);
        return online;
      } catch {
        this.setOnline(false);
        return false;
      }
    } finally {
      this._isChecking = false;
    }
  }

  public subscribe(listener: NetworkListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const networkService = NetworkService.getInstance();

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(() => networkService.isOnline);
  const [isChecking, setIsChecking] = useState<boolean>(() => networkService.isChecking);

  useEffect(() => {
    networkService.init();
    setIsOnline(networkService.isOnline);

    const unsubscribe = networkService.subscribe((status) => {
      setIsOnline(status);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const checkConnection = useCallback(async () => {
    setIsChecking(true);
    const result = await networkService.checkConnection();
    setIsChecking(false);
    return result;
  }, []);

  return {
    isOnline,
    isChecking,
    checkConnection,
  };
}
