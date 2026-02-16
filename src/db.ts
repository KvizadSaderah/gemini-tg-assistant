import Database from "better-sqlite3";

const db = new Database("bot_data.db");

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT,
    role TEXT,
    content TEXT,
    type TEXT,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS stats (
    key TEXT PRIMARY KEY,
    value INTEGER DEFAULT 0
  );
  
  CREATE TABLE IF NOT EXISTS outbound_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    content TEXT,
    type TEXT DEFAULT 'text',
    status TEXT DEFAULT 'pending'
  );
`);

export const storage = {
  logMessage: (userId: number, username: string | undefined, role: string, content: string, type: string = 'text', inputTokens: number = 0, outputTokens: number = 0) => {
    const stmt = db.prepare("INSERT INTO messages (user_id, username, role, content, type, input_tokens, output_tokens) VALUES (?, ?, ?, ?, ?, ?, ?)");
    stmt.run(userId, username || 'anonymous', role, content, type, inputTokens, outputTokens);
  },
  
  getApiUsage: () => {
    return db.prepare("SELECT SUM(input_tokens) as total_input, SUM(output_tokens) as total_output FROM messages").get() as { total_input: number, total_output: number };
  },

  getUserStats: () => {
    return db.prepare(`
      SELECT username, count(*) as total_messages, max(timestamp) as last_active 
      FROM messages 
      WHERE role = 'user' 
      GROUP BY username 
      ORDER BY total_messages DESC
    `).all();
  },

  getHourlyActivity: () => {
    return db.prepare(`
      SELECT strftime('%H', timestamp) as hour, count(*) as count 
      FROM messages 
      WHERE timestamp > datetime('now', '-24 hours')
      GROUP BY hour
    `).all();
  },

  getRecentChats: (limit: number = 20) => {
    return db.prepare("SELECT * FROM messages ORDER BY timestamp DESC LIMIT ?").all(limit);
  },

  enqueueOutbound: (userId: number, content: string, type: string = 'text') => {
    const stmt = db.prepare("INSERT INTO outbound_queue (user_id, content, type) VALUES (?, ?, ?)");
    stmt.run(userId, content, type);
  },

  getPendingOutbound: () => {
    return db.prepare("SELECT * FROM outbound_queue WHERE status = 'pending'").all();
  },

  markOutboundSent: (id: number) => {
    db.prepare("UPDATE outbound_queue SET status = 'sent' WHERE id = ?").run(id);
  }
};
