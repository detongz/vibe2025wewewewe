#!/bin/bash

# 播客应用 V2 快速部署脚本
# 在服务器上以 root 用户执行此脚本

set -e

echo "===================================="
echo "播客应用 V2 部署开始（80端口）"
echo "===================================="

# 1. 创建目录
echo "1. 创建项目目录..."
mkdir -p /root/podcast-v2
cd /root/podcast-v2

# 2. 配置 npm 源为清华镜像
echo "2. 配置 npm 源..."
npm config set registry https://mirrors.tuna.tsinghua.edu.cn/npm/

# 3. 创建 package.json
echo "3. 创建 package.json..."
cat > package.json << 'PACKAGE_EOF'
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
PACKAGE_EOF

# 4. 创建 .npmrc
echo "4. 创建 .npmrc..."
cat > .npmrc << 'NPMRC_EOF'
registry=https://mirrors.tuna.tsinghua.edu.cn/npm/
NPMRC_EOF

# 5. 创建 next.config.mjs
echo "5. 创建 next.config.mjs..."
cat > next.config.mjs << 'NEXT_EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  port: 80,
}

export default nextConfig
NEXT_EOF

# 6. 创建 tsconfig.json
echo "6. 创建 tsconfig.json..."
cat > tsconfig.json << 'TS_EOF'
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "es6"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
TS_EOF

# 7. 创建目录结构
echo "7. 创建目录结构..."
mkdir -p src/app
mkdir -p src/components/ui
mkdir -p src/lib

# 8. 创建必要的配置文件
echo "8. 创建配置文件..."

# tailwind.config.ts
cat > tailwind.config.ts << 'TAILWIND_EOF'
import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
}
export default config
TAILWIND_EOF

# postcss.config.js
cat > postcss.config.js << 'POSTCSS_EOF'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
POSTCSS_EOF

# 9. 创建基础应用文件
echo "9. 创建应用文件..."

# src/app/layout.tsx
cat > src/app/layout.tsx << 'LAYOUT_EOF'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '播客平台 V2',
  description: '现代化的播客分享平台',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
LAYOUT_EOF

# src/app/globals.css
cat > src/app/globals.css << 'CSS_EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96%;
    --secondary-foreground: 222.2 84% 4.9%;
    --muted: 210 40% 96%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96%;
    --accent-foreground: 222.2 84% 4.9%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
CSS_EOF

# src/app/page.tsx
cat > src/app/page.tsx << 'PAGE_EOF'
'use client'

import { useState } from 'react'
import { Play, Pause, Volume2 } from 'lucide-react'

export default function Home() {
  const [isPlaying, setIsPlaying] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-12 text-gray-800">
          播客平台 V2 - 成功部署！
        </h1>

        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="aspect-video bg-gradient-to-br from-purple-400 to-pink-400 rounded-lg mb-6 flex items-center justify-center">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-20 h-20 bg-white bg-opacity-90 rounded-full flex items-center justify-center hover:bg-opacity-100 transition-all"
            >
              {isPlaying ? (
                <Pause className="w-8 h-8 text-purple-600" />
              ) : (
                <Play className="w-8 h-8 text-purple-600 ml-1" />
              )}
            </button>
          </div>

          <h2 className="text-2xl font-semibold mb-4">欢迎访问播客平台</h2>
          <p className="text-gray-600 mb-6">
            应用已成功部署在服务器的 80 端口上。这是一个使用 Next.js 14 + TypeScript 构建的现代化播客平台。
          </p>

          <div className="bg-gray-100 rounded-lg p-4">
            <h3 className="font-semibold mb-2">部署信息：</h3>
            <ul className="space-y-1 text-sm text-gray-600">
              <li>✅ 端口：80</li>
              <li>✅ 框架：Next.js 14</li>
              <li>✅ 类型：TypeScript</li>
              <li>✅ 进程管理：PM2</li>
            </ul>
          </div>
        </div>

        <p className="text-center mt-8 text-gray-600">
          部署时间: $(date)
        </p>
      </div>
    </div>
  )
}
PAGE_EOF

# src/lib/utils.ts
cat > src/lib/utils.ts << 'UTILS_EOF'
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
UTILS_EOF

# 10. 安装依赖
echo "10. 安装项目依赖..."
npm install

# 11. 构建项目
echo "11. 构建项目..."
npm run build

# 12. 安装 pm2（如果未安装）
echo "12. 检查并安装 pm2..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi

# 13. 使用 pm2 启动服务
echo "13. 使用 pm2 启动服务..."
# 停止旧进程
pm2 delete podcast-v2 2>/dev/null || true
# 启动新进程
pm2 start npm --name "podcast-v2" -- start
pm2 save
pm2 startup

echo ""
echo "===================================="
echo "部署完成！"
echo "===================================="
echo ""
echo "检查服务状态："
pm2 status
echo ""
echo "检查端口占用："
netstat -tlnp | grep :80 || ss -tlnp | grep :80
echo ""
echo "服务日志："
pm2 logs podcast-v2 --lines 10
echo ""
echo "🎉 播客应用已成功部署在 80 端口！"
echo "请通过浏览器访问：http://$(curl -s ifconfig.me)"
echo ""
echo "常用命令："
echo "- 查看状态: pm2 status"
echo "- 查看日志: pm2 logs podcast-v2"
echo "- 重启服务: pm2 restart podcast-v2"
echo "- 停止服务: pm2 stop podcast-v2"