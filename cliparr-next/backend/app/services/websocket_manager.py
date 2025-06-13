"""
WebSocket manager for real-time updates.
"""

import logging
import socketio

class WebSocketManager:
    def __init__(self):
        self.sio = socketio.AsyncServer(
            async_mode='asgi',
            cors_allowed_origins=["*"],
            ping_timeout=30,
            ping_interval=60,
            logger=True,
            engineio_logger=True,
            max_http_buffer_size=1024 * 1024,
            async_handlers=True,
            cors_credentials=True
        )

    async def emit(self, event: str, data: dict):
        """
        Emit an event to all connected clients.
        
        :param event: Event name
        :param data: Event data
        """
        try:
            await self.sio.emit(event, data)
        except Exception as e:
            logging.error(f"Error emitting WebSocket event {event}: {e}")

    def get_socket_app(self, app):
        """
        Get the Socket.IO ASGI app.
        
        :param app: FastAPI app
        :return: Socket.IO ASGI app
        """
        return socketio.ASGIApp(self.sio, app, socketio_path='/socket.io') 