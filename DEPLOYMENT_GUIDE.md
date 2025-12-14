# 播客应用 V2 部署指南（80端口）

## 部署步骤

### 方式一：使用服务器脚本直接部署（推荐）

1. **连接到服务器**
   ```bash
   ssh root@YOUR_SERVER_IP
   ```

2. **创建并运行部署脚本**
   ```bash
   # 在服务器上执行
   curl -fsSL https://raw.githubusercontent.com/your-repo/podcast-v2/main/server-deploy.sh -o deploy.sh
   chmod +x deploy.sh
   ./deploy.sh
   ```

### 方式二：手动部署

1. **创建项目目录**
   ```bash
   mkdir -p /root/podcast-v2
   cd /root/podcast-v2
   ```

2. **配置 npm 源**
   ```bash
   npm config set registry https://mirrors.tuna.tsinghua.edu.cn/npm/
   ```

3. **创建 package.json**
   ```json
   {
     "name": "podcast-v2",
     "version": "0.1.0",
     "private": true,
     "scripts": {
       "dev": "next dev -p 80",
       "build": "next build",
       "start": "next start -p 80",
       "lint": "next lint"
     },
     "dependencies": {
       "next": "14.2.5",
       "react": "^18",
       "react-dom": "^18",
       "@radix-ui/react-dialog": "^1.0.5",
       "@radix-ui/react-progress": "^1.0.3",
       "@radix-ui/react-slider": "^1.1.2",
       "@radix-ui/react-toast": "^1.1.5",
       "framer-motion": "^11.0.8",
       "lucide-react": "^0.363.0",
       "class-variance-authority": "^0.7.0",
       "clsx": "^2.1.0",
       "tailwind-merge": "^2.2.1"
     },
     "devDependencies": {
       "typescript": "^5",
       "@types/node": "^20",
       "@types/react": "^18",
       "@types/react-dom": "^18",
       "postcss": "^8",
       "tailwindcss": "^3.4.1",
       "eslint": "^8",
       "eslint-config-next": "14.2.5"
     }
   }
   ```

4. **安装依赖**
   ```bash
   npm install
   ```

5. **构建项目**
   ```bash
   npm run build
   ```

6. **安装 pm2**
   ```bash
   npm install -g pm2
   ```

7. **启动服务**
   ```bash
   pm2 start npm --name "podcast-v2" -- start
   pm2 save
   pm2 startup
   ```

## 验证部署

1. **检查服务状态**
   ```bash
   pm2 status
   ```

2. **检查端口占用**
   ```bash
   netstat -tlnp | grep :80
   ```

3. **查看日志**
   ```bash
   pm2 logs podcast-v2
   ```

4. **在浏览器访问**
   ```
   http://YOUR_SERVER_IP
   ```

## 常用命令

- 重启服务：`pm2 restart podcast-v2`
- 停止服务：`pm2 stop podcast-v2`
- 查看日志：`pm2 logs podcast-v2`
- 监控资源：`pm2 monit`

## 注意事项

1. 确保 80 端口未被其他服务占用
2. 如果遇到权限问题，可能需要使用 sudo 运行命令
3. 防火墙需要允许 80 端口的访问
4. 建议定期备份项目文件