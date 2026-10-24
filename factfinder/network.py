"""Bounded public-web fetching. Pin each connection to a validated IP address."""
import asyncio
import ipaddress
import socket
from urllib.parse import urlparse

import httpx

MAX_RESPONSE_BYTES = 2 * 1024 * 1024


def validate_url(url: str) -> str:
    parsed = urlparse(str(url))
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("Use an absolute HTTP or HTTPS URL")
    if parsed.username or parsed.password or parsed.port not in {None, 80, 443}:
        raise ValueError("URL credentials and non-web ports are not allowed")
    host = parsed.hostname.rstrip(".").lower()
    if host == "localhost" or host.endswith((".localhost", ".local", ".internal")):
        raise ValueError("Private destinations are not allowed")
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        if "." not in host:
            raise ValueError("A public hostname is required") from None
    else:
        if not ip.is_global or getattr(ip, "ipv4_mapped", None) and not ip.ipv4_mapped.is_global:
            raise ValueError("Private destinations are not allowed")
    return str(url)


async def public_addresses(host: str, port: int) -> list[str]:
    answers = await asyncio.wait_for(
        asyncio.get_running_loop().getaddrinfo(host, port, type=socket.SOCK_STREAM), 3
    )
    addresses = list(dict.fromkeys(item[4][0] for item in answers))
    if not addresses or any(
        not ipaddress.ip_address(ip).is_global
        or (getattr(ipaddress.ip_address(ip), "ipv4_mapped", None) and not ipaddress.ip_address(ip).ipv4_mapped.is_global)
        for ip in addresses
    ):
        raise ValueError("DNS resolves to a non-public destination")
    return addresses


class LimitedStream(httpx.AsyncByteStream):
    def __init__(self, inner):
        self.inner = inner

    async def __aiter__(self):
        size = 0
        async for chunk in self.inner:
            size += len(chunk)
            if size > MAX_RESPONSE_BYTES:
                await self.inner.aclose()
                raise ValueError("Scan response exceeds 2 MB")
            yield chunk

    async def aclose(self):
        await self.inner.aclose()


class PublicTransport(httpx.AsyncBaseTransport):
    def __init__(self):
        self.inner = httpx.AsyncHTTPTransport(
            retries=0, limits=httpx.Limits(max_connections=12, max_keepalive_connections=0)
        )

    async def handle_async_request(self, request):
        validate_url(str(request.url))
        host = request.url.host
        addresses = await public_addresses(host, request.url.port or (443 if request.url.scheme == "https" else 80))
        pinned = httpx.Request(
            request.method, request.url.copy_with(host=addresses[0]),
            headers=request.headers, stream=request.stream,
            extensions={**request.extensions, "sni_hostname": host},
        )
        response = await self.inner.handle_async_request(pinned)
        if response.headers.get("content-encoding", "identity").lower() != "identity":
            await response.aclose()
            raise ValueError("Compressed scan responses are not supported")
        response.stream = LimitedStream(response.stream)
        return response

    async def aclose(self):
        await self.inner.aclose()


class SafeAsyncClient(httpx.AsyncClient):
    def __init__(self, **kwargs):
        # Never honor proxy environment variables for user-controlled destinations.
        kwargs.update(transport=PublicTransport(), trust_env=False, max_redirects=5)
        headers = dict(kwargs.pop("headers", {}))
        headers["Accept-Encoding"] = "identity"
        super().__init__(headers=headers, **kwargs)

    async def send(self, request, **kwargs):
        kwargs["stream"] = True
        response = await super().send(request, **kwargs)
        chunks, size = [], 0
        try:
            async for chunk in response.aiter_bytes():
                size += len(chunk)
                if size > MAX_RESPONSE_BYTES:
                    raise ValueError("Scan response exceeds 2 MB")
                chunks.append(chunk)
            response._content = b"".join(chunks)
        finally:
            await response.aclose()
        return response
