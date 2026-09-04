// 사용자가 실제로 쓰는 표현이 등록된 카테고리 이름과 달라도 같은 카테고리로 인식하도록 돕는 동의어 목록.
// AI 분류(classifyCategory)에 맡기면 애매한 경우 다르게 분류될 수 있어, 여기 등록된 단어는 항상 정해진 카테고리로 확정한다.
// 새 동의어가 필요하면 이 목록에 추가한다.
export const CATEGORY_SYNONYMS: Record<string, string[]> = {
  경조금: ["경조사비"],
  감면: ["재단가족"],
};

// 질문에 동의어가 포함돼 있으면 그 카테고리를 바로 반환한다 (지금 유효한 카테고리 목록에 있을 때만).
export function matchCategoryBySynonym(question: string, categories: string[]): string | null {
  for (const [category, synonyms] of Object.entries(CATEGORY_SYNONYMS)) {
    if (!categories.includes(category)) continue;
    if (synonyms.some((word) => question.includes(word))) return category;
  }
  return null;
}
