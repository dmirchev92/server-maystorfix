type AuthEvent = 'logout' | 'login';

type Listener = () => void;

class SimpleAuthBus {
  private listeners: Record<AuthEvent, Set<Listener>> = {
    logout: new Set<Listener>(),
    login: new Set<Listener>()
  };

  subscribe(event: AuthEvent, listener: Listener): () => void {
    this.listeners[event].add(listener);
    return () => {
      this.listeners[event].delete(listener);
    };
  }

  emit(event: AuthEvent): void {
    this.listeners[event].forEach((listener) => {
      try {
        listener();
      } catch {}
    });
  }
}

export const AuthBus = new SimpleAuthBus();




