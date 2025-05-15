"use client";

import {
  createClient,
  LiveClient,
  LiveConnectionState,
  LiveTranscriptionEvents,
  SOCKET_STATES,
  type LiveSchema,
  type LiveTranscriptionEvent,
} from "@deepgram/sdk";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  FunctionComponent,
  useCallback,
  useMemo,
} from "react";

interface DeepgramContextType {
  connection: LiveClient | null;
  connectToDeepgram: (options: LiveSchema, endpoint?: string) => Promise<void>;
  disconnectFromDeepgram: () => void;
  connectionState: SOCKET_STATES;
}

const DeepgramContext = createContext<DeepgramContextType | undefined>(
  undefined
);

interface DeepgramContextProviderProps {
  children: ReactNode;
}

const getApiKey = async (): Promise<string> => {
  const response = await fetch("/api/auth", { cache: "no-store" });
  const result = await response.json();
  return result.key;
};

const DeepgramContextProvider: FunctionComponent<
  DeepgramContextProviderProps
> = ({ children }) => {
  const [connection, setConnection] = useState<LiveClient | null>(null);
  const [connectionState, setConnectionState] = useState<SOCKET_STATES>(
    SOCKET_STATES.closed
  );

  const connectToDeepgram = useCallback(async (options: LiveSchema, endpoint?: string) => {
    console.log("[DeepgramContext] connectToDeepgram called with options:", options);
    const key = await getApiKey();
    const deepgram = createClient(key);

    const conn = deepgram.listen.live(options, endpoint);

    conn.addListener(LiveTranscriptionEvents.Open, () => {
      console.log("[DeepgramContext] Connection opened");
      setConnectionState(SOCKET_STATES.open);
    });

    conn.addListener(LiveTranscriptionEvents.Close, () => {
      console.log("[DeepgramContext] Connection closed");
      setConnectionState(SOCKET_STATES.closed);
      setConnection(null);
    });

    conn.addListener(LiveTranscriptionEvents.Error, (error) => {
      console.error("[DeepgramContext] Connection error:", error);
      setConnectionState(SOCKET_STATES.closed);
      setConnection(null);
    });
    
    setConnection(conn);
  }, [setConnection, setConnectionState]);

  const disconnectFromDeepgram = useCallback(async () => {
    console.log("[DeepgramContext] disconnectFromDeepgram called");
    if (connection) {
      connection.requestClose();
    }
  }, [connection]);

  const contextValue = useMemo(() => ({
    connection,
    connectToDeepgram,
    disconnectFromDeepgram,
    connectionState,
  }), [connection, connectToDeepgram, disconnectFromDeepgram, connectionState]);

  return (
    <DeepgramContext.Provider
      value={contextValue}
    >
      {children}
    </DeepgramContext.Provider>
  );
};

function useDeepgram(): DeepgramContextType {
  const context = useContext(DeepgramContext);
  if (context === undefined) {
    throw new Error(
      "useDeepgram must be used within a DeepgramContextProvider"
    );
  }
  return context;
}

export {
  DeepgramContextProvider,
  useDeepgram,
  LiveConnectionState,
  LiveTranscriptionEvents,
  type LiveTranscriptionEvent,
};