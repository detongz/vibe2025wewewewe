#!/usr/bin/env python3
"""
极简播客制作服务器 - 端口3000
核心：session_id验证 + 强制skill + SKILL.md知识库
使用Claude Agent SDK Python实现
"""

import sys
import os

# 添加虚拟环境路径
venv_path = os.path.join(
    os.path.dirname(__file__), "venv", "lib", "python3.11", "site-packages"
)
if os.path.exists(venv_path):
    sys.path.insert(0, venv_path)

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Union, AsyncGenerator
import json
import uuid
from datetime import datetime
from pathlib import Path
import subprocess
import asyncio
from fastapi.responses import JSONResponse, StreamingResponse
from podcast_sdk import claude_agent_sdk_instance
from ultra_simple_server_paths import (
    create_session_context,
    get_session_path,
    load_chat_history,
    load_claude_session_id,
    save_message,
    update_claude_session_in_context,
)

app = FastAPI(title="Podcast Server", version="1.0.0")


# 自定义JSON响应，强制UTF-8编码
class UTF8JSONResponse(JSONResponse):
    def render(self, content: Any) -> bytes:
        return json.dumps(
            content,
            ensure_ascii=False,  # 禁用ASCII编码，允许中文
            allow_nan=False,
            indent=None,
            separators=(",", ":"),
        ).encode("utf-8")


# 覆盖默认的JSON响应
app.default_response_class = UTF8JSONResponse

# CORS - 修复middleware配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[],
    max_age=3600,
)


# 数据模型
class ChatMessage(BaseModel):
    role: str
    content: Union[str, List[Dict[str, Any]]]
    sequence_id: str = None


class ChatRequest(BaseModel):
    model: str = "kimi-for-podcast"
    messages: List[ChatMessage]
    max_tokens: Optional[int] = 1024
    temperature: Optional[float] = 0.7
    stream: Optional[bool] = False


class ChatResponse(BaseModel):
    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: List[Dict[str, Any]]
    usage: Dict[str, int]
    session_id: str


class ChatCompletionStreamChunk(BaseModel):
    id: str
    object: str = "chat.completion.chunk"
    created: int
    model: str
    choices: List[Dict[str, Any]]
    session_id: str


# 播客生成相关数据模型
class VoiceClip(BaseModel):
    id: str
    transcript: str


class ChatSessionMessage(BaseModel):
    role: str
    content: str


class ChatSession(BaseModel):
    title: str
    messages: List[ChatSessionMessage]


class PodcastSegment(BaseModel):
    id: str
    type: str  # "ai_narration" or "user_clip"
    content: str
    clipId: Optional[str] = None  # 当type为"user_clip"时必填


class PodcastPlan(BaseModel):
    id: str
    title: str
    summary: str
    tags: List[str]
    segments: List[PodcastSegment]
    status: str = "draft"
    createdAt: int


class PodcastGenerateRequest(BaseModel):
    # voice_clips: List[VoiceClip]
    # chat_sessions: List[ChatSession]
    session_id: str


class CreateSessionRequest(BaseModel):
    username: str  # 用户名，必填参数


# API端点
@app.post("/v1/sessions/create")
async def create_session(request: CreateSessionRequest):
    """创建新会话 - 需要用户名参数"""
    try:
        print(f"🚀 创建会话请求到达")
        username = request.username
        session_id = str(uuid.uuid4())
        print(f"📋 生成session_id: {session_id}, 用户名: {username}")

        session_path = create_session_context(session_id, username)
        print(f"📁 创建会话目录: {session_path}")

        response = {
            "session_id": session_id,
        }
        print(f"✅ 返回响应: {response}")
        return response

    except Exception as e:
        print(f"❌ 创建会话错误: {str(e)}")
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"创建会话失败: {str(e)}")


@app.post("/v1/chat/completions")
async def chat_completions(
    request: ChatRequest,
    session_id: str = Header(..., description="会话ID", alias="session-id"),
):
    """聊天完成 - 前端通过header传递session_id，支持流式响应"""

    # 1. 验证session_id存在性
    session_path = get_session_path(session_id)
    if not session_path.exists():
        raise HTTPException(status_code=404, detail="Session not found")

    # 2. 提取用户消息内容
    user_content = ""
    sequence_id = ""
    if request.messages:
        for msg in request.messages:
            user_content += f"{'娓娓播客编导' if msg.role=="assistant" else msg.role}:{msg.content}\n"
    if not user_content:
        raise HTTPException(status_code=400, detail="No user message found")

    # 判断是不是要引导用户结束对话
    context = load_chat_history(session_id).split("<confirm_generate>")
    if context and len(context) > 10:
        user_content += f"<notice>用户已经被AI认为{len(context)}次可以结束对话，请用<confirm_generate>是否现在生成故事？</confirm_generate>请编导引导用户结束对话开始生成播客</notice>\n"

    # 不判断是不是要进入后端处理生成，内容生成走另一个接口

    # 3. 根据是否流式处理选择不同的响应方式
    if request.stream:
        # 流式响应
        async def generate_stream():
            try:
                # 保存消息（在流式处理完成前）
                save_message(session_id, "user", user_content, sequence_id=sequence_id)
                # 获取流式生成器
                stream_generator = await claude_agent_sdk_instance.process_message(
                    user_content, session_id, stream=True
                )

                # 流式输出响应
                async for chunk in stream_generator:
                    yield chunk

                # 注意：流式模式下，assistant消息会在客户端接收完整内容后保存

            except Exception as e:
                # 流式错误处理
                error_chunk = {
                    "id": f"chatcmpl-{int(datetime.now().timestamp())}",
                    "object": "chat.completion.chunk",
                    "created": int(datetime.now().timestamp()),
                    "model": request.model,
                    "choices": [
                        {
                            "index": 0,
                            "delta": {"content": f"流式处理出错: {str(e)}"},
                            "finish_reason": None,
                        }
                    ],
                    "session_id": session_id,
                }
                yield f"data: {json.dumps(error_chunk, ensure_ascii=False)}\n\n"
                yield "data: [DONE]\n\n"

        return StreamingResponse(
            generate_stream(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": "text/plain; charset=utf-8",
            },
        )

    else:
        # 保存消息
        save_message(session_id, "user", user_content, sequence_id=sequence_id)
        # 非流式响应（原有逻辑）
        result = await claude_agent_sdk_instance.process_message(
            user_content, session_id, stream=False
        )

        save_message(
            session_id, "assistant", result["content"], result.get("tool_calls", [])
        )

        # 构建响应
        return ChatResponse(
            id=f"chatcmpl-{int(datetime.now().timestamp())}",
            created=int(datetime.now().timestamp()),
            model=request.model,
            choices=[
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": result["content"],
                        "tool_calls": result.get("tool_calls", []),
                    },
                    "finish_reason": "stop",
                }
            ],
            usage={
                "prompt_tokens": len(user_content),
                "completion_tokens": len(result["content"]),
                "total_tokens": len(user_content) + len(result["content"]),
            },
            session_id=session_id,
        )


@app.get("/v1/sessions/{session_id}")
async def get_session(session_id: str):
    """获取会话信息"""
    session_path = get_session_path(session_id)
    if not session_path.exists():
        raise HTTPException(status_code=404, detail="Session not found")

    context_file = session_path / "context.json"
    if context_file.exists():
        with open(context_file, "r", encoding="utf-8") as f:
            context = json.load(f)
        return context

    return {"session_id": session_id, "messages": []}


@app.post("/v1/sessions/{session_id}/resume")
async def resume_session(session_id: str, request: Dict[str, Any]):
    """恢复会话 - 支持使用Claude会话ID恢复"""
    try:
        # 验证会话存在
        session_path = get_session_path(session_id)
        if not session_path.exists():
            raise HTTPException(status_code=404, detail="Session not found")

        # 获取Claude会话ID（如果提供）
        claude_session_id = request.get("claude_session_id")
        if claude_session_id:
            # 保存Claude会话ID
            claude_agent_sdk_instance.claude_session_ids[session_id] = claude_session_id
            update_claude_session_in_context(session_id, claude_session_id)
            print(f"🔄 恢复会话: {session_id} 使用Claude会话ID: {claude_session_id}")

        return {
            "session_id": session_id,
            "resumed": True,
            "claude_session_id": claude_session_id,
            "message": "会话恢复成功",
        }

    except Exception as e:
        print(f"❌ 恢复会话错误: {str(e)}")
        raise HTTPException(status_code=500, detail=f"恢复会话失败: {str(e)}")


@app.get("/v1/sessions/{session_id}/claude-session")
async def get_claude_session_id(session_id: str):
    """获取会话对应的Claude会话ID"""
    try:
        # 验证会话存在
        session_path = get_session_path(session_id)
        if not session_path.exists():
            raise HTTPException(status_code=404, detail="Session not found")

        claude_session_id = load_claude_session_id(session_id)
        if claude_session_id:
            claude_agent_sdk_instance.claude_session_ids[session_id] = claude_session_id

        return {
            "session_id": session_id,
            "claude_session_id": claude_session_id,
            "exists": claude_session_id is not None,
        }

    except Exception as e:
        print(f"❌ 获取Claude会话ID错误: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取Claude会话ID失败: {str(e)}")


@app.get("/")
async def root():
    return {"message": "Podcast Server - Port 3001", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "healthy", "port": 3001}


@app.post("/api/podcast/generate")
async def generate_podcast(request: PodcastGenerateRequest):
    """生成播客方案接口"""
    contexts = []
    try:
        session_id = request.session_id
        # Use the same path approach as other functions
        session_path = get_session_path(session_id)
        if not session_path.exists():
            raise HTTPException(status_code=404, detail="Session not found")

        context_file = session_path / "context.json"
        if context_file.exists():
            with open(context_file, "r", encoding="utf-8") as f:
                context = json.load(f)
                for msg in context.get("messages", []):
                    if msg["role"] == "user":
                        contexts.append(
                            {
                                "role": "user",
                                "content": msg.get("content", ""),
                                "sequence_id": msg.get("sequence_id", ""),
                            }
                        )
                    else:
                        contexts.append(
                            {
                                "role": "assistant",
                                "content": msg.get("content", ""),
                            }
                        )
    except Exception as e:
        print(f"❌ 保存消息失败: {str(e)}", e)
        return None

    # 流式响应
    async def generate_stream():
        try:
            # 获取流式生成器
            stream_generator = claude_agent_sdk_instance.process_formated_mp3_data(
                session_id,
                contexts,
            )

            # 流式输出响应
            async for chunk in stream_generator:
                yield chunk

            # 注意：流式模式下，assistant消息会在客户端接收完整内容后保存

        except Exception as e:
            # 流式错误处理
            error_chunk = {
                "id": f"chatcmpl-{int(datetime.now().timestamp())}",
                "object": "chat.completion.chunk",
                "created": int(datetime.now().timestamp()),
                "model": request.model,
                "choices": [
                    {
                        "index": 0,
                        "delta": {"content": f"流式处理出错: {str(e)}"},
                        "finish_reason": None,
                    }
                ],
                "session_id": session_id,
            }
            yield f"data: {json.dumps(error_chunk, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate_stream(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/plain; charset=utf-8",
        },
    )


if __name__ == "__main__":
    import uvicorn

    print("🚀 Starting Podcast Server on port 3001...")
    uvicorn.run(app, host="0.0.0.0", port=3001, log_level="info")
