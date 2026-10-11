import pg from 'pg';
const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL || 'postgresql://nyx_user:nyx_secret_password@postgres:5432/nyxzap_db?schema=public';

export const pool = new Pool({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 5000,
});

export async function initDatabase() {
  try {
    const client = await pool.connect();
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
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
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

    // 5. Tabela de Conversas (Chats de Leads do WhatsApp)
    await client.query(`
      CREATE TABLE IF NOT EXISTS chats (
        id VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(100) REFERENCES users(id) ON DELETE CASCADE,
        lead_phone VARCHAR(50) NOT NULL,
        lead_name VARCHAR(150) NOT NULL,
        tag VARCHAR(50) DEFAULT 'quente',
        follow_up_date VARCHAR(50),
        internal_notes TEXT DEFAULT '',
        ai_agent_active BOOLEAN DEFAULT true,
        bot_flow_active BOOLEAN DEFAULT false,
        unread_count INT DEFAULT 0,
        last_message TEXT DEFAULT '',
        last_message_time VARCHAR(50) DEFAULT '',
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Inserir Planos Padrão se não existirem
    const plansCount = await client.query('SELECT COUNT(*) FROM plans');
    if (parseInt(plansCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO plans (id, name, price, period, instances_limit, ai_credits_limit, features) VALUES
        ('p1', 'Start', 97.00, 'mensal', 1, 1000, '["1 Conexão WhatsApp", "Agente IA Básico", "Suporte"]'::jsonb),
        ('p2', 'Pro (Mais Vendido)', 197.00, 'mensal', 3, 5000, '["3 Conexões WhatsApp", "Gemini 3 Grounding & Raciocínio", "Fluxo Drag-and-Drop"]'::jsonb),
        ('p3', 'Enterprise Anual', 1490.00, 'anual', 10, 50000, '["10 Conexões WhatsApp", "RAG Ilimitado", "Atendimento Humano Prioritário"]'::jsonb);
      `);
      console.log('[PostgreSQL] Planos iniciais inseridos com sucesso!');
    }

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

    client.release();
  } catch (err: any) {
    console.error('[PostgreSQL Error] Não foi possível conectar ao banco:', err.message);
  }
}
