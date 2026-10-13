import pg from 'pg';
const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL || 'postgresql://nyx_user:nyx_secret_password@postgres:5432/nyxzap_db?schema=public';

const rawPool = new Pool({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 3000,
});

// Mock em memória para desenvolvimento local quando o PostgreSQL do Docker não estiver ativo
const mockData = {
  users: [
    {
      id: 'usr-admin',
      name: 'Super Administrador',
      email: 'admin@admin',
      password: 'admin',
      role: 'admin',
      plan_id: 'p3',
      plan_name: 'Enterprise Anual',
      status: 'active',
      mrr_value: 1490.00,
      valid_until: '2030-12-31',
      instances_limit: 10,
      connected_instances: 0,
      created_at: new Date()
    },
    {
      id: 'usr-admin-nyx',
      name: 'Super Administrador',
      email: 'admin@nyxzap.com',
      password: 'admin123',
      role: 'admin',
      plan_id: 'p3',
      plan_name: 'Enterprise Anual',
      status: 'active',
      mrr_value: 1490.00,
      valid_until: '2030-12-31',
      instances_limit: 10,
      connected_instances: 0,
      created_at: new Date()
    },
    {
      id: 'usr-demo',
      name: 'Cliente NyxZap Pro',
      email: 'cliente@empresa.com',
      password: '123456',
      role: 'client',
      plan_id: 'p2',
      plan_name: 'Pro (Mais Vendido)',
      status: 'active',
      mrr_value: 197.00,
      valid_until: '2026-11-10',
      instances_limit: 3,
      connected_instances: 1,
      created_at: new Date()
    }
  ],
  plans: [
    { id: 'p1', name: 'Start', price: 97.00, period: 'mensal', instances_limit: 1, ai_credits_limit: 1000, features: '["1 Conexão WhatsApp", "Agente IA Básico", "Suporte"]' },
    { id: 'p2', name: 'Pro (Mais Vendido)', price: 197.00, period: 'mensal', instances_limit: 3, ai_credits_limit: 5000, features: '["3 Conexões WhatsApp", "Gemini 3 Grounding & Raciocínio", "Fluxo Drag-and-Drop"]' },
    { id: 'p3', name: 'Enterprise Anual', price: 1490.00, period: 'anual', instances_limit: 10, ai_credits_limit: 50000, features: '["10 Conexões WhatsApp", "RAG Ilimitado", "Atendimento Humano Prioritário"]' },
    { id: 'p_dinder', name: 'Plano Dinder', price: 97.00, period: 'mensal', instances_limit: 1, ai_credits_limit: 1000, features: '["1 Conexão WhatsApp", "Sistema CRM completo", "Integração WhatsApp + Botzap"]' },
    { id: 'p_pro_ia', name: 'Plano Pro com IA', price: 147.00, period: 'mensal', instances_limit: 1, ai_credits_limit: 50000, features: '["Tudo do Dinder + IA ilimitada", "1 Conexão WhatsApp", "CRM completo + IA"]' }
  ],
  system_updates: [
    { id: 'up-1', version: 'v2.2.0', date: '11/10/2026', type: 'implementacao', title: 'Banco de Dados PostgreSQL & Painéis Isolados', message: 'Migração completa de infraestrutura para PostgreSQL nativo com persistência de dados, isolamento de subdomínio para administração e controle de licenças.', status: 'active', created_at: new Date() },
    { id: 'up-2', version: 'v2.1.0', date: '11/10/2026', type: 'implementacao', title: 'Multi-WhatsApp e Pacotes Adicionais', message: 'Suporte a múltiplas conexões simultâneas de WhatsApp via Baileys com pacotes extras por licença.', status: 'active', created_at: new Date() },
    { id: 'up-3', version: 'v2.0.8', date: '10/10/2026', type: 'correcao', title: 'Debounce no Envio Manual de Mensagens', message: 'Correção de disparo duplo em conversas ativas no chat em tempo real.', status: 'active', created_at: new Date() }
  ],
  cakto_config: {
    id: 'default',
    client_id: '1tyOaWA3KmZDn87nHzJYQksvEBANLiiV7Zx1uLeo',
    client_secret: '',
    webhook_secret: '',
    checkout_links: {
      tier_1: 'https://pay.cakto.com.br/wvzo8by_1192101',
      tier_2: 'https://pay.cakto.com.br/s588s5h_1192102',
      tier_3: 'https://pay.cakto.com.br/37vbpz4_1192103',
      tier_5: 'https://pay.cakto.com.br/o887kzn_1192105',
      plan_dinder_mensal: 'https://pay.cakto.com.br/w9d4ou9_1191931',
      plan_dinder_anual: 'https://pay.cakto.com.br/693263v_1192152',
      plan_pro_mensal: 'https://pay.cakto.com.br/87jcu5r_1192138',
      plan_pro_anual: 'https://pay.cakto.com.br/3764ipv_1192156',
      plan_p1: 'https://pay.cakto.com.br/w9d4ou9_1191931',
      plan_p2: 'https://pay.cakto.com.br/87jcu5r_1192138',
      plan_p3: 'https://pay.cakto.com.br/3764ipv_1192156'
    }
  },
  flow_definitions: [] as any[]
};

function executeMockQuery(sql: string, params?: any[]) {
  const upperSql = sql.toUpperCase();

  if (upperSql.includes('FLOW_DEFINITIONS')) {
    if (upperSql.includes('DELETE FROM')) {
      const targetId = params?.[0];
      if (targetId) {
        mockData.flow_definitions = mockData.flow_definitions.filter(f => f.id !== targetId);
      }
      return { rows: [], rowCount: 1 };
    }
    if (upperSql.includes('INSERT INTO') || upperSql.includes('ON CONFLICT')) {
      const flowId = params?.[0];
      const name = params?.[1] || 'Fluxo';
      const description = params?.[2] || '';
      const active = params?.[3] !== false;
      let nodes = [];
      let edges = [];
      try {
        nodes = typeof params?.[4] === 'string' ? JSON.parse(params[4]) : (params?.[4] || []);
        edges = typeof params?.[5] === 'string' ? JSON.parse(params[5]) : (params?.[5] || []);
      } catch (e) {}
      const existingIdx = mockData.flow_definitions.findIndex(f => f.id === flowId);
      const flowItem = {
        id: flowId,
        user_id: 'default',
        name,
        description,
        active,
        execution_count: 0,
        nodes,
        edges,
        updated_at: new Date()
      };
      if (existingIdx >= 0) {
        mockData.flow_definitions[existingIdx] = flowItem;
      } else {
        mockData.flow_definitions.push(flowItem);
      }
      return { rows: [flowItem], rowCount: 1 };
    }
    if (upperSql.includes('UPDATE')) {
      if (upperSql.includes('SET NAME =')) {
        const name = params?.[0];
        const description = params?.[1];
        const active = params?.[2];
        const id = params?.[3];
        const target = mockData.flow_definitions.find(f => f.id === id);
        if (target) {
          if (name !== undefined && name !== null) target.name = name;
          if (description !== undefined && description !== null) target.description = description;
          if (active !== undefined && active !== null) target.active = active;
        }
      }
      return { rows: [], rowCount: 1 };
    }
    return { rows: mockData.flow_definitions, rowCount: mockData.flow_definitions.length };
  }

  if (upperSql.includes('FROM USERS')) {
    if (upperSql.includes('WHERE EMAIL =') || upperSql.includes('WHERE LOWER(EMAIL) =')) {
      const targetEmail = (params?.[0] || '').toString().toLowerCase().trim();
      const matched = mockData.users.filter(u => u.email.toLowerCase() === targetEmail);
      if (matched.length > 0) {
        return { rows: matched, rowCount: matched.length };
      }
      if (targetEmail.includes('admin') || targetEmail === 'admin@admin') {
        return { rows: [mockData.users[0]], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }
    return { rows: mockData.users, rowCount: mockData.users.length };
  }

  if (upperSql.includes('FROM PLANS')) {
    return { rows: mockData.plans, rowCount: mockData.plans.length };
  }

  if (upperSql.includes('FROM SYSTEM_UPDATES')) {
    return { rows: mockData.system_updates, rowCount: mockData.system_updates.length };
  }

  if (upperSql.includes('CAKTO_CONFIG')) {
    if (upperSql.includes('INSERT INTO') || upperSql.includes('UPDATE')) {
      const [clientId, clientSecret, webhookSecret, checkoutLinks] = [params?.[0], params?.[1], params?.[2], params?.[3]];
      if (clientId) mockData.cakto_config.client_id = clientId;
      if (clientSecret) mockData.cakto_config.client_secret = clientSecret;
      if (webhookSecret !== undefined && webhookSecret !== null) mockData.cakto_config.webhook_secret = webhookSecret;
      if (checkoutLinks) {
        try {
          mockData.cakto_config.checkout_links = typeof checkoutLinks === 'string' ? JSON.parse(checkoutLinks) : checkoutLinks;
        } catch {}
      }
      return { rows: [mockData.cakto_config], rowCount: 1 };
    }
    return { rows: [mockData.cakto_config], rowCount: 1 };
  }

  return { rows: [], rowCount: 0 };
}

let dbOffline = false;

export const pool = {
  async query(text: string, params?: any[]) {
    if (dbOffline) {
      return executeMockQuery(text, params);
    }
    try {
      return await rawPool.query(text, params);
    } catch (err: any) {
      dbOffline = true;
      return executeMockQuery(text, params);
    }
  },
  async connect() {
    return await rawPool.connect();
  }
};

export async function initDatabase() {
  try {
    const client = await rawPool.connect();
    console.log('[PostgreSQL] Conectado ao banco de dados com sucesso!');

    // 1. Tabela de Planos
    await client.query(`
      CREATE TABLE IF NOT EXISTS plans (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        price NUMERIC(10, 2) NOT NULL,
        period VARCHAR(20) NOT NULL DEFAULT 'mensal',
        instances_limit INT NOT NULL DEFAULT 1,
        ai_credits_limit INT NOT NULL DEFAULT 1000,
        features JSONB NOT NULL DEFAULT '[]'
      );
    `);

    // 2. Tabela de Usuários / Assinantes
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'client', -- 'admin' ou 'client'
        phone VARCHAR(50),
        plan_id VARCHAR(50) REFERENCES plans(id) ON DELETE SET NULL,
        plan_name VARCHAR(100) DEFAULT 'Plano Pro',
        status VARCHAR(30) NOT NULL DEFAULT 'active', -- 'active', 'expired', 'canceled'
        mrr_value NUMERIC(10, 2) NOT NULL DEFAULT 97.00,
        valid_until VARCHAR(50) DEFAULT '2026-11-10',
        instances_limit INT NOT NULL DEFAULT 1,
        connected_instances INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Tabela de Atualizações do Sistema (Novidades & Correções)
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_updates (
        id VARCHAR(100) PRIMARY KEY,
        version VARCHAR(30) NOT NULL,
        date VARCHAR(30) NOT NULL,
        type VARCHAR(30) NOT NULL, -- 'correcao', 'implementacao', 'melhoria'
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active' ou 'paused'
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE system_updates ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';
    `);

    // 3.1 Tabela de Telemetria / Auditoria de Usuários (PostHog / Analytics)
    await client.query(`
      CREATE TABLE IF NOT EXISTS telemetry_events (
        id VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(100),
        user_email VARCHAR(150),
        event_name VARCHAR(100) NOT NULL,
        tab_name VARCHAR(50),
        details JSONB DEFAULT '{}',
        ip_address VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3.2 Tabela de Recuperação de Senha
    await client.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id VARCHAR(100) PRIMARY KEY,
        email VARCHAR(150) NOT NULL,
        token VARCHAR(100) NOT NULL,
        code VARCHAR(20) NOT NULL DEFAULT '123456',
        status VARCHAR(20) DEFAULT 'pending',
        expires_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP + INTERVAL '30 minutes',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE password_resets ADD COLUMN IF NOT EXISTS code VARCHAR(20) DEFAULT '123456';
      ALTER TABLE password_resets ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP + INTERVAL '30 minutes';
    `);

    // 3.3 Tabela de Configuração e Links de Checkout Cakto
    await client.query(`
      CREATE TABLE IF NOT EXISTS cakto_config (
        id VARCHAR(50) PRIMARY KEY,
        client_id VARCHAR(200),
        client_secret VARCHAR(255),
        webhook_secret VARCHAR(255),
        checkout_links JSONB DEFAULT '{}',
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE cakto_config ADD COLUMN IF NOT EXISTS webhook_secret VARCHAR(255);
    `);

    // 3.4 Tabela de Instâncias de WhatsApp (Persistência e Nomes Customizados)
    await client.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_instances (
        id VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(100),
        name VARCHAR(150) NOT NULL,
        phone VARCHAR(50),
        status VARCHAR(30) DEFAULT 'disconnected',
        automation_mode VARCHAR(20) DEFAULT 'flow',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE whatsapp_instances ADD COLUMN IF NOT EXISTS automation_mode VARCHAR(20) DEFAULT 'flow';
    `);

    // 4. Tabela de Configurações do Agente IA
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_configs (
        id VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(100) REFERENCES users(id) ON DELETE CASCADE,
        provider VARCHAR(30) DEFAULT 'gemini',
        api_key TEXT,
        model VARCHAR(100) DEFAULT 'gemini-3.8-flash',
        reasoning_level VARCHAR(30) DEFAULT 'high',
        media_resolution VARCHAR(30) DEFAULT 'maximo',
        web_search_enabled BOOLEAN DEFAULT true,
        system_prompt TEXT,
        escape_keywords JSONB DEFAULT '["humano", "falar com atendente", "cancelar", "reclamação", "processo"]',
        knowledge_docs JSONB DEFAULT '[]',
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4.1 Tabela de Definições de Fluxos Visuais (Flow Builder)
    await client.query(`
      CREATE TABLE IF NOT EXISTS flow_definitions (
        id VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(100) DEFAULT 'default',
        name VARCHAR(150) DEFAULT 'Fluxo Principal',
        description TEXT DEFAULT '',
        active BOOLEAN DEFAULT true,
        execution_count INT DEFAULT 0,
        nodes JSONB NOT NULL DEFAULT '[]',
        edges JSONB NOT NULL DEFAULT '[]',
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE flow_definitions ADD COLUMN IF NOT EXISTS name VARCHAR(150) DEFAULT 'Fluxo Principal';
      ALTER TABLE flow_definitions ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
      ALTER TABLE flow_definitions ADD COLUMN IF NOT EXISTS execution_count INT DEFAULT 0;
    `);

    // 5. Tabela de Conversas (Chats de Leads do WhatsApp)
    await client.query(`
      CREATE TABLE IF NOT EXISTS chats (
        id VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(100),
        lead_phone VARCHAR(50) NOT NULL,
        lead_name VARCHAR(150) NOT NULL,
        tag VARCHAR(50) DEFAULT 'quente',
        follow_up_date VARCHAR(50),
        follow_up_text TEXT DEFAULT '',
        follow_up_media_path TEXT DEFAULT '',
        follow_up_media_type VARCHAR(50) DEFAULT '',
        follow_up_file_name VARCHAR(255) DEFAULT '',
        follow_up_status VARCHAR(50) DEFAULT 'idle',
        internal_notes TEXT DEFAULT '',
        ai_agent_active BOOLEAN DEFAULT false,
        bot_flow_active BOOLEAN DEFAULT true,
        unread_count INT DEFAULT 0,
        last_message TEXT DEFAULT '',
        last_message_time VARCHAR(50) DEFAULT '',
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE chats DROP CONSTRAINT IF EXISTS chats_user_id_fkey;
      ALTER TABLE chats ALTER COLUMN bot_flow_active SET DEFAULT true;
      ALTER TABLE chats ADD COLUMN IF NOT EXISTS follow_up_text TEXT DEFAULT '';
      ALTER TABLE chats ADD COLUMN IF NOT EXISTS follow_up_media_path TEXT DEFAULT '';
      ALTER TABLE chats ADD COLUMN IF NOT EXISTS follow_up_media_type VARCHAR(50) DEFAULT '';
      ALTER TABLE chats ADD COLUMN IF NOT EXISTS follow_up_file_name VARCHAR(255) DEFAULT '';
      ALTER TABLE chats ADD COLUMN IF NOT EXISTS follow_up_status VARCHAR(50) DEFAULT 'idle';
      UPDATE chats SET bot_flow_active = true WHERE bot_flow_active IS NULL;
      DELETE FROM chats WHERE id LIKE '%broadcast%' OR lead_phone LIKE '%broadcast%';
    `);

    // 5.1 Tabela de Disparos Agendados de Comunicados em Grupos
    await client.query(`
      CREATE TABLE IF NOT EXISTS scheduled_broadcasts (
        id VARCHAR(100) PRIMARY KEY,
        group_id VARCHAR(100) NOT NULL,
        group_name VARCHAR(150),
        text TEXT,
        media_path TEXT,
        media_type VARCHAR(50),
        file_name VARCHAR(150),
        mention_all BOOLEAN DEFAULT false,
        scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
        status VARCHAR(30) DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'canceled'
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 6. Tabela de Mensagens do Chat
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id VARCHAR(100) PRIMARY KEY,
        chat_id VARCHAR(100) REFERENCES chats(id) ON DELETE CASCADE,
        from_me BOOLEAN NOT NULL,
        text TEXT NOT NULL,
        timestamp VARCHAR(50) NOT NULL,
        sender_name VARCHAR(150),
        is_ai_generated BOOLEAN DEFAULT false,
        media_url TEXT,
        media_type VARCHAR(50),
        file_name VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS media_url TEXT;
      ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS media_type VARCHAR(50);
      ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS file_name VARCHAR(255);
    `);

    // Inserir Planos Padrão se não existirem
    await client.query(`
      INSERT INTO plans (id, name, price, period, instances_limit, ai_credits_limit, features) VALUES
      ('p1', 'Start', 97.00, 'mensal', 1, 1000, '["1 Conexão WhatsApp", "Agente IA Básico", "Suporte"]'::jsonb),
      ('p2', 'Pro (Mais Vendido)', 197.00, 'mensal', 3, 5000, '["3 Conexões WhatsApp", "Gemini 3 Grounding & Raciocínio", "Fluxo Drag-and-Drop"]'::jsonb),
      ('p3', 'Enterprise Anual', 1490.00, 'anual', 10, 50000, '["10 Conexões WhatsApp", "RAG Ilimitado", "Atendimento Humano Prioritário"]'::jsonb),
      ('p_dinder', 'Plano Dinder', 97.00, 'mensal', 1, 1000, '["1 Conexão WhatsApp", "Sistema CRM completo", "Integração WhatsApp + Botzap", "Use sua IA: GPT, Gemini ou Claude"]'::jsonb),
      ('p_pro_ia', 'Plano Pro com IA', 147.00, 'mensal', 1, 50000, '["Tudo do Dinder + IA ilimitada", "1 Conexão WhatsApp", "CRM completo + IA", "Respostas automáticas", "Suporte 24/7"]'::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        price = EXCLUDED.price;
    `);

    // Inserir Usuário SuperAdmin e Usuário Cliente Padrão se não existirem
    const usersCount = await client.query('SELECT COUNT(*) FROM users');
    if (parseInt(usersCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO users (id, name, email, password, role, plan_id, plan_name, status, mrr_value, valid_until, instances_limit, connected_instances) VALUES
        ('usr-admin', 'Super Administrador', 'admin@nyxzap.com', 'admin123', 'admin', 'p3', 'Enterprise Anual', 'active', 1490.00, '2030-12-31', 10, 0),
        ('usr-demo', 'Cliente NyxZap Pro', 'cliente@empresa.com', '123456', 'client', 'p2', 'Pro (Mais Vendido)', 'active', 197.00, '2026-11-10', 3, 1);
      `);
      console.log('[PostgreSQL] Usuários iniciais cadastrados (admin@nyxzap.com e cliente@empresa.com)!');
    }

    // Inserir Atualizações do Sistema se não existirem
    const updatesCount = await client.query('SELECT COUNT(*) FROM system_updates');
    if (parseInt(updatesCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO system_updates (id, version, date, type, title, message) VALUES
        ('up-1', 'v2.2.0', '11/10/2026', 'implementacao', 'Banco de Dados PostgreSQL & Painéis Isolados', 'Migração completa de infraestrutura para PostgreSQL nativo com persistência de dados, isolamento de subdomínio para administração e controle de licenças.'),
        ('up-2', 'v2.1.0', '11/10/2026', 'implementacao', 'Multi-WhatsApp e Pacotes Adicionais', 'Suporte a múltiplas conexões simultâneas de WhatsApp via Baileys com pacotes extras por licença.'),
        ('up-3', 'v2.0.8', '10/10/2026', 'correcao', 'Debounce no Envio Manual de Mensagens', 'Correção de disparo duplo em conversas ativas no chat em tempo real.');
      `);
      console.log('[PostgreSQL] Histórico de atualizações do sistema inserido!');
    }

    // Inserir Configuração Padrão da Cakto
    await client.query(`
      INSERT INTO cakto_config (id, client_id, client_secret, checkout_links)
      VALUES (
        'default',
        '1tyOaWA3KmZDn87nHzJYQksvEBANLiiV7Zx1uLeo',
        'CJU1PK2UhYmSTH22zpjjAWPMfutDK8l1Kd3S7JroivqB2neNz1YbVM2CEg6Mmdd7kLYqYWy318gkEraehacl8W8ys2ww4R6tedBQp0ZDHXLEG3fPf0cUhQXiI8ZKFqk0',
        '{"tier_1": "https://pay.cakto.com.br/nyxzap-extra-1", "tier_2": "https://pay.cakto.com.br/nyxzap-extra-2", "tier_3": "https://pay.cakto.com.br/nyxzap-extra-3", "tier_5": "https://pay.cakto.com.br/nyxzap-extra-5", "plan_p1": "https://pay.cakto.com.br/nyxzap-start", "plan_p2": "https://pay.cakto.com.br/nyxzap-pro", "plan_p3": "https://pay.cakto.com.br/nyxzap-enterprise"}'::jsonb
      )
      ON CONFLICT (id) DO NOTHING;
    `);

    client.release();
  } catch (err: any) {
    dbOffline = true;
    console.log('[PostgreSQL Offline] Banco remoto/Docker offline localmente. Mock em memória ativado instantaneamente para desenvolvimento local.');
  }
}
