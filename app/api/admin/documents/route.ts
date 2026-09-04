import { NextResponse } from "next/server";
import { requireAdminSession } from "@/app/_lib/adminSession";
import { getDocument, isCategory, listDocuments, saveDocument } from "@/app/_lib/store";

const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB
const MIN_TEXT_LENGTH = 50;

export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  return NextResponse.json({ documents: await listDocuments() });
}

export async function POST(request: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const category = formData?.get("category");
  const file = formData?.get("file");

  if (!(await isCategory(category))) {
    return NextResponse.json({ error: "카테고리를 선택해주세요." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "파일을 선택해주세요." }, { status: 400 });
  }
  if (await getDocument(category as string)) {
    return NextResponse.json({ error: "이미 등록된 문서가 있어요. 먼저 기존 문서를 삭제해주세요." }, { status: 409 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "PDF 파일만 등록할 수 있어요." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "파일 크기는 4MB 이하만 가능해요." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let contentText = "";
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    await parser.destroy();
    contentText = parsed.text.trim();
  } catch {
    return NextResponse.json({ error: "PDF 파일을 읽는 중 오류가 발생했어요." }, { status: 400 });
  }

  if (contentText.length < MIN_TEXT_LENGTH) {
    return NextResponse.json({ error: "텍스트를 추출할 수 없는 PDF입니다. (스캔본일 수 있어요)" }, { status: 400 });
  }

  const document = await saveDocument(category as string, file.name, contentText, buffer);
  return NextResponse.json({ document });
}
