import asyncio
import json
import logging
import os
from typing import Dict, Any

import websockets
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import uvicorn

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 环境变量
MINIMAX_API_KEY = os.getenv("MINIMAX_API_KEY")
MINIMAX_GROUP_ID = os.getenv("MINIMAX_GROUP_ID")
MINIMAX_API_BASE = "https://api.minimax.chat/v1"

# 支持的TTS模型
SUPPORTED_MODELS = [
    "speech-2.6-hd",
    "speech-2.6-turbo",
    "speech-02-hd",
    "speech-02-turbo"
]

# 支持的音色
SUPPORTED_VOICES = [
    "male-qn-jingying",
    "male-qn-qingse",
    "male-qn-badao",
    "female-qn-jingying",
    "female-qn-mane"
]

class TTSRequest(BaseModel):
    text: str
    voice: str = "male-qn-jingying"
    model: str = "speech-02-turbo"
    speed: float = 1.0
    volume: float = 1.0
    pitch: float = 0
    emotion: str = "neutral"

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        logger.info(f"Client {client_id} connected")

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            logger.info(f"Client {client_id} disconnected")

    async def send_personal_message(self, message: str, client_id: str):
        if client_id in self.active_connections:
            await self.active_connections[client_id].send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections.values():
            await connection.send_text(message)

manager = ConnectionManager()

async def call_minimax_tts(request: TTSRequest) -> Dict[str, Any]:
    """调用Minimax TTS API"""
    if not MINIMAX_API_KEY or not MINIMAX_GROUP_ID:
        return {"error": "Minimax API credentials not configured"}
    
    if request.model not in SUPPORTED_MODELS:
        return {"error": f"Unsupported model. Supported models: {SUPPORTED_MODELS}"}
    
    if request.voice not in SUPPORTED_VOICES:
        return {"error": f"Unsupported voice. Supported voices: {SUPPORTED_VOICES}"}

    headers = {
        "Authorization": f"Bearer {MINIMAX_API_KEY}",
        "Content-Type": "application/json",
        "X-GroupId": MINIMAX_GROUP_ID
    }

    payload = {
        "model": request.model,
        "text": request.text,
        "voice_id": request.voice,
        "speed": request.speed,
        "vol": request.volume,
        "pitch": request.pitch,
        "emotion": request.emotion
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{MINIMAX_API_BASE}/tts",
                headers=headers,
                json=payload,
                timeout=30.0
            )
            
            if response.status_code == 200:
                return {"success": True, "audio_data": response.content}
            else:
                error_data = response.json()
                return {"error": f"Minimax API error: {error_data.get('error', 'Unknown error')}"}
    
    except Exception as e:
        logger.error(f"Error calling Minimax TTS: {str(e)}")
        return {"error": f"Failed to call Minimax TTS: {str(e)}"}

@app.websocket("/ws/tts/{client_id}")
async def websocket_tts(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    try:
        while True:
            # 接收客户端消息
            data = await websocket.receive_text()
            
            try:
                request_data = json.loads(data)
                tts_request = TTSRequest(**request_data)
                
                # 调用Minimax TTS
                result = await call_minimax_tts(tts_request)
                
                # 发送结果回客户端
                await manager.send_personal_message(json.dumps(result), client_id)
                
            except json.JSONDecodeError:
                error_msg = {"error": "Invalid JSON format"}
                await manager.send_personal_message(json.dumps(error_msg), client_id)
            except Exception as e:
                error_msg = {"error": f"Processing error: {str(e)}"}
                await manager.send_personal_message(json.dumps(error_msg), client_id)
                
    except WebSocketDisconnect:
        manager.disconnect(client_id)

@app.post("/api/tts/websocket")
async def tts_via_websocket(request: TTSRequest):
    """HTTP API端点，用于测试WebSocket服务"""
    result = await call_minimax_tts(request)
    return result

@app.get("/api/models")
async def get_supported_models():
    """获取支持的TTS模型"""
    return {
        "models": SUPPORTED_MODELS,
        "voices": SUPPORTED_VOICES
    }

@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run(
        "websocket_tts_server:app",
        host="0.0.0.0",
        port=3000,
        reload=True,
        log_level="info"
    )
