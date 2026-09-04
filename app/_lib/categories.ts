export const CATEGORIES = [
  "경조금",
  "화환",
  "보육료/학자금",
  "주차",
  "식대",
  "휴가/휴직",
  "기본수당/가족수당",
  "증명서/신분증",
  "감면",
  "복리후생",
  "기타",
] as const;

// 관리자가 새 카테고리를 추가할 수 있어서 실제 카테고리 집합은 컴파일 시점에 고정되지 않는다.
// CATEGORIES는 기본으로 제공되는 카테고리 목록일 뿐이고, 유효성 검사는 store.ts의 getAllCategories()를 따른다.
export type Category = string;

export const CATEGORY_EMOJI: Record<string, string> = {
  경조금: "💰",
  화환: "💐",
  "보육료/학자금": "🎓",
  주차: "🚗",
  식대: "🍽️",
  "휴가/휴직": "🌴",
  "기본수당/가족수당": "💵",
  "증명서/신분증": "🆔",
  감면: "🏷️",
  복리후생: "🎁",
  "복리후생(휴양소, 동아리 등)": "🎁",
  기타: "📋",
};

const DEFAULT_CATEGORY_EMOJI = "📁";

// 관리자가 새로 추가한 카테고리처럼 정해진 이모지가 없는 경우 기본 이모지를 대신 쓴다.
export function getCategoryEmoji(category: string): string {
  return CATEGORY_EMOJI[category] ?? DEFAULT_CATEGORY_EMOJI;
}
