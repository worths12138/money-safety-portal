# 腾讯云轻量服务器部署清单

在 [腾讯云轻量应用服务器 Lighthouse](https://cloud.tencent.com/product/lighthouse) 上部署本仓库（Next.js + Supabase + 智谱 + **PyMuPDF**）。

相比 [Vercel 部署](./DEPLOY_VERCEL.md)，轻量服务器可运行 **Python PDF 解析** 与 **长时间 AI 预审**，更适合完整功能演示。

---

## 部署前准备

| 项 | 说明 |
|----|------|
| 轻量服务器 | 建议 **Ubuntu 22.04**，配置 **2核 2GB+**（构建 Next 建议 2GB，不足可加 swap） |
| 域名（可选） | 备案后绑定；演示可先用 **公网 IP:80** |
| Supabase | 已执行 `supabase/schema.sql` 与 `compliance_rules_migration.sql` |
| 智谱 API Key | [开放平台](https://open.bigmodel.cn/usercenter/proj-mgmt/apikeys) |
| GitHub | 仓库可公开或配置 Deploy Key |

---

## 一、购买与防火墙

1. [轻量控制台](https://console.cloud.tencent.com/lighthouse) → 创建实例 → 选 **Ubuntu 22.04 LTS**
2. 记下 **公网 IP**
3. 实例 → **防火墙** → 放行：

| 端口 | 用途 |
|------|------|
| 22 | SSH |
| 80 | HTTP（Nginx） |
| 443 | HTTPS（可选） |

> 应用跑在 **3000** 端口，仅本机访问；对外由 Nginx 反代，**不必**对公网开放 3000。

---

## 二、SSH 登录并安装基础环境

```bash
ssh ubuntu@你的公网IP
# 或 root@你的公网IP（视镜像用户而定）
```

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl nginx python3 python3-pip python3-venv build-essential
```

### Node.js 20（推荐 nvm）

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
node -v   # 应 >= v20
npm -v
```

### PM2（进程守护）

```bash
npm install -g pm2
```

### PyMuPDF（PDF 解析，与本地一致）

```bash
cd ~
pip3 install -r /tmp/requirements-pdf.txt
# 若尚未克隆仓库，可先：curl 下载或克隆后再 pip3 install -r requirements-pdf.txt
```

---

## 三、克隆代码与环境变量

```bash
sudo mkdir -p /var/www
sudo chown $USER:$USER /var/www
cd /var/www
git clone https://github.com/worths12138/money-safety-portal.git
cd money-safety-portal
```

创建生产环境变量（**勿提交 Git**）：

```bash
nano .env.local
```

填入（参考 `.env.local.example`）：

```env
NEXT_PUBLIC_SUPABASE_URL=https://你的项目.supabase.co
SUPABASE_SERVICE_ROLE_KEY=你的service_role_key

ZHIPU_API_KEY=你的智谱Key
ZHIPU_AUTH=bearer
ZHIPU_MODEL=glm-5v-turbo

# 提交只入库，由运营台点「AI 初审」（避免多图同时打满 CPU/API）
AUTO_AGENT_ON_SUBMIT=false
# 凭证暂存更久，便于学生提交后教师端再初审
# MATERIAL_CACHE_TTL_SEC=600

# 生产勿开启；仅本地调试旧版 /home、/admin 等
# NEXT_PUBLIC_ENABLE_LEGACY_PORTAL=false

# 轻量服务器可用 Python，不要设 PDF_EXTRACT_DISABLE_PYTHON=1
# PDF_PYTHON=python3
```

保存后安装依赖并构建：

```bash
pip3 install -r requirements-pdf.txt
npm ci
npm run build
```

构建成功则：

```bash
npm start
# 临时测试：curl -I http://127.0.0.1:3000/
# Ctrl+C 停掉，改用 PM2
```

---

## 四、PM2 常驻运行

在 `/var/www/money-safety-portal` 下：

```bash
pm2 start npm --name money-portal -- start
pm2 save
pm2 startup
# 按提示执行 pm2 输出的 sudo 命令，实现开机自启
```

常用命令：

```bash
pm2 status
pm2 logs money-portal
pm2 restart money-portal
```

---

## 五、Nginx 反向代理

```bash
sudo nano /etc/nginx/sites-available/money-portal
```

写入（把 `你的域名或IP` 换成公网 IP 或域名）：

```nginx
server {
    listen 80;
    server_name 你的域名或IP;

    client_max_body_size 50m;

    # 流式 AI 初审：关闭缓冲，否则进度会卡在「准备审核」
    location /api/agent/review/stream {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        chunked_transfer_encoding on;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
    }
}
```

启用并重载：

```bash
sudo ln -sf /etc/nginx/sites-available/money-portal /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

浏览器访问：`http://你的公网IP/`（身份选择 → 学生端 / 教师端登录）

> `client_max_body_size 50m` 与 `proxy_read_timeout 300s` 便于压缩后的多图 JSON 上传与运营台 AI 初审；比 Vercel 免费档更宽松。

### 多图上传读不出 / 超时（常见）

| 现象 | 处理 |
|------|------|
| 提交 413 | 调大 Nginx `client_max_body_size`（建议 50m） |
| 提交超时 | 前端已自动压缩图片；确认 `SUBMISSION_JSON_TIMEOUT_MS=120000` |
| AI 读不出字 | 不要在学生提交时跑 Agent；流程：**/student/preaudit 提交 → /teacher/queue 点「AI 初审」** |
| 5 张图仍慢 | 正常：每张先识金额再主审；超过 3 张附图时其余走文本摘要 |
| 进度卡在「准备审核」 | Nginx 需对 `/api/agent/review/stream` 设置 `proxy_buffering off`（见上文配置） |

---

## 六、HTTPS（有域名且已备案时）

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your.domain.com
```

按提示选择强制 HTTPS。证书自动续期。

---

## 七、部署后自检

| # | 地址 | 预期 |
|---|------|------|
| 1 | `/` | 身份选择页正常；直接访问 `/home` 应回到 `/`（未开遗留开关时） |
| 2 | `/student/preaudit` | 学生登录后可上传并提交（约 30s 内返回） |
| 3 | `/teacher/queue` | 教师登录后可见队列，点 **AI 初审** 后风险分更新 |
| 4 | `/teacher/report/xxx` | 报告含风险分与表格 |
| 5 | `/teacher/queue` | 通过/驳回、审核记录正常 |
| 6 | `/teacher/rules` | 规则可保存 |

---

## 八、更新代码

```bash
cd /var/www/money-safety-portal
git pull origin main
npm ci
npm run build
pm2 restart money-portal
```

---

## 九、内存不足（2GB 构建失败）

构建 Next 时若 OOM，可临时加 swap：

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
npm run build
```

---

## 十、与 Vercel 对比（本项目的取舍）

| 能力 | 轻量服务器 | Vercel 免费 |
|------|------------|-------------|
| PyMuPDF | ✅ | ❌ |
| AI 长耗时请求 | ✅（Nginx/PM2 可配 300s） | ⚠️ 约 10s |
| 运维 | 需自己 SSH、更新 | 几乎零运维 |
| 费用 | 按量/包月（常有新用户优惠） | 个人免费 |

---

## 十一、安全提醒

- `SUPABASE_SERVICE_ROLE_KEY`、`ZHIPU_API_KEY` 只放在服务器 `.env.local`，不要写进仓库
- SSH 建议改用密钥登录，关闭密码登录（可选）
- 定期 `sudo apt upgrade` 打安全补丁
- Supabase 若在国内访问慢，属网络问题；可换离用户更近的 Supabase 区域或后续迁库

---

## 相关链接

- [腾讯云轻量应用服务器](https://cloud.tencent.com/product/lighthouse)
- [Supabase Dashboard](https://supabase.com/dashboard)
- 本仓库 [`DEPLOY_VERCEL.md`](./DEPLOY_VERCEL.md) — 免运维备选方案
