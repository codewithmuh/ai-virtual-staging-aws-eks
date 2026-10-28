"""Configuration from environment variables (12-factor). No secrets have defaults.

Provider API keys (ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY) are read by each SDK
from the environment directly, so they never pass through this object or into logs.
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    service_name: str = "api"
    version: str = "0.0.0"
    log_level: str = "INFO"

    # Storage. Endpoint overrides point boto3 at MinIO and DynamoDB Local; unset in AWS.
    aws_region: str = "us-east-1"
    s3_bucket: str = "heya-photos"
    s3_endpoint_url: str | None = None
    # The endpoint browsers use for presigned URLs. Signatures cover the host, so locally this is
    # http://localhost:9000 while the API itself talks to http://minio:9000.
    s3_public_endpoint_url: str | None = None
    dynamodb_table: str = "heya"
    dynamodb_endpoint_url: str | None = None
    # Local only: create the bucket and table at startup. In AWS, Terraform owns them.
    auto_create_resources: bool = False

    # AI providers. "fake" needs no key: it is how CI, tests and keyless local runs work.
    image_provider: str = "fake"  # openai | gemini | fake
    openai_image_model: str = "gpt-image-2"
    gemini_image_model: str = "gemini-3.1-flash-image"
    writer_provider: str = "fake"  # claude | fake
    claude_model: str = "claude-opus-5-5"

    # Rule R4: AI spend is capped per visitor, per IP address and for the whole site, per day.
    visitor_daily_limit: int = 5
    ip_daily_limit: int = 20
    global_daily_limit: int = 200

    max_upload_bytes: int = 10 * 1024 * 1024
    # Rule R2: a staged photo keeping less than this share of the room's edges is flagged.
    structure_threshold: float = 0.55
    upload_url_ttl_seconds: int = 300
    view_url_ttl_seconds: int = 3600
    cors_origins: tuple[str, ...] = ("http://localhost:3000",)


def _bool(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "on"}


def load_settings(env: Mapping[str, str] | None = None) -> Settings:
    """Read settings from the environment; pass a mapping in tests."""
    env = os.environ if env is None else env
    d = Settings()
    return Settings(
        service_name=env.get("SERVICE_NAME", d.service_name),
        version=env.get("APP_VERSION", d.version),
        log_level=env.get("LOG_LEVEL", d.log_level).upper(),
        aws_region=env.get("AWS_REGION", d.aws_region),
        s3_bucket=env.get("S3_BUCKET", d.s3_bucket),
        s3_endpoint_url=env.get("S3_ENDPOINT_URL") or None,
        s3_public_endpoint_url=env.get("S3_PUBLIC_ENDPOINT_URL") or None,
        dynamodb_table=env.get("DYNAMODB_TABLE", d.dynamodb_table),
        dynamodb_endpoint_url=env.get("DYNAMODB_ENDPOINT_URL") or None,
        auto_create_resources=_bool(env.get("AUTO_CREATE_RESOURCES", "false")),
        image_provider=env.get("IMAGE_PROVIDER", d.image_provider).lower(),
        openai_image_model=env.get("OPENAI_IMAGE_MODEL", d.openai_image_model),
        gemini_image_model=env.get("GEMINI_IMAGE_MODEL", d.gemini_image_model),
        writer_provider=env.get("WRITER_PROVIDER", d.writer_provider).lower(),
        claude_model=env.get("CLAUDE_MODEL", d.claude_model),
        visitor_daily_limit=int(env.get("VISITOR_DAILY_LIMIT", d.visitor_daily_limit)),
        ip_daily_limit=int(env.get("IP_DAILY_LIMIT", d.ip_daily_limit)),
        global_daily_limit=int(env.get("GLOBAL_DAILY_LIMIT", d.global_daily_limit)),
        max_upload_bytes=int(env.get("MAX_UPLOAD_BYTES", d.max_upload_bytes)),
        structure_threshold=float(env.get("STRUCTURE_THRESHOLD", d.structure_threshold)),
        upload_url_ttl_seconds=int(env.get("UPLOAD_URL_TTL_SECONDS", d.upload_url_ttl_seconds)),
        view_url_ttl_seconds=int(env.get("VIEW_URL_TTL_SECONDS", d.view_url_ttl_seconds)),
        cors_origins=tuple(
            o.strip()
            for o in env.get("CORS_ORIGINS", ",".join(d.cors_origins)).split(",")
            if o.strip()
        ),
    )
