require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST || "10.24.16.77",
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME || "balance_sheet_db",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD,
});

async function init() {
  console.log("🔧 Khởi tạo cơ sở dữ liệu...");
  
  await pool.query(`
    CREATE TABLE IF NOT EXISTS analysis_history (
      id SERIAL PRIMARY KEY,
      client_ip VARCHAR(50),
      branch_name VARCHAR(100),
      file_names TEXT[],
      analysis_result TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    CREATE TABLE IF NOT EXISTS branches (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      ip_range VARCHAR(50) NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    INSERT INTO branches (name, ip_range, description) VALUES
      ('Cao Bằng', '10.24.0.0/16', 'Chi nhánh Cao Bằng'),
      ('Bắc Giang', '10.42.0.0/16', 'Chi nhánh Bắc Giang'),
      ('Lạng Sơn', '10.30.0.0/16', 'Chi nhánh Lạng Sơn'),
      ('Bắc Ninh', '10.44.0.0/16', 'Chi nhánh Bắc Ninh')
    ON CONFLICT DO NOTHING;
  `);

  console.log("✅ Khởi tạo CSDL thành công!");
  await pool.end();
}

init().catch((e) => {
  console.error("❌ Lỗi khởi tạo:", e.message);
  process.exit(1);
});
