export type ChildDocumentDto = {
  id: string;
  title: string;
  filePath: string | null;
  fileType: string | null;
  fileSizeBytes: number | null;
  createdAt: string | null;
  createdBy: string | null;
  childId: string;
};

export type ChildDocumentsListDto = {
  childId: string;
  documents: ChildDocumentDto[];
};

export type CreateChildDocumentBody = {
  title: string;
  filePath: string;
  fileType?: string | null;
  fileSizeBytes?: number | null;
};
