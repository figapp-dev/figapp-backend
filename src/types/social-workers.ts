export type SocialWorkerDto = {
  userId: string;
  displayName: string;
  figappId: string | null;
  email: string | null;
  phone: string | null;
  fosterCarersCount: number;
};

export type SocialWorkerListDto = {
  socialWorkers: SocialWorkerDto[];
};
