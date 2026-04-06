# 📋 HƯỚNG DẪN CÀI ĐẶT - Máy chủ 10.24.16.77

## 1. Cài đặt phần mềm trên máy chủ

```bash
# Cài Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Kiểm tra
node -v && npm -v
```

## 2. Cài đặt PostgreSQL 18

```bash
sudo apt-get install -y postgresql-18 postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Tạo database
sudo -u postgres psql -c "CREATE DATABASE balance_sheet_db;"
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'mat_khau_cua_ban';"
```

### Cấu hình PostgreSQL cho mạng WAN

Sửa file `/etc/postgresql/18/main/postgresql.conf`:
```
listen_addresses = '10.24.16.77'
```

Sửa file `/etc/postgresql/18/main/pg_hba.conf` - thêm các dòng:
```
# Chi nhánh Cao Bằng
host  all  all  10.24.0.0/16  md5
# Chi nhánh Bắc Giang
host  all  all  10.42.0.0/16  md5
# Chi nhánh Lạng Sơn
host  all  all  10.30.0.0/16  md5
# Chi nhánh Bắc Ninh
host  all  all  10.44.0.0/16  md5
```

```bash
sudo systemctl restart postgresql
```

## 3. Triển khai Backend

```bash
# Copy thư mục backend_server lên máy chủ
cd /opt/balance-sheet-app/backend_server

# Cài dependencies
npm install

# Tạo file .env từ mẫu
cp .env.example .env
# Sửa file .env: đặt DB_PASSWORD và GEMINI_API_KEY
nano .env
```

### ⚠️ CẤU HÌNH PROXY (QUAN TRỌNG)

Trong file `.env`, đảm bảo:
```
HTTP_PROXY=http://hn.proxy.vdb:8080
HTTPS_PROXY=http://hn.proxy.vdb:8080
NO_PROXY=localhost,127.0.0.1,10.24.0.0/16,10.42.0.0/16,10.30.0.0/16,10.44.0.0/16
```

### Lấy Gemini API Key
1. Truy cập https://aistudio.google.com/apikey (qua máy có Internet)
2. Tạo API Key → copy vào `GEMINI_API_KEY` trong file `.env`

```bash
# Khởi tạo database
npm run db:init

# Test kết nối
npm start
# Truy cập http://10.24.16.77:3001/api/health để kiểm tra
```

## 4. Build Frontend

```bash
# Trên máy dev (có Internet), build frontend:
cd /path/to/project
echo "VITE_API_BASE_URL=http://10.24.16.77:3001" > .env.local
npm run build

# Copy thư mục dist/ vào máy chủ:
scp -r dist/* user@10.24.16.77:/opt/balance-sheet-app/backend_server/public/
```

## 5. Chạy dịch vụ nền (systemd)

Tạo file `/etc/systemd/system/balance-sheet.service`:
```ini
[Unit]
Description=Balance Sheet Analyzer
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/balance-sheet-app/backend_server
ExecStart=/usr/bin/node server.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable balance-sheet
sudo systemctl start balance-sheet
```

## 6. Mở tường lửa

```bash
sudo ufw allow from 10.24.0.0/16 to any port 3001
sudo ufw allow from 10.42.0.0/16 to any port 3001
sudo ufw allow from 10.30.0.0/16 to any port 3001
sudo ufw allow from 10.44.0.0/16 to any port 3001
```

## 7. Kiểm tra từ máy trạm

Truy cập: `http://10.24.16.77:3001`

### Test API health:
```
http://10.24.16.77:3001/api/health
```
Kết quả mong đợi:
```json
{
  "server": "ok",
  "database": "ok", 
  "proxy": "ok (qua proxy)",
  "gemini": "reachable"
}
```

## 🔧 Xử lý lỗi thường gặp

### Lỗi "không trích xuất được báo cáo"
- Kiểm tra proxy: `curl -x http://hn.proxy.vdb:8080 https://google.com`
- Kiểm tra GEMINI_API_KEY có đúng không
- Xem log: `sudo journalctl -u balance-sheet -f`

### Lỗi kết nối database
- Kiểm tra PostgreSQL: `sudo systemctl status postgresql`
- Test kết nối: `psql -h 10.24.16.77 -U postgres -d balance_sheet_db`
