#!/bin/bash

echo "🚀 开始部署【娓语】项目..."

# 1. 进入项目目录
cd /root/vibe2025wewewewe

# 2. 拉取最新代码
echo "📥 拉取最新代码..."
git pull origin main

# 3. 安装依赖
echo "📦 安装依赖..."
npm install

# 4. 构建项目
echo "🔨 构建项目..."
npm run build

# 5. 停止旧进程
echo "⏹️ 停止旧进程..."
pm2 delete podcast-app || true

# 6. 启动新进程
echo "▶️ 启动新进程..."
pm2 start npm --name "podcast-app" -- start -- -p 80

# 7. 保存PM2配置
pm2 save

# 8. 显示状态
echo "📊 运行状态："
pm2 status

echo "✅ 部署完成！"
echo "🌐 访问地址：http://124.220.31.71"
echo "🧪 TTS测试页面：http://124.220.31.71/tts-test"