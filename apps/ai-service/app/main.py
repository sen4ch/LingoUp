import asyncio
import hmac
import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response
from fastapi.responses import JSONResponse

from .config import Settings
from .providers import Provider, ProviderError, create_provider
from .schemas import (
    ExerciseGenerationInput,
    ExerciseResponse,
    HealthResponse,
    ReadingTextGenerationInput,
    ReadingTextResponse,
    TaskResponse,
    WordExplanationInput,
)
from .speech import (
    SpeechError,
    SpeechInput,
    Synthesizer,
    edge_synthesize,
    synthesize_with_timeout,
)

logger = logging.getLogger("ai-service")


def create_app(
    settings: Settings | None = None,
    provider: Provider | None = None,
    synthesize: Synthesizer = edge_synthesize,
) -> FastAPI:
    settings = settings or Settings()  # type: ignore[call-arg]  # values come from the environment
    active = provider or create_provider(settings)

    async def warm_up() -> None:
        try:
            await active.warm_up()
            logger.info("model %s is loaded", active.model)
        except Exception as error:  # noqa: BLE001 - best effort, requests still work later
            logger.warning("model warm-up failed: %s", type(error).__name__)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        logger.info("ai-service started with backend=%s model=%s", active.name, active.model)
        # Load the model in the background so the first learner request is not a cold start.
        warm_up_task = asyncio.create_task(warm_up())
        yield
        warm_up_task.cancel()
        await active.aclose()

    # No public docs: this service is internal and token-protected.
    app = FastAPI(
        title="LingoUp AI service",
        lifespan=lifespan,
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )

    @app.middleware("http")
    async def limit_body_size(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        length = request.headers.get("content-length")
        if length is None:
            # Chunked bodies would bypass the size check; the API always sends a length.
            if request.method in {"POST", "PUT", "PATCH"}:
                return JSONResponse({"detail": "Content-Length required"}, status_code=411)
        elif not length.isdigit() or int(length) > settings.max_body_bytes:
            return JSONResponse({"detail": "Request body too large"}, status_code=413)
        return await call_next(request)

    def require_token(x_ai_service_token: Annotated[str | None, Header()] = None) -> None:
        expected = settings.ai_service_token.get_secret_value()
        if x_ai_service_token is None or not hmac.compare_digest(x_ai_service_token, expected):
            raise HTTPException(status_code=401, detail="Invalid service token")

    @app.get("/health/live")
    async def live() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/health", dependencies=[Depends(require_token)])
    async def health() -> HealthResponse:
        return HealthResponse(
            provider=active.name, model=active.model, dataLocality=active.data_locality
        )

    @app.post("/v1/tasks/word-explanation", dependencies=[Depends(require_token)])
    async def word_explanation(task: WordExplanationInput) -> TaskResponse:
        try:
            output = await active.explain_word(task)
        except ProviderError as error:
            # Log the failure category only, never the learner's text.
            logger.warning("word-explanation failed: %s", error)
            raise HTTPException(status_code=502, detail="AI backend failed") from error
        return TaskResponse(provider=active.name, model=active.model, output=output)

    @app.post("/v1/tasks/reading-text-generation", dependencies=[Depends(require_token)])
    async def reading_text_generation(task: ReadingTextGenerationInput) -> ReadingTextResponse:
        try:
            output = await active.generate_text(task)
        except ProviderError as error:
            logger.warning("reading-text-generation failed: %s", error)
            raise HTTPException(status_code=502, detail="AI backend failed") from error
        return ReadingTextResponse(provider=active.name, model=active.model, output=output)

    @app.post("/v1/tasks/exercise-generation", dependencies=[Depends(require_token)])
    async def exercise_generation(task: ExerciseGenerationInput) -> ExerciseResponse:
        try:
            output = await active.generate_exercises(task)
        except ProviderError as error:
            logger.warning("exercise-generation failed: %s", error)
            raise HTTPException(status_code=502, detail="AI backend failed") from error
        return ExerciseResponse(provider=active.name, model=active.model, output=output)

    @app.post("/v1/tasks/speech-synthesis", dependencies=[Depends(require_token)])
    async def speech_synthesis(task: SpeechInput) -> Response:
        try:
            audio = await synthesize_with_timeout(synthesize, task, settings.speech_timeout_seconds)
        except SpeechError as error:
            logger.warning("speech-synthesis failed: %s", error)
            raise HTTPException(status_code=502, detail="Speech backend failed") from error
        return Response(content=audio, media_type="audio/mpeg")

    return app


def app_factory() -> FastAPI:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    return create_app()
