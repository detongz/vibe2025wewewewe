#!/bin/bash

# 在服务器上直接创建声记播客项目

echo "🎙️ 在服务器上创建声记播客项目..."

# 创建目录
mkdir -p /root/podcast-v2
cd /root/podcast-v2

# 创建package.json
cat > package.json << 'EOF'
{
  "name": "voice-podcast",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 8080",
    "build": "next build",
    "start": "next start -p 8080"
  },
  "dependencies": {
    "next": "14.2.5",
    "react": "^18",
    "react-dom": "^18",
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
    "tailwindcss": "^3.4.1"
  }
}
EOF

# 创建next.config.mjs
cat > next.config.mjs << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  }
}

export default nextConfig
EOF

# 创建tsconfig.json
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
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
EOF

# 创建tailwind.config.ts
cat > tailwind.config.ts << 'EOF'
import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
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

# 创建目录结构
mkdir -p src/app src/lib

# 创建src/lib/utils.ts
cat > src/lib/utils.ts << 'EOF'
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
EOF

# 创建src/app/globals.css
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
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.75rem;
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

/* 自定义滚动条 */
.scrollbar-thin {
  scrollbar-width: thin;
}

.scrollbar-thumb-purple-600 {
  scrollbar-color: rgb(147 51 234) transparent;
}

.scrollbar-track-transparent {
  scrollbar-color: transparent transparent;
}

/* Webkit浏览器滚动条 */
.scrollbar-thin::-webkit-scrollbar {
  width: 6px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}

.scrollbar-thumb-purple-600::-webkit-scrollbar-thumb {
  background-color: rgb(147 51 234);
  border-radius: 3px;
}
EOF

# 创建src/app/layout.tsx
cat > src/app/layout.tsx << 'EOF'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '声记 - AI语音播客编导',
  description: '把你的故事变成专业的播客，只需3段录音',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
EOF

# 创建简化版页面（本地模拟）
cat > src/app/page.tsx << 'EOF'
'use client'

import { useState, useRef, useEffect } from 'react'
import { Mic, MicOff, Download, Share2, Sparkles, Waves, Headphones } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  audioUrl?: string
  timestamp: Date
}

export default function Home() {
  const [isRecording, setIsRecording] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [podcastUrl, setPodcastUrl] = useState<string | null>(null)
  const [podcastScript, setPodcastScript] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const steps = [
    "我们不需要一个完整故事。就说最近一次，你突然觉得'有点不对劲'的时候。你想到的第一个画面是什么？",
    "你能带我回到那个瞬间吗？当时具体发生了什么？",
    "如果现在回头看那一刻，你会怎么形容当时的自己？"
  ]

  useEffect(() => {
    setMessages([{
      id: '1',
      role: 'assistant',
      content: '你好，我是你的AI语音播客编导。让我们开始吧！',
      timestamp: new Date()
    }])
  }, [])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data)
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
        const audioUrl = URL.createObjectURL(audioBlob)

        const userMessage: Message = {
          id: Date.now().toString(),
          role: 'user',
          content: '[录音完成]',
          audioUrl,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, userMessage])

        setTimeout(() => {
          if (currentStep < 3) {
            const aiMessage: Message = {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: steps[currentStep],
              timestamp: new Date()
            }
            setMessages(prev => [...prev, aiMessage])
            setCurrentStep(prev => prev + 1)
          } else {
            generatePodcast()
          }
        }, 1000)

        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (err) {
      console.error('Error accessing microphone:', err)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const generatePodcast = () => {
    setIsProcessing(true)

    setTimeout(() => {
      const script = '【旁白】\\n每个人都有一个难忘的瞬间。\\n\\n【用户原声】\\n"那天晚上我站在公司楼下，一直没进去。"\\n\\n【旁白】\\n这就是今天的故事。'

      setPodcastScript(script)
      setPodcastUrl('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3')
      setIsProcessing(false)
    }, 3000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8 max-w-4xl">
        <header className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Headphones className="w-10 h-10 text-purple-400" />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              声记
            </h1>
          </div>
          <p className="text-xl text-gray-300">AI语音播客编导，把你的故事变成声音</p>
        </header>

        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 mb-8 h-96 overflow-y-auto">
          <div className="space-y-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                )}
                <div className={`max-w-md rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                    : 'bg-gray-800 text-gray-100'
                }`}>
                  {message.audioUrl && (
                    <audio controls className="w-full mb-2 h-8" src={message.audioUrl}>
                      您的浏览器不支持音频播放
                    </audio>
                  )}
                  <p className="text-sm">{message.content}</p>
                </div>
                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                    <Waves className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {podcastUrl && (
          <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-sm rounded-2xl p-6 mb-8">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-purple-400" />
              你的播客
            </h3>
            <audio controls className="w-full mb-4" src={podcastUrl}>
              您的浏览器不支持音频播放
            </audio>
            <div className="flex gap-3">
              <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg">
                <Share2 className="w-4 h-4" />
                分享
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
                <Download className="w-4 h-4" />
                下载
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-center">
          {!podcastUrl && (
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              disabled={isProcessing}
              className={`w-24 h-24 rounded-full flex items-center justify-center transition-all transform hover:scale-105 ${
                isRecording
                  ? 'bg-red-500 animate-pulse shadow-lg shadow-red-500/50'
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:shadow-lg hover:shadow-purple-500/50'
              } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isRecording ? (
                <MicOff className="w-10 h-10 text-white" />
              ) : (
                <Mic className="w-10 h-10 text-white" />
              )}
            </button>
          )}
        </div>

        <div className="text-center mt-4 text-gray-400">
          {isRecording ? '松开结束录音' : isProcessing ? '正在生成播客...' : '按住录音'}
        </div>
      </div>
    </div>
  )
}
EOF

# 创建postcss.config.js
cat > postcss.config.js << 'EOF'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOF

echo "✅ 项目文件创建完成！"

# 安装依赖
echo "📦 安装依赖..."
npm install --registry=https://registry.npmmirror.com

# 构建项目
echo "🔨 构建项目..."
npm run build

# 启动服务
echo "🚀 启动服务..."
nohup npm start > server.log 2>&1 &

echo "✅ 声记播客已成功部署！"
echo "🌐 访问地址: http://$(curl -s ifconfig.me):8080"