import { useSocketContext } from '../context/socket-context';

export const useSocket = () => {
  const { socket, isConnected } = useSocketContext();
  return {
    socket,
    isConnected,
  };
};
