/**
 * Telemetria & Analytics Tracker (Estilo PostHog)
 * Rastreia cliques, abas visitadas, ações de leads e sessões dos clientes em tempo real.
 */

let currentUserId: string | undefined;
let currentUserEmail: string | undefined;

export function identifyUser(userId: string, email: string) {
  currentUserId = userId;
  currentUserEmail = email;
}

export async function trackEvent(eventName: string, tabName: string = 'dashboard', details: Record<string, any> = {}) {
  try {
    fetch('/api/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName,
        tabName,
        userId: currentUserId,
        userEmail: currentUserEmail,
        details: {
          ...details,
          path: window.location.pathname,
          hostname: window.location.hostname,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        }
      })
    }).catch(() => {});
  } catch (e) {
    // Non-blocking telemetry
  }
}
