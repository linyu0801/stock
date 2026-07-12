import os
from functools import lru_cache
from pathlib import Path

import jwt
from dotenv import load_dotenv
from fastapi import Header, HTTPException

load_dotenv(Path(__file__).parent / ".env")
SUPABASE_URL = os.environ["SUPABASE_URL"]


@lru_cache
def _jwks_client() -> jwt.PyJWKClient:
    return jwt.PyJWKClient(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json")


def get_current_user(authorization: str | None = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "missing bearer token")
    token = authorization.removeprefix("Bearer ")
    try:
        key = _jwks_client().get_signing_key_from_jwt(token)
        claims = jwt.decode(token, key.key, algorithms=["ES256", "RS256"], audience="authenticated")
    except jwt.PyJWTError:
        raise HTTPException(401, "invalid token")
    return claims["sub"]
