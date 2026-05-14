export interface RoomSettings {
  autoAccept: boolean;
  autoReject: boolean;
}

export interface Room {
  owner: string;
  tag: string;
  ownerKey?: string;
  settings: RoomSettings;
  createdAt: number;
}