import logging
from functools import lru_cache

from supabase import create_client, Client

from app.config import get_settings

logger = logging.getLogger(__name__)

# Monkey-patch PostgREST to use HTTP/1.1 (avoids Supabase HTTP/2 disconnects)
try:
    from postgrest._sync.client import SyncPostgrestClient
    from postgrest.utils import SyncClient

    def _http1_create_session(self, base_url, headers, timeout, verify=True, proxy=None):
        return SyncClient(
            base_url=base_url, headers=headers, timeout=timeout,
            verify=verify, proxy=proxy, follow_redirects=True, http2=False,
        )

    SyncPostgrestClient.create_session = _http1_create_session
except Exception:
    pass


@lru_cache
def get_supabase_admin() -> Client:
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def create_anon_client() -> Client:
    """Fresh anon client for auth operations that trigger state changes (signin, refresh)."""
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_anon_key)


def get_supabase_client(access_token: str) -> Client:
    settings = get_settings()
    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    client.auth.set_session(access_token, "")
    return client
