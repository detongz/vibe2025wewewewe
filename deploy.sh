#!/bin/bash

# 声记播客项目部署脚本

echo "🎙️ 声记播客项目部署中..."

# 服务器信息
SERVER_IP="124.220.31.71"
SERVER_USER="root"
REMOTE_DIR="/root/podcast-v2"

# 创建服务器目录
echo "📁 创建远程目录..."
ssh $SERVER_USER@$SERVER_IP "mkdir -p $REMOTE_DIR"

# 上传项目文件
echo "📤 上传项目文件..."
rsync -av --exclude='node_modules' --exclude='.next' --exclude='.git' ./ $SERVER_USER@$SERVER_IP:$REMOTE_DIR/

# 安装依赖
echo "📦 安装依赖..."
ssh $SERVER_USER@$SERVER_IP "cd $REMOTE_DIR && npm install --registry=https://registry.npmmirror.com"

# 构建项目
echo "🔨 构建项目..."
ssh $SERVER_USER@$SERVER_IP "cd $REMOTE_DIR && npm run build"

# 启动服务
echo "🚀 启动服务..."
ssh $SERVER_USER@$SERVER_IP "cd $REMOTE_DIR && nohup npm start > server.log 2>&1 & echo 'Service started'"

echo "✅ 部署完成！"
echo "🌐 访问地址: http://$SERVER_IP:8080"