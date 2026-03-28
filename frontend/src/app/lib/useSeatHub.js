import { useEffect, useRef, useState } from "react";
import * as signalR from "@microsoft/signalr";
import { TICKETING_SERVICE_BASE_URL } from "./api-config";

/**
 * Connects to the ticketing-service SignalR hub and joins the seat room
 * for the given event + ticket type.
 *
 * @param {string|null} eventId
 * @param {string|null} ticketTypeId
 * @param {(row: string, column: number, status: string) => void} onSeatUpdate
 * @returns {{ isConnected: boolean }}
 */
export function useSeatHub(eventId, ticketTypeId, onSeatUpdate) {
    const callbackRef = useRef(onSeatUpdate);
    callbackRef.current = onSeatUpdate;

    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        if (!eventId || !ticketTypeId) return;

        const hubUrl = `${TICKETING_SERVICE_BASE_URL}/seat-hub`;

        const connection = new signalR.HubConnectionBuilder()
            .withUrl(hubUrl)
            .withAutomaticReconnect([0, 1000, 3000, 5000, 10000])
            .configureLogging(signalR.LogLevel.Information)
            .build();

        connection.on("SeatUpdate", (payload) => {
            if (payload?.row !== undefined && payload?.column !== undefined && payload?.status) {
                callbackRef.current(payload.row, payload.column, payload.status);
            }
        });

        const joinRoom = async () => {
            try {
                await connection.invoke("JoinSeatRoom", eventId, ticketTypeId);
                console.log(`[SeatHub] joined room seat:${eventId}:${ticketTypeId}`);
                setIsConnected(true);
            } catch (err) {
                console.warn("[SeatHub] JoinSeatRoom failed:", err);
            }
        };

        // Re-join the hub group whenever SignalR auto-reconnects.
        // Group membership is per-ConnectionId; a new connection after disconnect
        // gets a fresh ConnectionId and is NOT automatically re-added to the group.
        connection.onreconnected(() => {
            console.log("[SeatHub] reconnected — re-joining room");
            void joinRoom();
        });

        connection.onreconnecting(() => {
            console.log("[SeatHub] reconnecting...");
            setIsConnected(false);
        });

        connection.onclose((err) => {
            console.warn("[SeatHub] connection closed", err ?? "");
            setIsConnected(false);
        });

        let stopped = false;

        const start = async () => {
            try {
                await connection.start();
                console.log("[SeatHub] connected, state:", connection.state);
                if (!stopped) await joinRoom();
            } catch (err) {
                console.warn("[SeatHub] connection failed:", err);
                setIsConnected(false);
            }
        };

        void start();

        return () => {
            stopped = true;
            setIsConnected(false);
            if (connection.state === signalR.HubConnectionState.Connected) {
                connection
                    .invoke("LeaveSeatRoom", eventId, ticketTypeId)
                    .catch(() => {})
                    .finally(() => connection.stop());
            } else {
                connection.stop();
            }
        };
    }, [eventId, ticketTypeId]);

    return { isConnected };
}
