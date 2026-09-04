// 전화번호·사번으로 추정되는 6자리 이상 숫자를 가린다. "010-1234-5678"처럼 하이픈·공백으로
// 나뉜 숫자도 합쳐서 세어 가리고, 4자리 안내번호("9024")나 연도는 그대로 둔다.
function maskLongDigits(text: string): string {
  return text.replace(/\d(?:[\d\s.-]*\d)?/g, (match) => ((match.match(/\d/g)?.length ?? 0) >= 6 ? "****" : match));
}

// 이메일 주소도 개인 식별 정보라 함께 가린다.
function maskEmails(text: string): string {
  return text.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "****");
}

export function maskPersonalInfo(text: string): string {
  return maskEmails(maskLongDigits(text));
}
