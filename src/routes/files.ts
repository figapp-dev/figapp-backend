import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { bearerSecurity, errorResponses } from "../plugins/swagger.js";
import {
  createFileUploadUrl,
  createSignedDownloadUrl,
} from "../services/files/index.js";
import {
  badRequest,
  forbidden,
  internalError,
  notFound,
} from "../lib/errors.js";
import { ErrorMessages } from "../constants/error-messages.js";
import {
  createFileUploadBodySchema,
  createSignedUrlBodySchema,
} from "../schemas/files.js";
import type {
  CreateFileUploadBody,
  CreateSignedUrlBody,
} from "../types/files.js";

export async function filesRoute(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.post<{ Body: CreateFileUploadBody }>(
    "/files/signed-upload-url",
    {
      schema: {
        tags: ["files"],
        summary: "Create signed upload URL (does not upload bytes)",
        security: [...bearerSecurity],
        body: createFileUploadBodySchema,
        response: {
          200: { $ref: "CreateFileUploadDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const body = request.body;

      const result = await createFileUploadUrl(
        request.supabase,
        request.user.id,
        {
          resource: body.resource,
          id: body.id,
          fieldId: body.fieldId,
          fileName: body.fileName,
        },
      );

      if (result.badRequest) {
        throw badRequest(ErrorMessages.FILE_UPLOAD_BODY_REQUIRED);
      }
      if (result.unsupported) {
        throw badRequest(ErrorMessages.FILE_RESOURCE_NOT_SUPPORTED);
      }
      if (result.forbidden) {
        throw forbidden(ErrorMessages.FILE_ACCESS_DENIED);
      }
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.FILE_UPLOAD_FAILED);
      }

      return result.data;
    },
  );

  app.post<{ Body: CreateSignedUrlBody }>(
    "/files/signed-url",
    {
      schema: {
        tags: ["files"],
        summary: "Create signed download URL for an existing path",
        security: [...bearerSecurity],
        body: createSignedUrlBodySchema,
        response: {
          200: { $ref: "SignedUrlDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const body = request.body;

      const result = await createSignedDownloadUrl(
        request.supabase,
        request.user.id,
        {
          bucket: body.bucket,
          path: body.path,
          expiresIn: body.expiresIn,
        },
      );

      if (result.badRequest) {
        throw badRequest(ErrorMessages.FILE_BUCKET_NOT_ALLOWED);
      }
      if (result.forbidden) {
        throw forbidden(ErrorMessages.FILE_ACCESS_DENIED);
      }
      if (result.notFound) {
        throw notFound(ErrorMessages.FILE_OBJECT_NOT_FOUND);
      }
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.FILE_SIGNED_URL_FAILED);
      }

      return result.data;
    },
  );
}
