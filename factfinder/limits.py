"""Reject oversized bodies, including chunked uploads, before form parsing."""
from starlette.responses import JSONResponse

class BodyLimitMiddleware:
    def __init__(self, app, max_bytes=26 * 1024 * 1024):
        self.app, self.max_bytes = app, max_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        headers = dict(scope.get("headers", []))
        try:
            length = int(headers.get(b"content-length", b"0"))
        except ValueError:
            return await JSONResponse({"detail": "Invalid Content-Length"}, 400)(scope, receive, send)
        if length > self.max_bytes:
            return await JSONResponse({"detail": "Request exceeds 26 MB"}, 413)(scope, receive, send)
        # Buffer a bounded body so oversized chunked requests cannot reach the parser.
        body, total = [], 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            chunk = message.get("body", b"")
            total += len(chunk)
            if total > self.max_bytes:
                return await JSONResponse({"detail": "Request exceeds 26 MB"}, 413)(scope, receive, send)
            body.append(chunk)
            if not message.get("more_body", False):
                break
        sent = False
        async def replay():
            nonlocal sent
            if not sent:
                sent = True
                return {"type": "http.request", "body": b"".join(body), "more_body": False}
            return await receive()
        return await self.app(scope, replay, send)
