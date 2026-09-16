export type DevicePlatform = "ios" | "android" | "web";

export const DEVICE_PLATFORMS: readonly DevicePlatform[] = [
  "ios",
  "android",
  "web",
];

export type FcmDeviceTokenRow = {
  id: string;
  user_id: string;
  token: string;
  platform: DevicePlatform;
  device_id: string | null;
  app_version: string | null;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
};

export type RegisterFcmTokenBody = {
  token: string;
  platform: DevicePlatform;
  deviceId?: string | null;
  appVersion?: string | null;
};

export type UnregisterFcmTokenBody = {
  token: string;
};
