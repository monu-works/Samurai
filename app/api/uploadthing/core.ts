export const runtime = "nodejs";

import { auth } from "@clerk/nextjs/server";
import { UploadThingError } from "uploadthing/server";
import { createUploadthing, type FileRouter } from "uploadthing/next";
const f = createUploadthing();

export const ourFileRouter = {
  pdfUploader: f({ pdf: { maxFileSize: "32MB" } })
    .middleware(async ({ req }) => {
      const { userId } = await auth();

      if (!userId) throw new UploadThingError("Unauthorized");
      return { userId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("upload completed for user id", metadata.userId);
      console.log("file url", file.ufsUrl);

      return {
        userId: metadata.userId,
        fileUrl: file.ufsUrl, // ✅ safe string
        fileName: file.name, // ✅ safe string
        fileSize: file.size, // ✅ safe number
        fileType: file.type, // ✅ safe string
      };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
