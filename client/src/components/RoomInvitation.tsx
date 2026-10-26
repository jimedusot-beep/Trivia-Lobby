import { useEffect, useRef } from "react";
import { mountRoomInvitation, type RoomInvitationOptions } from "../../../examples/party-engine/public/room-invite.js";

/** The same local QR/share widget is used on every guest and private host screen. */
export function RoomInvitation({ url, code, assignment }: RoomInvitationOptions) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!container.current) return;
    const card = mountRoomInvitation(container.current, { url, code, assignment });
    return () => card.remove();
  }, [url, code, assignment]);
  return <div ref={container} className="w-full" />;
}
