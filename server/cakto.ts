/**
 * Cakto MCP & API Integration Helper
 * Conecta assistentes e a plataforma NyxZap à API Cakto (https://mcp.cakto.com.br / https://api.cakto.com.br)
 */

export interface CaktoCredentials {
  clientId: string;
  clientSecret: string;
}

export class CaktoClient {
  private clientId: string;
  private clientSecret: string;
  private mcpUrl: string = 'https://mcp.cakto.com.br';
  private apiUrl: string = 'https://api.cakto.com.br';
  private token: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(creds: CaktoCredentials) {
    this.clientId = creds.clientId?.trim();
    this.clientSecret = creds.clientSecret?.trim();
  }

  /**
   * Executa chamada via protocolo MCP HTTP remoto
   */
  async callMcp(name: string, args: Record<string, any> = {}) {
    const res = await fetch(this.mcpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'X-Cakto-Client-Id': this.clientId,
        'X-Cakto-Client-Secret': this.clientSecret
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name,
          arguments: args
        }
      })
    });
    return res.json();
  }

  /**
   * Obtém token OAuth2 na Public API da Cakto
   */
  async getAccessToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiresAt) {
      return this.token;
    }

    const res = await fetch(`${this.apiUrl}/public_api/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret
      })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Cakto Auth Failed (${res.status}): ${err}`);
    }

    const data = await res.json();
    this.token = data.access_token;
    this.tokenExpiresAt = Date.now() + ((data.expires_in || 3600) - 300) * 1000;
    return this.token!;
  }

  /**
   * Lista produtos e ofertas cadastradas na Cakto
   */
  async listProducts() {
    try {
      const token = await this.getAccessToken();
      const res = await fetch(`${this.apiUrl}/public_api/products/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e: any) {
      console.warn('[Cakto] Aviso ao listar produtos via API direta:', e.message);
    }

    // Fallback via MCP
    return this.callMcp('cakto_call', {
      operation_id: 'products_list',
      query: {},
      confirm: false
    });
  }
}
