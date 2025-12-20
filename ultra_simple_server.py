#!/usr/bin/env python3
"""
极简播客制作服务器 - 端口3000
核心：session_id验证 + 强制skill + SKILL.md知识库
使用Claude Agent SDK Python实现
"""

import sys
import os
import logging
from logging.handlers import RotatingFileHandler
import threading
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager

# 添加虚拟环境路径
venv_path = os.path.join(
    os.path.dirname(__file__), "venv", "lib", "python3.11", "site-packages"
)
if os.path.exists(venv_path):
    sys.path.insert(0, venv_path)

from fastapi import FastAPI, HTTPException, Header, Request
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

# 配置日志系统
def setup_logging():
    """配置日志系统，输出到文件和控制台"""
    # 创建logs目录
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)

    # 配置日志格式
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    # 文件处理器 - 按大小轮转，每个文件最大10MB，保留5个备份
    file_handler = RotatingFileHandler(
        log_dir / "server.log",
        maxBytes=10*1024*1024,  # 10MB
        backupCount=5,
        encoding='utf-8'
    )
    file_handler.setFormatter(formatter)
    file_handler.setLevel(logging.INFO)

    # 错误日志文件处理器
    error_handler = RotatingFileHandler(
        log_dir / "error.log",
        maxBytes=10*1024*1024,  # 10MB
        backupCount=3,
        encoding='utf-8'
    )
    error_handler.setFormatter(formatter)
    error_handler.setLevel(logging.ERROR)

    # 控制台处理器
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    console_handler.setLevel(logging.INFO)

    # 配置根日志器
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    root_logger.addHandler(file_handler)
    root_logger.addHandler(error_handler)
    root_logger.addHandler(console_handler)

    return root_logger

# 初始化日志
logger = setup_logging()

# 并发控制配置
MAX_CONCURRENT_REQUESTS = 50  # 最大并发请求数
MAX_CONCURRENT_STREAMING = 20  # 最大并发流式请求数
REQUEST_TIMEOUT = 300  # 请求超时时间（秒）

# 创建线程池用于CPU密集型任务
thread_pool = ThreadPoolExecutor(max_workers=10)

# 信号量控制并发
request_semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
streaming_semaphore = asyncio.Semaphore(MAX_CONCURRENT_STREAMING)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    logger.info("🚀 Podcast Server starting up...")
    yield
    logger.info("🛑 Podcast Server shutting down...")
    thread_pool.shutdown(wait=True)

app = FastAPI(
    title="Podcast Server",
    version="1.0.0",
    lifespan=lifespan
)


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

# 请求日志中间件
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """记录请求日志"""
    start_time = datetime.now()

    # 记录请求信息
    client_ip = request.client.host if request.client else "unknown"
    method = request.method
    url = str(request.url)
    user_agent = request.headers.get("user-agent", "unknown")
    session_id = request.headers.get("session-id", "none")

    logger.info(f"📥 请求开始: {method} {url} | IP: {client_ip} | Session: {session_id} | UA: {user_agent}")

    try:
        # 使用信号量控制并发
        async with request_semaphore:
            # 设置请求超时
            response = await asyncio.wait_for(
                call_next(request),
                timeout=REQUEST_TIMEOUT
            )

        # 计算处理时间
        process_time = (datetime.now() - start_time).total_seconds()
        status_code = response.status_code

        # 记录响应信息
        logger.info(f"📤 请求完成: {method} {url} | 状态: {status_code} | 耗时: {process_time:.2f}s | Session: {session_id}")

        # 添加响应头
        response.headers["X-Process-Time"] = str(process_time)
        response.headers["X-Request-ID"] = str(uuid.uuid4())

        return response

    except asyncio.TimeoutError:
        logger.error(f"⏰ 请求超时: {method} {url} | Session: {session_id} | 超时时间: {REQUEST_TIMEOUT}s")
        return JSONResponse(
            status_code=408,
            content={"detail": "Request timeout"}
        )
    except Exception as e:
        process_time = (datetime.now() - start_time).total_seconds()
        logger.error(f"❌ 请求错误: {method} {url} | Session: {session_id} | 耗时: {process_time:.2f}s | 错误: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"}
        )

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
        logger.info(f"🚀 创建会话请求到达 | 用户名: {request.username}")

        username = request.username
        session_id = str(uuid.uuid4())

        logger.info(f"📋 生成session_id: {session_id}, 用户名: {username}")

        # 在线程池中执行文件IO操作
        loop = asyncio.get_event_loop()
        session_path = await loop.run_in_executor(
            thread_pool,
            create_session_context,
            session_id,
            username
        )

        logger.info(f"📁 创建会话目录: {session_path}")

        response = {
            "session_id": session_id,
        }
        logger.info(f"✅ 会话创建成功: {session_id}")
        return response

    except Exception as e:
        logger.error(f"❌ 创建会话错误: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"创建会话失败: {str(e)}")


@app.post("/v1/chat/completions")
async def chat_completions(
    request: ChatRequest,
    session_id: str = Header(..., description="会话ID", alias="session-id"),
):
    """聊天完成 - 前端通过header传递session_id，支持流式响应"""

    logger.info(f"💬 聊天请求 | Session: {session_id} | Stream: {request.stream} | Messages: {len(request.messages)}")

    # 1. 验证session_id存在性
    session_path = get_session_path(session_id)
    if not session_path.exists():
        logger.warning(f"❌ Session不存在: {session_id}")
        raise HTTPException(status_code=404, detail="Session not found")

    # 2. 提取用户消息内容
    user_content = ""
    sequence_id = ""
    if request.messages:
        for msg in request.messages:
            role = msg.role
            if role=="assistant":
                role='娓娓播客编导'
            user_content += f"{role}:{msg.content}\n"
    if not user_content:
        logger.warning(f"❌ 未找到用户消息 | Session: {session_id}")
        raise HTTPException(status_code=400, detail="No user message found")

    logger.debug(f"📝 用户消息内容长度: {len(user_content)} | Session: {session_id}")

    # 3. 在线程池中检查对话历史（避免阻塞事件循环）
    try:
        loop = asyncio.get_event_loop()
        context = await loop.run_in_executor(
            thread_pool,
            load_chat_history,
            session_id
        )

        # 判断是不是要引导用户结束对话
        confirm_parts = context.split("<confirm_generate>")
        if confirm_parts and len(confirm_parts) > 10:
            user_content += f"<notice>用户已经被AI认为{len(confirm_parts)}次可以结束对话，请用<confirm_generate>是否现在生成故事？</confirm_generate>请编导引导用户结束对话开始生成播客</notice>\n"
            logger.info(f"🎯 引导结束对话 | Session: {session_id} | 确认次数: {len(confirm_parts)}")
    except Exception as e:
        logger.warning(f"⚠️ 加载对话历史失败 | Session: {session_id} | 错误: {str(e)}")

    # 4. 根据是否流式处理选择不同的响应方式
    if request.stream:
        # 流式响应 - 使用额外的信号量控制
        async def generate_stream():
            async with streaming_semaphore:
                try:
                    logger.info(f"🌊 开始流式响应 | Session: {session_id}")

                    # 在线程池中保存消息
                    await loop.run_in_executor(
                        thread_pool,
                        save_message,
                        session_id, "user", user_content, sequence_id
                    )

                    # 获取流式生成器
                    stream_generator = await claude_agent_sdk_instance.process_message(
                        user_content, session_id, stream=True
                    )

                    # 流式输出响应
                    chunk_count = 0
                    async for chunk in stream_generator:
                        yield chunk
                        chunk_count += 1

                    logger.info(f"✅ 流式响应完成 | Session: {session_id} | Chunks: {chunk_count}")

                except Exception as e:
                    logger.error(f"❌ 流式处理错误 | Session: {session_id} | 错误: {str(e)}", exc_info=True)
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
        # 非流式响应
        try:
            logger.info(f"📤 开始非流式响应 | Session: {session_id}")

            # 在线程池中保存消息
            await loop.run_in_executor(
                thread_pool,
                save_message,
                session_id, "user", user_content, sequence_id
            )

            # 处理消息
            result = await claude_agent_sdk_instance.process_message(
                user_content, session_id, stream=False
            )

            # 在线程池中保存助手回复
            await loop.run_in_executor(
                thread_pool,
                save_message,
                session_id, "assistant", result["content"], result.get("tool_calls", [])
            )

            # 构建响应
            response = ChatResponse(
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

            logger.info(f"✅ 非流式响应完成 | Session: {session_id} | Tokens: {response.usage['total_tokens']}")
            return response

        except Exception as e:
            logger.error(f"❌ 非流式处理错误 | Session: {session_id} | 错误: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"处理消息失败: {str(e)}")


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
    logger.info("🏠 根路径访问")
    return {"message": "Podcast Server - Port 3001", "version": "1.0.0"}


@app.get("/health")
async def health():
    """健康检查端点"""
    return {
        "status": "healthy",
        "port": 3001,
        "timestamp": int(datetime.now().timestamp()),
        "concurrent_requests": MAX_CONCURRENT_REQUESTS - request_semaphore._value,
        "concurrent_streaming": MAX_CONCURRENT_STREAMING - streaming_semaphore._value,
        "thread_pool_active": thread_pool._threads.__len__() if hasattr(thread_pool, '_threads') else 0
    }


@app.get("/metrics")
async def metrics():
    """服务器指标端点"""
    return {
        "server_info": {
            "version": "1.0.0",
            "port": 3001,
            "uptime": "running",  # 可以添加实际运行时间统计
        },
        "concurrency": {
            "max_concurrent_requests": MAX_CONCURRENT_REQUESTS,
            "current_concurrent_requests": MAX_CONCURRENT_REQUESTS - request_semaphore._value,
            "max_concurrent_streaming": MAX_CONCURRENT_STREAMING,
            "current_concurrent_streaming": MAX_CONCURRENT_STREAMING - streaming_semaphore._value,
        },
        "thread_pool": {
            "max_workers": thread_pool._max_workers,
            "active_threads": thread_pool._threads.__len__() if hasattr(thread_pool, '_threads') else 0,
        },
        "requests": {
            "timeout_seconds": REQUEST_TIMEOUT,
        }
    }


@app.post("/api/podcast/generate")
async def generate_podcast(request: PodcastGenerateRequest):
    """生成播客方案接口"""
    session_id = request.session_id
    logger.info(f"🎙️ 播客生成请求 | Session: {session_id}")

    # 在线程池中加载上下文数据
    async def load_contexts():
        contexts = []
        try:
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
            logger.info(f"📚 加载上下文完成 | Session: {session_id} | Messages: {len(contexts)}")
            return contexts
        except Exception as e:
            logger.error(f"❌ 加载上下文失败 | Session: {session_id} | 错误: {str(e)}", exc_info=True)
            raise

    # 流式响应
    async def generate_stream():
        async with streaming_semaphore:
            try:
                logger.info(f"🎙️ 开始播客生成 | Session: {session_id}")

                # 加载上下文
                contexts = await load_contexts()

                # 获取流式生成器
                stream_generator = claude_agent_sdk_instance.process_formated_mp3_data(
                    session_id,
                    contexts,
                )

                # 流式输出响应
                chunk_count = 0
                async for chunk in stream_generator:
                    yield chunk
                    chunk_count += 1

                logger.info(f"✅ 播客生成完成 | Session: {session_id} | Chunks: {chunk_count}")

            except Exception as e:
                logger.error(f"❌ 播客生成错误 | Session: {session_id} | 错误: {str(e)}", exc_info=True)
                # 流式错误处理
                error_chunk = {
                    "id": f"chatcmpl-{int(datetime.now().timestamp())}",
                    "object": "chat.completion.chunk",
                    "created": int(datetime.now().timestamp()),
                    "model": "podcast-generator",
                    "choices": [
                        {
                            "index": 0,
                            "delta": {"content": f"播客生成出错: {str(e)}"},
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

    logger.info("🚀 Starting Podcast Server on port 3001...")
    logger.info(f"📊 配置信息 - 最大并发: {MAX_CONCURRENT_REQUESTS}, 流式并发: {MAX_CONCURRENT_STREAMING}, 超时: {REQUEST_TIMEOUT}s")

    # 配置uvicorn
    uvicorn_config = {
        "app": app,
        "host": "0.0.0.0",
        "port": 3001,
        "log_level": "warning",  # 减少uvicorn自己的日志，使用我们的日志系统
        "access_log": False,     # 禁用访问日志，使用我们的中间件
        "workers": 1,            # 单进程模式，我们的异步处理已经足够
    }

    uvicorn.run(**uvicorn_config)
