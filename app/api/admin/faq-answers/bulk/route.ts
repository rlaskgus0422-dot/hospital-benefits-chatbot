import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/app/_lib/adminSession";
import { bulkUpsertFaqAnswers } from "@/app/_lib/store";

const MAX_FILE_SIZE = 4 * 1024 * 1024; // 문서 업로드와 동일하게 4MB로 제한
const REQUIRED_HEADERS = ["카테고리", "질문", "답변"] as const;
// 압축된 xlsx는 4MB 안에도 수십만 행이 들어갈 수 있는데, 한 행마다 JSON 파일 전체를
// 다시 쓰는 구조라 행이 많아지면 처리 시간이 행 수의 제곱에 비례해 늘어난다. 상한을 둔다.
const MAX_ROWS = 2000;

export async function POST(request: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "엑셀 파일을 선택해주세요." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "파일 크기는 4MB 이하만 가능해요." }, { status: 400 });
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "엑셀 파일을 읽을 수 없어요. (.xlsx 형식인지 확인해주세요)" }, { status: 400 });
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return NextResponse.json({ error: "시트를 찾을 수 없어요." }, { status: 400 });
  }

  const headerRow = worksheet.getRow(1).values as unknown[];
  const columnOf = (label: string) => headerRow.findIndex((cell) => String(cell ?? "").trim() === label);
  const columns = Object.fromEntries(REQUIRED_HEADERS.map((label) => [label, columnOf(label)]));

  if (REQUIRED_HEADERS.some((label) => columns[label] < 0)) {
    return NextResponse.json(
      { error: "첫 번째 행에 '카테고리', '질문', '답변' 열 제목이 모두 있어야 해요." },
      { status: 400 }
    );
  }

  const rows: { category: string; question: string; answer: string }[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // 헤더 행은 건너뜀
    if (rows.length >= MAX_ROWS) return;
    rows.push({
      category: String(row.getCell(columns["카테고리"]).value ?? "").trim(),
      question: String(row.getCell(columns["질문"]).value ?? "").trim(),
      answer: String(row.getCell(columns["답변"]).value ?? "").trim(),
    });
  });

  if (worksheet.rowCount - 1 > MAX_ROWS) {
    return NextResponse.json({ error: `한 번에 ${MAX_ROWS}행까지만 업로드할 수 있어요. 파일을 나눠서 올려주세요.` }, { status: 400 });
  }

  const result = await bulkUpsertFaqAnswers(rows);
  return NextResponse.json(result);
}
