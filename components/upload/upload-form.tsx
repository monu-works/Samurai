"use client";

import { useUploadThing } from "@/utils/uploadthing";
import UploadInputForm from "./upload-form-input";
import { toast } from "sonner";
import { useRef, useState } from "react";
import { z } from "zod";
import { generateSummary, storePdfSummary } from "@/actions/upload-actions";
import { useRouter } from "next/navigation";

const schema = z.object({
  file: z
    .instanceof(File, { message: "Invalid file" })
    .refine((file) => file.size <= 20 * 1024 * 1024, "File must be < 20MB")
    .refine(
      (file) => file.type.startsWith("application/pdf"),
      "File must be a PDF"
    ),
});

export default function UploadForm() {
  const router = useRouter();

  const [isLoading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const { startUpload } = useUploadThing("pdfUploader", {
    onClientUploadComplete: () => {
      toast.success("✅ Upload successful! AI will summarize shortly.");
    },
    onUploadError: (error) => {
      console.error("UPLOADTHING ERROR 👉", error);
      toast.error(error.message || "Upload failed");
    },
    onUploadProgress: (progress) => {
      console.log("UPLOADTHING PROGRESS 👉", progress);
    },
    onUploadBegin: () => {
      toast("📤 Upload started...");
    },
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const file = formData.get("file");
      if (!(file instanceof File)) {
        toast.error("Please select a valid file.");
        return;
      }

      const validated = schema.safeParse({ file });
      if (!validated.success) {
        toast.error(
          validated.error.flatten().fieldErrors.file?.[0] || "Invalid file"
        );
        return;
      }

      const uploadResponse = await startUpload([file]);
      if (!uploadResponse || !uploadResponse[0]) {
        toast.error("File upload failed.");
        return;
      }

      // Transform the response to match the expected type for generateSummary
      const formattedResponse = {
        url: uploadResponse[0].url,
        name: uploadResponse[0].name,
        serverData: {
          userId: uploadResponse[0].serverData?.userId || "",
          file: {
            url: uploadResponse[0].url,
            name: uploadResponse[0].name,
          },
        },
      };

      const result = await generateSummary(formattedResponse);
      if (!result.success || !result.data) {
        toast.error(result.message || "Summary generation failed.");
        return;
      }

      toast.success("✅ Summary generated!");

      const storedSummary = await storePdfSummary({
        originalFileUrl: uploadResponse[0].url,
        summaryText: result.data.summary,
        title: result.data.title, // use formatted title from server
        fileName: uploadResponse[0].name,
      });

      if (storedSummary.success && storedSummary.data?.id) {
        toast.success("✅ Summary saved successfully!");
        formRef.current?.reset();
        router.push(`/summaries/${storedSummary.data.id}`);
      } else {
        toast.error("Failed to save summary. Please try again.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Unexpected error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl flex flex-col w-full gap-8 mx-auto">
      <UploadInputForm
        ref={formRef}
        isLoading={isLoading}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
