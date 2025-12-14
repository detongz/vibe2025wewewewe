#!/bin/bash

# 一键部署更新版本

echo "🚀 部署更新的播客应用到服务器..."

# SSH命令（请直接复制执行）
echo "请在终端中执行以下命令："
echo ""
echo "ssh root@124.220.31.71 'cd /root/podcast-v2 && pm2 stop podcast-v2 && npm install && npm run build && pm2 start \"npm run dev\" --name podcast-v2'"
echo ""
echo "或者使用完整部署脚本："
echo "ssh root@124.220.31.71"
echo "cd /root/podcast-v2"
echo "pm2 stop podcast-v2"
echo "npm install"
echo "npm run build"
echo "pm2 start \"npm run dev\" --name podcast-v2"
echo "pm2 status"
echo ""
echo "部署后访问: http://124.220.31.71"