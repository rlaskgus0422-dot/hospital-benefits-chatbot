-- 초기 스키마: 로컬 JSON 파일(data/*.json) 저장소를 대체한다.
-- 카테고리 이름 변경/삭제 시 관련 테이블에 자동으로 전파되도록 FK의
-- on update cascade / on delete cascade(또는 set null)를 활용한다.

create table categories (
  name text primary key,
  position int not null,
  created_at timestamptz not null default now()
);

create table category_questions (
  category text not null references categories(name) on update cascade on delete cascade,
  question text not null,
  position int not null,
  primary key (category, question)
);

create table faq_answers (
  category text not null references categories(name) on update cascade on delete cascade,
  question text not null,
  answer text not null,
  primary key (category, question)
);

create table contact_messages (
  category text primary key references categories(name) on update cascade on delete cascade,
  message text not null
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  category text not null unique references categories(name) on update cascade on delete cascade,
  file_name text not null,
  content_text text not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

-- 질문·답변 로그. 개인 식별 정보(IP, User-Agent 등)는 저장하지 않는다.
create table chat_logs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  matched_category text references categories(name) on update cascade on delete set null,
  answer_type text not null check (answer_type in ('answered', 'no_answer', 'hr_referral', 'error')),
  feedback text check (feedback in ('helpful', 'unhelpful')),
  created_at timestamptz not null default now()
);

create index chat_logs_created_at_idx on chat_logs (created_at);

-- RLS를 켜두되 정책은 추가하지 않는다 — 서버는 service role 키로 항상 RLS를 우회하므로
-- 동작에는 영향이 없고, 혹시 나중에 anon key가 클라이언트에 노출되더라도 기본적으로
-- 전부 차단된 상태를 유지하기 위한 안전장치다.
alter table categories enable row level security;
alter table category_questions enable row level security;
alter table faq_answers enable row level security;
alter table contact_messages enable row level security;
alter table documents enable row level security;
alter table chat_logs enable row level security;
