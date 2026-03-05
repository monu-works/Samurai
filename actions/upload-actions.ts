"use server";

import { fetchAndExtractPdfText } from "@/lib/langchain";
import { generateSummaryFromOpenAI } from "@/lib/openai";
import { generateSummaryFromGemini } from "@/lib/gemini";
import { generateSummaryFromHuggingFace } from "@/lib/huggingface";
import { getDbConnection } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { formatFileNameAsTitle } from "@/utils/format-utils";
import { revalidatePath } from "next/cache";

interface PDFSummaryType {
  userId: string;
  originalFileUrl: string;
  summaryText: string;
  title: string;
  fileName: string;
}

export async function generateSummary(uploadResponse: {
  url: string;
  name: string;
  serverData?: {
    userId: string;
    file: { url: string; name: string };
  };
}) {
  const pdfUrl = uploadResponse.serverData?.file?.url ?? uploadResponse.url;
  const fileName = uploadResponse.serverData?.file?.name ?? uploadResponse.name;

  if (!pdfUrl) {
    return { success: false, message: "No PDF URL found.", data: null };
  }

  try {
    const pdfText = await fetchAndExtractPdfText(pdfUrl);
    let summary;

    try {
      summary = await generateSummaryFromOpenAI(pdfText);
    } catch (error) {
      // if (error instanceof Error && error.message === "RATE_LIMIT_EXCEEDED") {
      //   summary = await generateSummaryFromGemini(pdfText);
      // } else {
      //   return { success: false, message: "AI summary failed.", data: null };
      // }
      try {
        summary = await generateSummaryFromHuggingFace(pdfText);
      } catch (hfError) {
        console.log("HuggingFace also failed:", hfError);
        return { success: false, message: "AI summary failed.", data: null };
      }
    }

    if (!summary) {
      return { success: false, message: "Empty summary.", data: null };
    }

    return {
      success: true,
      message: "Summary generated successfully.",
      data: { title: formatFileNameAsTitle(fileName), summary },
    };
  } catch (err) {
    return { success: false, message: "Error processing PDF.", data: null };
  }
}

async function saveSummaryPdf({
  userId,
  originalFileUrl,
  summaryText,
  title,
  fileName,
}: PDFSummaryType) {
  try {
    const sql = await getDbConnection();
    const result = await sql`
      INSERT INTO pdf_summaries (user_id, original_file_url, summary_text, status, title, file_name)
      VALUES (${userId}, ${originalFileUrl}, ${summaryText}, 'completed', ${title}, ${fileName})
      RETURNING id;;
    `;
    console.log(result);
    return result[0];
  } catch (error) {
    console.error("Error saving pdf summary", error);
    throw error;
  }
}

export async function storePdfSummary({
  originalFileUrl,
  summaryText,
  title,
  fileName,
}: Omit<PDFSummaryType, "userId">) {
  let savedSummary;
  try {
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        message: "User not found",
      };
    }

    savedSummary = await saveSummaryPdf({
      userId,
      originalFileUrl,
      summaryText,
      title,
      fileName,
    });
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Error saving PDF summary",
    };
  }
  // revalidate our cache
  revalidatePath(`/summaries/${savedSummary.id}`);
  return {
    success: true,
    message: "PDF summary saved successfully.",
    data: savedSummary ?? null, // Be explicit if for some reason saveSummaryPdf fails silently
  };
}
