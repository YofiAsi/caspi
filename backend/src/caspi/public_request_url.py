from urllib.parse import urlparse

from starlette.requests import Request

from caspi.settings import settings


def _strip_base(url: str) -> str:
    return url.rstrip("/")


def _canonical_hostname() -> str | None:
    pu = (settings.public_app_url or "").strip()
    if not pu:
        return None
    return urlparse(pu).hostname


def _forwarded_first(value: str | None) -> str | None:
    if not value:
        return None
    return value.split(",")[0].strip()


def _hostname_from_forwarded_host(forwarded_host: str) -> str:
    if forwarded_host.startswith("["):
        end = forwarded_host.find("]")
        if end != -1:
            return forwarded_host[1:end]
        return forwarded_host
    return forwarded_host.split(":")[0]


def _host_trusted(hostname: str) -> bool:
    canon = _canonical_hostname()
    if canon and hostname.lower() == canon.lower():
        return True
    for h in settings.trusted_public_hosts:
        if hostname.lower() == h.lower():
            return True
    for suffix in settings.trusted_public_host_suffixes:
        if not suffix:
            continue
        if suffix.startswith("."):
            if hostname.endswith(suffix):
                return True
        elif hostname == suffix or hostname.endswith("." + suffix):
            return True
    return False


def resolve_public_base(request: Request) -> str:
    default = _strip_base(settings.public_app_url or "")
    forwarded_host = _forwarded_first(request.headers.get("x-forwarded-host"))
    forwarded_proto = _forwarded_first(request.headers.get("x-forwarded-proto"))
    if not forwarded_host or not forwarded_proto:
        return default
    proto = forwarded_proto.lower()
    if proto not in ("http", "https"):
        return default
    if ".." in forwarded_host or "/" in forwarded_host or " " in forwarded_host or "\n" in forwarded_host:
        return default
    hostname = _hostname_from_forwarded_host(forwarded_host)
    if not hostname or not _host_trusted(hostname):
        return default
    return _strip_base(f"{proto}://{forwarded_host}")
