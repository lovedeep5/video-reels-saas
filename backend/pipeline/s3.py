"""
S3 storage helper — upload rendered clips and generate pre-signed download URLs.
"""
from pathlib import Path


def _client():
    import boto3
    from config import settings
    return boto3.client(
        "s3",
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION,
    )


def s3_enabled() -> bool:
    from config import settings
    return bool(settings.S3_BUCKET and settings.AWS_ACCESS_KEY_ID)


def upload_clip(local_path: str, s3_key: str) -> bool:
    """Upload a local file to S3. Returns True on success."""
    try:
        _client().upload_file(
            local_path,
            __import__("config").settings.S3_BUCKET,
            s3_key,
            ExtraArgs={"ContentType": "video/mp4"},
        )
        print(f"[s3] Uploaded {s3_key}")
        return True
    except Exception as e:
        print(f"[s3] Upload failed for {s3_key}: {e}")
        return False


def get_presigned_url(s3_key: str, expires_in: int = 3600) -> str:
    """Return a pre-signed GET URL valid for `expires_in` seconds (default 1 hour)."""
    from config import settings
    return _client().generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.S3_BUCKET, "Key": s3_key},
        ExpiresIn=expires_in,
    )


def stream_clip(s3_key: str):
    """Return a boto3 StreamingBody for the S3 object (for proxying through backend)."""
    from config import settings
    response = _client().get_object(Bucket=settings.S3_BUCKET, Key=s3_key)
    return response["Body"], response.get("ContentLength")
