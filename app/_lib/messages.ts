export const GENERAL_AFFAIRS_CONTACT_MESSAGE = "답을 찾지 못했어요. 총무팀(02-2290-9024)으로 문의해주세요.";
export const HR_CONTACT_MESSAGE = "급여 관련 문의는 인사팀으로 연락해주세요. (내선 9025)";
export const ERROR_MESSAGE = "일시적인 오류입니다. 총무팀(02-2290-9024)으로 문의해주세요.";

// "수당"은 뺐다 — "기본수당/가족수당" 카테고리의 정상 질문(예: "가족수당이 무엇인지 궁금해요!")까지
// 급여 질문으로 오인해서, 관리자가 그 카테고리에 등록해둔 담당자 안내 대신 이 인사팀 문구가 먼저 나가버렸다.
export const SALARY_KEYWORDS = ["급여", "월급", "연봉", "세금", "원천징수"];

export function containsSalaryKeyword(question: string): boolean {
  return SALARY_KEYWORDS.some((keyword) => question.includes(keyword));
}
