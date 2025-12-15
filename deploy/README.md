# 部署指南

## 项目结构重构

项目已经按照以下结构进行重构：

```
podcast-v2/
├── deploy/                 # 部署相关文件
│   ├── nginx/             # Nginx配置文件
│   │   └── podcast-v2.conf
│   ├── *.sh               # 部署脚本
│   └── *.md               # 部署文档
├── app/                   # 前端应用（Next.js）
│   └── (保持原有src/app结构)
├── backend/               # 后端服务（预留）
└── src/                   # 原有源代码（保持兼容）
```

## Nginx配置使用

### 1. 安装Nginx
```bash
# Ubuntu/Debian
sudo apt update && sudo apt install nginx

# CentOS/RHEL
sudo yum install nginx

# OpenCloudOS
sudo yum install nginx-core
```

### 2. 配置Nginx
将 `deploy/nginx/podcast-v2.conf` 复制到Nginx配置目录：
```bash
sudo cp deploy/nginx/podcast-v2.conf /etc/nginx/conf.d/
```

### 3. 修改配置
编辑配置文件，更新以下内容：
- `server_name`: 替换为您的域名或IP地址
- `alias`路径: 更新为实际的静态文件路径
- 端口号: 确保与您的服务端口匹配

### 4. 测试并重启Nginx
```bash
sudo nginx -t
sudo systemctl restart nginx
```

## 部署脚本

### 主要部署脚本：
- `deploy.sh` - 完整部署脚本
- `quick-deploy.sh` - 快速部署
- `server-deploy.sh` - 服务器部署
- `deploy-ten-server.sh` - Ten服务部署

### 使用示例：
```bash
# 完整部署
bash deploy/deploy.sh

# 只部署Ten服务
bash deploy/deploy-ten-server.sh
```

## 环境要求

- Node.js 18+
- Nginx
- PM2 (进程管理)
- Ten服务 (实时语音)

## 端口配置

- **80端口**: Nginx反向代理
- **3000端口**: Next.js开发服务器
- **3001端口**: Ten WebSocket服务

## 注意事项

1. 确保防火墙开放相应端口
2. 配置正确的环境变量
3. 定期检查日志文件
4. 使用HTTPS时更新SSL配置

## 故障排除

常见问题：
1. **502错误**: 检查后端服务是否运行
2. **权限问题**: 确保Nginx有访问权限
3. **端口冲突**: 检查端口占用情况

查看日志：
```bash
# Nginx错误日志
sudo tail -f /var/log/nginx/error.log

# Nginx访问日志
sudo tail -f /var/log/nginx/access.log

# 应用日志
pm2 logs
