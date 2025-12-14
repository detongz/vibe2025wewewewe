#!/bin/bash

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 服务器配置（需要根据实际情况修改）
SERVER_IP="YOUR_SERVER_IP"
SERVER_USER="root"

echo -e "${YELLOW}开始部署播客应用到服务器 80 端口...${NC}"

# 1. 创建服务器目录
echo -e "${GREEN}[1/7] 创建服务器目录 /root/podcast-v2...${NC}"
ssh $SERVER_USER@$SERVER_IP "mkdir -p /root/podcast-v2"

# 2. 上传项目文件
echo -e "${GREEN}[2/7] 上传项目文件到服务器...${NC}"
rsync -avz --exclude='node_modules' --exclude='.next' --exclude='.git' \
  ./ $SERVER_USER@$SERVER_IP:/root/podcast-v2/

# 3. 配置清华 npm 源
echo -e "${GREEN}[3/7] 配置清华 npm 源...${NC}"
ssh $SERVER_USER@$SERVER_IP "cd /root/podcast-v2 && npm config set registry https://mirrors.tuna.tsinghua.edu.cn/npm/"

# 4. 安装依赖
echo -e "${GREEN}[4/7] 安装项目依赖...${NC}"
ssh $SERVER_USER@$SERVER_IP "cd /root/podcast-v2 && npm install"

# 5. 构建项目
echo -e "${GREEN}[5/7] 构建项目...${NC}"
ssh $SERVER_USER@$SERVER_IP "cd /root/podcast-v2 && npm run build"

# 6. 安装 pm2（如果未安装）
echo -e "${GREEN}[6/7] 检查并安装 pm2...${NC}"
ssh $SERVER_USER@$SERVER_IP "npm list -g pm2 || npm install -g pm2"

# 7. 使用 pm2 启动项目
echo -e "${GREEN}[7/7] 使用 pm2 启动项目在 80 端口...${NC}"
ssh $SERVER_USER@$SERVER_IP "cd /root/podcast-v2 && pm2 delete podcast-v2 2>/dev/null; pm2 start npm --name 'podcast-v2' -- start"

# 8. 保存 pm2 配置
ssh $SERVER_USER@$SERVER_IP "pm2 save"
ssh $SERVER_USER@$SERVER_IP "pm2 startup"

echo -e "${YELLOW}部署完成！${NC}"
echo -e "${GREEN}检查服务状态：${NC}"
ssh $SERVER_USER@$SERVER_IP "pm2 status"
echo -e "${GREEN}检查服务日志：${NC}"
ssh $SERVER_USER@$SERVER_IP "pm2 logs podcast-v2 --lines 20"

echo -e "${YELLOW}请在浏览器中访问 http://$SERVER_IP 查看应用${NC}"