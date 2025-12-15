# Ten 框架集成计划 - 实现实时语音交互

## 一、架构设计

### 整体架构
```
【娓语】前端 (Next.js)
     ↓ WebSocket
Ten 框架服务器 (中间层)
     ↓
Minimax API (TTS/ASR)
```

### Ten框架的作用
1. **实时音频流处理** - WebRTC双向音频传输
2. **音频流管理** - 编解码、混音、降噪
3. **打断控制** - 实时VAD检测，支持用户随时打断
4. **多模态处理** - 同时处理语音输入/输出
5. **协议转换** - WebSocket ↔ Minimax API

## 二、实施步骤

### Phase 1: Ten服务端搭建 (1-2天)

#### 1.1 创建Ten服务器项目
```bash
mkdir ten-podcast-server
cd ten-podcast-server

# 安装Ten框架
npm install @ten-framework/core @ten-framework/rtc
```

#### 1.2 Ten服务器核心文件
```
ten-podcast-server/
├── src/
│   ├── app.ts          # Ten应用入口
│   ├── extensions/
│   │   ├── minimax.ts  # Minimax集成扩展
│   │   ├── vad.ts      # 语音活动检测
│   │   └── audio.ts    # 音频处理
│   └── utils/
│       └── config.ts   # 配置文件
├── package.json
└── ten.json           # Ten配置文件
```

#### 1.3 Ten服务器基础代码
```typescript
// src/app.ts
import { TenRuntime } from '@ten-framework/core'
import { MinimaxExtension } from './extensions/minimax'
import { VADExtension } from './extensions/vad'
import { AudioExtension } from './extensions/audio'

const runtime = new TenRuntime({
  extensions: [
    new MinimaxExtension(),
    new VADExtension(),
    new AudioExtension()
  ]
})

runtime.start()
```

### Phase 2: Minimax集成 (1天)

#### 2.1 Minimax扩展实现
```typescript
// src/extensions/minimax.ts
import { Extension } from '@ten-framework/core'
import fetch from 'node-fetch'

export class MinimaxExtension extends Extension {
  private apiKey: string
  private groupId: string

  async onStart() {
    this.apiKey = process.env.MINIMAX_API_KEY
    this.groupId = process.env.MINIMAX_GROUP_ID
  }

  async handleTextToSpeech(text: string, voice: string) {
    const response = await fetch('https://api.minimax.chat/v1/tts_pro', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'X-GroupId': this.groupId
      },
      body: JSON.stringify({
        model: 'speech-01-pro',
        text: text,
        voice_id: voice,
        speed: 1.0
      })
    })

    return response.json()
  }

  async handleSpeechToText(audioData: Buffer) {
    // 调用Minimax的ASR接口
    const response = await fetch('https://api.minimax.chat/v1/asr', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'X-GroupId': this.groupId
      },
      body: JSON.stringify({
        audio: audioData.toString('base64')
      })
    })

    return response.json()
  }
}
```

### Phase 3: VAD打断控制 (1天)

#### 3.1 实现语音活动检测
```typescript
// src/extensions/vad.ts
import { Extension } from '@ten-framework/core'
import vad from 'voice-activity-detection'

export class VADExtension extends Extension {
  private isSpeaking = false
  private canInterrupt = true

  async onAudioFrame(audioFrame: Float32Array) {
    const voiceProbability = await vad(audioFrame)

    if (voiceProbability > 0.5) {
      // 检测到语音
      this.isSpeaking = true

      // 如果正在播放AI声音，检测到用户语音则打断
      if (this.isPlaying && this.canInterrupt) {
        this.emit('interrupt')
        this.stopPlaying()
      }
    } else {
      this.isSpeaking = false
    }
  }
}
```

### Phase 4: 前端集成 (1-2天)

#### 4.1 创建Ten客户端SDK
```typescript
// src/lib/ten-client.ts
class TenClient {
  private ws: WebSocket
  private mediaStream: MediaStream
  private audioContext: AudioContext

  constructor(serverUrl: string) {
    this.ws = new WebSocket(serverUrl)
    this.setupWebSocket()
  }

  async connect() {
    // 建立WebRTC连接
    await this.setupWebRTC()
  }

  async startRecording() {
    // 开始实时音频流传输
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true
      }
    })

    // 通过Ten框架发送音频流
    this.sendAudioStream(this.mediaStream)
  }

  async stopRecording() {
    this.mediaStream.getTracks().forEach(track => track.stop())
  }

  async sendText(text: string) {
    // 发送文本到Ten框架进行TTS
    this.ws.send(JSON.stringify({
      type: 'text_to_speech',
      data: text
    }))
  }

  private setupWebSocket() {
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      this.handleMessage(message)
    }
  }
}
```

#### 4.2 更新主页面
```typescript
// src/app/page.tsx (更新部分)
import { TenClient } from '@/lib/ten-client'

export default function Home() {
  const [tenClient, setTenClient] = useState<TenClient | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    // 初始化Ten客户端
    const client = new TenClient('ws://localhost:3001')
    client.connect().then(() => {
      setIsConnected(true)
      setTenClient(client)
    })
  }, [])

  const startRecording = async () => {
    if (!tenClient) return

    setIsRecording(true)
    await tenClient.startRecording()
  }

  const stopRecording = async () => {
    if (!tenClient) return

    await tenClient.stopRecording()
    setIsRecording(false)
  }
}
```

### Phase 5: 实时对话优化 (2天)

#### 5.1 实现低延迟TTS
```typescript
// Ten服务器端优化
async function streamTTS(text: string) {
  // 使用Minimax的流式TTS
  const response = await fetch('https://api.minimax.chat/v1/tts_stream', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text })
  })

  // 流式返回音频数据
  const reader = response.body.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    // 实时发送音频到前端
    this.sendAudioChunk(value)
  }
}
```

## 三、部署方案

### 3.1 服务器部署架构
```
Server (124.220.31.71)
├── Port 80: Next.js前端
├── Port 3001: Ten框架服务器
└── Port 5000: 原有API服务（可选）
```

### 3.2 Docker部署（推荐）
```dockerfile
# ten-server/Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

### 3.3 部署脚本
```bash
#!/bin/bash
# deploy-ten.sh

# 构建Ten服务器
cd ten-podcast-server
npm run build
docker build -t ten-podcast-server .
docker run -d -p 3001:3001 --name ten-server ten-podcast-server

# 重启前端
cd ../podcast-v2
pm2 restart podcast-app
```

## 四、功能清单

### 实时功能
- [x] 实时语音输入
- [x] 实时TTS输出
- [x] VAD打断检测
- [x] 低延迟音频流
- [x] 音频编解码

### 离线功能
- [x] 语音录制和保存
- [x] 批量音频处理
- [x] 播客生成
- [x] 音频导出

### 用户体验
- [x] 无需等待的实时交互
- [x] 自然流畅的对话
- [x] 高质量的合成语音
- [x] 稳定的连接

## 五、时间线

- Day 1-2: Ten服务器搭建和基础配置
- Day 3: Minimax API集成测试
- Day 4: VAD和打断控制实现
- Day 5-6: 前端集成和测试
- Day 7: 部署和性能优化

## 六、预期效果

1. **延迟 < 500ms** - 从说话到听到AI回复
2. **打断响应 < 100ms** - 用户说话时立即停止AI输出
3. **音频质量** - 16kHz采样率，清晰人声
4. **稳定性** - 99%的连接成功率

## 七、备选方案

如果Ten框架集成困难，可以使用：
1. **Socket.IO + Web Audio API** - 简化版实时语音
2. **Janus WebRTC Server** - 开源的WebRTC网关
3. **直接WebSocket传输音频** - 最小化实现