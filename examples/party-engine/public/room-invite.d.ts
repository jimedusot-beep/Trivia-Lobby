export type RoomInvitationOptions = { url: string; code?: string; assignment?: boolean };
export function guestInvitation(pageUrl: string, code: string): string;
export function invitationGeometry(url: string): { size: number; path: string } | null;
export function invitationSvg(url: string, label: string): SVGSVGElement | null;
export function copyInvitation(url: string): Promise<boolean>;
export function shareInvitation(url: string): Promise<"shared" | "copied" | "manual" | "cancelled">;
export function saveInvitationQr(url: string, label: string, filename: string): boolean;
export function mountRoomInvitation(container: HTMLElement, options: RoomInvitationOptions): HTMLElement;
