import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/app/_lib/adminSession";
import { getAllCategories } from "@/app/_lib/store";

// 카테고리당 여러 질문을 추가로 적을 수 있도록 미리 넣어두는 빈 행 수.
const EXTRA_BLANK_ROWS = 30;

// 일괄 업로드용 엑셀 양식. 카테고리 열은 현재 등록된 카테고리로 미리 채워서 관리자가 질문/답변 칸만 채우면 되게 하고,
// 카테고리 칸은 드롭다운으로 제한해서 관리자 페이지에 없는 이름을 잘못 적는 걸 막는다.
export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const categories = getAllCategories();
  const workbook = new ExcelJS.Workbook();

  // 드롭다운이 참조할 카테고리 목록 시트 — 다운로드할 때마다 현재 카테고리로 새로 만들어지므로
  // 관리자 페이지에서 카테고리를 추가/이름변경/삭제하면 다음 다운로드부터 바로 반영된다.
  const listSheet = workbook.addWorksheet("카테고리목록", { state: "veryHidden" });
  categories.forEach((category, index) => {
    listSheet.getCell(`A${index + 1}`).value = category;
  });

  const sheet = workbook.addWorksheet("FAQ 업로드 양식");
  sheet.columns = [
    { header: "카테고리", key: "category", width: 22 },
    { header: "질문", key: "question", width: 40 },
    { header: "답변", key: "answer", width: 60 },
  ];
  sheet.getRow(1).font = { bold: true };

  categories.forEach((category) => {
    sheet.addRow({ category, question: "", answer: "" });
  });
  for (let i = 0; i < EXTRA_BLANK_ROWS; i += 1) {
    sheet.addRow({ category: "", question: "", answer: "" });
  }

  const lastRow = categories.length + EXTRA_BLANK_ROWS + 1;
  for (let row = 2; row <= lastRow; row += 1) {
    sheet.getCell(`A${row}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`'카테고리목록'!$A$1:$A$${categories.length}`],
      showErrorMessage: true,
      errorStyle: "error",
      errorTitle: "잘못된 카테고리",
      error: "관리자 페이지에 등록된 카테고리 중에서만 선택할 수 있어요.",
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="faq-upload-template.xlsx"',
    },
  });
}
