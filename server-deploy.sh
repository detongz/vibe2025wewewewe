#!/bin/bash

# 服务器端部署脚本
# 在服务器上直接执行此脚本

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}开始部署播客应用到服务器 80 端口...${NC}"

# 1. 创建目录
echo -e "${GREEN}[1/6] 创建目录 /root/podcast-v2...${NC}"
mkdir -p /root/podcast-v2
cd /root/podcast-v2

# 2. 配置清华 npm 源
echo -e "${GREEN}[2/6] 配置清华 npm 源...${NC}"
npm config set registry https://mirrors.tuna.tsinghua.edu.cn/npm/

# 3. 创建项目文件
echo -e "${GREEN}[3/6] 创建项目文件...${NC}"

# package.json
cat > package.json << 'EOF'
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
EOF

# next.config.mjs
cat > next.config.mjs << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  port: 80,
}

export default nextConfig
EOF

# tsconfig.json
cat > tsconfig.json << 'EOF'
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
EOF

# 创建 src 目录结构
mkdir -p src/app
mkdir -p src/components/ui
mkdir -p src/lib

# 创建基本的应用结构
cat > src/app/layout.tsx << 'EOF'
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
EOF

cat > src/app/page.tsx << 'EOF'
'use client'

import { useState } from 'react'
import { Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'

export default function Home() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState([50])
  const [progress, setProgress] = useState([30])

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-12 text-gray-800">
          欢迎来到播客平台 V2
        </h1>

        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="aspect-video bg-gradient-to-br from-purple-400 to-pink-400 rounded-lg mb-6"></div>

          <h2 className="text-2xl font-semibold mb-4">示例播客节目</h2>

          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <Button
                size="lg"
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-12 h-12 rounded-full"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
              </Button>

              <SkipBack className="w-6 h-6 text-gray-600 cursor-pointer" />
              <SkipForward className="w-6 h-6 text-gray-600 cursor-pointer" />

              <div className="flex-1 flex items-center space-x-3">
                <span className="text-sm text-gray-500">1:23</span>
                <Slider
                  value={progress}
                  onValueChange={setProgress}
                  className="flex-1"
                />
                <span className="text-sm text-gray-500">4:56</span>
              </div>

              <div className="flex items-center space-x-2">
                <Volume2 className="w-5 h-5 text-gray-600" />
                <Slider
                  value={volume}
                  onValueChange={setVolume}
                  max={100}
                  step={1}
                  className="w-24"
                />
              </div>
            </div>
          </div>
        </div>

        <p className="text-center mt-8 text-gray-600">
          应用已成功部署在 80 端口！
        </p>
      </div>
    </div>
  )
}
EOF

cat > src/app/globals.css << 'EOF'
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
EOF

# 创建 UI 组件
cat > src/components/ui/button.tsx << 'EOF'
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
EOF

cat > src/components/ui/slider.tsx << 'EOF'
"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"
import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center",
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
      <SliderPrimitive.Range className="absolute h-full bg-primary" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
EOF

cat > src/lib/utils.ts << 'EOF'
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
EOF

# tailwind.config.ts
cat > tailwind.config.ts << 'EOF'
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
EOF

# postcss.config.js
cat > postcss.config.js << 'EOF'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOF

# .npmrc
cat > .npmrc << 'EOF'
registry=https://mirrors.tuna.tsinghua.edu.cn/npm/
EOF

# 4. 安装依赖
echo -e "${GREEN}[4/6] 安装项目依赖...${NC}"
npm install

# 5. 构建项目
echo -e "${GREEN}[5/6] 构建项目...${NC}"
npm run build

# 6. 安装并使用 pm2 启动
echo -e "${GREEN}[6/6] 安装 pm2 并启动服务...${NC}"

# 检查是否已安装 pm2
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi

# 停止旧进程（如果存在）
pm2 delete podcast-v2 2>/dev/null

# 启动新进程
pm2 start npm --name "podcast-v2" -- start

# 保存 pm2 配置
pm2 save
pm2 startup

echo -e "${YELLOW}部署完成！${NC}"
echo -e "${GREEN}服务状态：${NC}"
pm2 status

echo -e "${GREEN}检查服务是否运行在 80 端口：${NC}"
netstat -tlnp | grep :80

echo -e "${YELLOW}播客应用已成功部署在 80 端口！${NC}"
echo -e "${GREEN}查看日志： pm2 logs podcast-v2${NC}"
echo -e "${GREEN}重启服务： pm2 restart podcast-v2${NC}"
echo -e "${GREEN}停止服务： pm2 stop podcast-v2${NC}"