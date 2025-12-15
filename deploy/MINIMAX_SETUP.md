# Minimax TTS 集成指南

## 概述
本项目已集成 Minimax 的 TTS（文本转语音）服务，用于生成播客的旁白部分。

## 配置步骤

### 1. 获取 Minimax API Key
1. 访问 [Minimax 控制台](https://api.minimax.chat/)
2. 注册并登录
3. 创建应用并获取 API Key

### 2. 配置环境变量
在项目根目录的 `.env.local` 文件中添加：

```env
# Minimax API Key
MINIMAX_API_KEY=your_api_key_here

# Next.js Base URL
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 3. 启动项目
```bash
npm run dev
# 或
yarn dev
```

## API 使用说明

### TTS API - `/api/tts`
支持将文本转换为语音。

**请求方式**: POST

**请求参数**:
```json
{
  "text": "要转换的文本",
  "voice": "male-qn-jingying",  // 可选，音色ID
  "emotion": "happy",          // 可选，情感
  "speed": 1.0                // 可选，语速
}
```

**返回**:
```json
{
  "audio_base64": "base64编码的音频数据",
  "request_id": "请求ID"
}
```

**支持的音色**:
- `male-qn-qingse`: 青涩男声
- `male-qn-jingying`: 精英男声（推荐用于旁白）
- `male-qn-badao`: 霸道男声
- `male-qn-daxuesheng`: 大学生男声
- `female-qn-jingying`: 精英女声
- `female-qn-mane`: 暖心女声
- `female-qn-daxuesheng`: 大学生女声

### 播客生成 API - `/api/podcast/generate`
根据用户的录音转录生成完整的播客。

**请求方式**: POST

**请求参数**:
```json
{
  "transcripts": ["转录文本1", "转录文本2", "转录文本3"],
  "audioUrls": ["音频URL1", "音频URL2", "音频URL3"]
}
```

**返回**:
```json
{
  "podcast": {
    "title": "播客标题",
    "script": "完整的播客文案",
    "timeline": [...],  // 音频时间线
    "duration": 30,     // 总时长
    "narration_count": 3,  // 旁白数量
    "user_clip_count": 3   // 用户录音数量
  }
}
```

## 工作流程

1. 用户录制3段语音
2. 语音被转录为文字（当前为模拟转录）
3. 系统生成播客脚本（硬编码示例）
4. 调用 Minimax TTS 生成旁白音频
5. 组合用户录音和旁白音频
6. 返回完整的播客数据

## 注意事项

1. **API 配额**: Minimax TTS 有使用限制，请注意控制调用频率
2. **错误处理**: 系统已实现降级机制，如果 TTS 失败会使用备用方案
3. **音频格式**: 当前返回 MP3 格式的音频
4. **性能考虑**: TTS 生成需要时间，已添加加载提示

## 测试方法

1. 完成配置后，录制3段语音
2. 点击生成播客
3. 查看控制台日志确认 TTS 调用
4. 播放生成的播客

## 故障排除

1. **API Key 错误**: 检查 `.env.local` 中的 MINIMAX_API_KEY
2. **网络问题**: 确保可以访问 Minimax API
3. **音频无法播放**: 检查返回的 base64 数据是否完整

## 扩展功能

未来可以扩展的功能：
- 支持更多音色和情感
- 实现真实的语音转文字（ASR）
- 集成 GPT-4 生成个性化脚本
- 添加背景音乐
- 支持音频编辑和导出