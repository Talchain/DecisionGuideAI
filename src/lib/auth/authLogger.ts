import { AuthError } from '@supabase/supabase-js';
import { redact } from '../redact';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';
type AuthEvent = 'SIGN_IN' | 'SIGN_UP' | 'SIGN_OUT' | 'SESSION' | 'PROFILE' | 'ERROR' | 'STATE' | 'INIT';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: AuthEvent;
  message: string;
  data?: any;
}

class AuthLogger {
  private static instance: AuthLogger;
  private logs: LogEntry[] = [];
  private readonly MAX_LOGS = 100;

  private constructor() {}

  static getInstance(): AuthLogger {
    if (!AuthLogger.instance) {
      AuthLogger.instance = new AuthLogger();
    }
    return AuthLogger.instance;
  }

  private createLogEntry(
    level: LogLevel,
    event: AuthEvent,
    message: string,
    data?: any
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      event,
      message,
      data
    };
  }

  private log(entry: LogEntry) {
    this.logs.push(entry);
    if (this.logs.length > this.MAX_LOGS) {
      this.logs.shift();
    }

    // Dev-only logging: compiled out in production builds
    if ((import.meta as any)?.env?.DEV) {
      const prefix = `[Auth ${entry.event}]`;
      const style = this.getLogStyle(entry.level);
      console.groupCollapsed(`%c${prefix} ${entry.message}`, style);
      console.log('Timestamp:', entry.timestamp);
      if (entry.data) console.log('Data:', redact(entry.data));
      console.trace();
      console.groupEnd();
    }
  }

  private getLogStyle(level: LogLevel): string {
    switch (level) {
      case 'error': return 'color: #ef4444; font-weight: bold';
      case 'warn': return 'color: #f59e0b; font-weight: bold';
      case 'info': return 'color: #3b82f6; font-weight: bold';
      case 'debug': return 'color: #6b7280; font-weight: bold';
    }
  }

  info(event: AuthEvent, message: string, data?: any) {
    this.log(this.createLogEntry('info', event, message, data));
  }

  warn(event: AuthEvent, message: string, data?: any) {
    this.log(this.createLogEntry('warn', event, message, data));
  }

  error(event: AuthEvent, message: string, error: Error | AuthError | unknown, context?: any) {
    const errorData = {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      context,
    };
    this.log(this.createLogEntry('error', event, message, errorData));
  }

  debug(event: AuthEvent, message: string, data?: any) {
    this.log(this.createLogEntry('debug', event, message, data));
  }

  logState(message: string, state: any) {
    this.debug('STATE', message, {
      user: state.user ? { id: state.user.id, email: state.user.email } : null,
      profile: state.profile ? { id: state.profile.id } : null,
      loading: state.loading,
      initialized: state.initialized,
      timestamp: new Date().toISOString()
    });
  }

  logInit(message: string, data?: any) {
    this.debug('INIT', message, {
      ...data,
      timestamp: new Date().toISOString()
    });
  }

  getRecentLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
  }
}

export const authLogger = AuthLogger.getInstance();