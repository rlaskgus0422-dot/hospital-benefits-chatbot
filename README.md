# 인사팀/총무팀 챗봇

병원 교직원을 위한 복리후생 문의 챗봇 서비스입니다. 경조금·화환·식대·주차·휴가 등 카테고리별로 자주 묻는 질문에 답하고, 등록된 공지사항·사내 규정 원문을 근거로만 답변합니다. 근거를 찾지 못하면 추측하지 않고 총무팀(또는 인사팀) 연락처를 안내합니다.

## 주요 기능

- **카테고리별 문의**: 경조금, 화환, 식대, 주차, 보육료/학자금, 휴가/휴직, 기본수당/가족수당, 증명서/신분증, 감면 등 카테고리를 고르거나 자유 질문 입력
- **자주 묻는 질문(FAQ)**: 카테고리마다 등록된 질문 버튼을 누르면 바로 답변
- **규정 문서 기반 답변**: 관리자가 등록한 PDF 규정 원문을 근거로 OpenAI API가 답변 생성 (근거 없으면 "모른다"고 답함)
- **대화 맥락 유지**: 직전 대화를 참고해 "그럼 언제 받아요?" 같은 이어지는 질문도 이해
- **관리자 대시보드**: 카테고리 관리(추가·이름변경·순서변경), FAQ 질문·답변 관리(엑셀 일괄 업로드 지원), 규정 PDF 업로드, 카테고리별 담당자 안내 문구 설정, 질문·답변 로그 조회 및 통계
- **개인정보 보호**: 질문 속 전화번호·사번 등 긴 숫자와 이메일을 자동 마스킹하고, IP·User-Agent 등 개인 식별 정보는 저장하지 않음. 로그는 90일 후 자동 삭제
- **접근 제한**: 관리자 페이지는 별도 비밀번호로 보호 (일반 챗봇 화면은 인터넷 어디서나 접속 가능)

## 기술 스택

- **프레임워크**: Next.js 16 (App Router)
- **언어**: TypeScript (strict), React 19
- **스타일**: Tailwind CSS v4
- **AI 응답 엔진**: OpenAI API (`gpt-4o-mini`)
- **배포**: Vercel

## 개발 환경 설정

```bash
npm install
```

`.env` 파일에 아래 값을 채워주세요.

```
OPENAI_API_KEY=             # OpenAI API 키
ADMIN_PASSWORD=             # 관리자 페이지 로그인 비밀번호
SESSION_SECRET=             # 관리자 세션 서명용 무작위 값 (openssl rand -hex 32)
SUPABASE_URL=                # Supabase 프로젝트 주소
SUPABASE_SERVICE_ROLE_KEY=   # 서버 전용 Supabase 관리자 키 (절대 클라이언트에 노출 금지)
```

```bash
npm run dev    # 개발 서버 실행
npm run build  # 프로덕션 빌드
npm run start  # 프로덕션 서버 실행
npm run lint   # ESLint 검사
```

## 데이터 저장 관련 안내

카테고리·질문·FAQ 답변·담당자 안내 문구·대화 로그는 Supabase(Postgres)에, 등록된 규정 PDF 원본은 Supabase Storage의 비공개 버킷(`regulation-documents`)에 저장합니다. Vercel처럼 배포된 파일시스템이 읽기 전용인 서버리스 환경에서도 관리자 페이지의 저장 기능이 정상 동작합니다. 스키마는 [supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql), 데이터 흐름은 [DESIGN.md](DESIGN.md) §2-3을 참고하세요.

## 문서

- [PRD.md](PRD.md) — 기획 배경과 범위
- [PLAN.md](PLAN.md) — 구현 계획
- [DESIGN.md](DESIGN.md) — 설계 문서
- [CLAUDE.md](CLAUDE.md) — 프로젝트 작업 규칙
