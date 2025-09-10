// Navigation debugging utility
const DEBUG_NAV = import.meta.env.DEV && (import.meta.env.VITE_DEBUG_NAV === 'true');

interface NavDebugEvent {
  type: 'auth' | 'render' | 'state' | 'error';
  component: string;
  action: string;
  data?: any;
  timestamp: string;
}

class NavDebugger {
  private static instance: NavDebugger;
  private logs: NavDebugEvent[] = [];

  private constructor() {}

  static getInstance(): NavDebugger {
    if (!NavDebugger.instance) {
      NavDebugger.instance = new NavDebugger();
    }
    return NavDebugger.instance;
  }

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private formatError(error: any): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'object' && error !== null) {
      return JSON.stringify(error);
    }
    return String(error);
  }

  log(type: NavDebugEvent['type'], component: string, action: string, data?: any) {
    if (!DEBUG_NAV) return;

    const event: NavDebugEvent = {
      type,
      component,
      action,
      data,
      timestamp: this.formatTimestamp()
    };

    this.logs.push(event);

    const styles = {
      auth: 'color: #6366f1; font-weight: bold;',
      render: 'color: #059669; font-weight: bold;',
      state: 'color: #7c3aed; font-weight: bold;',
      error: 'color: #dc2626; font-weight: bold;'
    };

    console.groupCollapsed(
      `%c[Nav ${type.toUpperCase()}] ${event.timestamp}`,
      styles[type]
    );
    console.log('Component:', component);
    console.log('Action:', action);
    if (data) console.log('Data:', data);
    console.groupEnd();
  }

  logAuthState(component: string, user: any, loading: boolean) {
    this.log('auth', component, 'Auth State Update', {
      isAuthenticated: !!user,
      loading,
      userId: user?.id,
      timestamp: this.formatTimestamp()
    });
  }

  logRender(component: string, props: any, state: any) {
    this.log('render', component, 'Component Render', {
      props,
      state,
      timestamp: this.formatTimestamp()
    });
  }

  logError(component: string, error: any) {
    this.log('error', component, 'Error Occurred', {
      error: this.formatError(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: this.formatTimestamp()
    });
  }

  logAuthError(component: string, error: any, context?: any) {
    this.log('error', component, 'Auth Error', {
      error: this.formatError(error),
      context,
      timestamp: this.formatTimestamp()
    });
  }
}

export const navDebug = NavDebugger.getInstance();