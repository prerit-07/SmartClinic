import { useEffect, useState } from 'react';
import { socket } from './socket.js';

// Subscribes to queue:state broadcasts and tracks connection status.
// Every screen renders purely from whatever state the server sends.
export function useQueue() {
  const [state, setState] = useState({
    currentToken: 0,
    avgConsultTime: 0,
    queue: [],
  });
  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => {
    function onState(next) {
      setState(next);
    }
    function onConnect() {
      setConnected(true);
    }
    function onDisconnect() {
      setConnected(false);
    }

    socket.on('queue:state', onState);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('queue:state', onState);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  return { state, connected };
}
