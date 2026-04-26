---
title: 'AI 에이전트에 멍에를 씌우다 — 하네스 엔지니어링과 Claude Code의 Plan Mode'
description: '하네스 엔지니어링의 개념을 소개하고, Claude Code의 Plan Mode를 구체적인 사례로 살펴봅니다. AI 에이전트의 자율성과 통제 사이에서 균형을 잡는 설계 패턴을 정리했습니다.'
pubDate: '2026-04-26'
category: 'engineering'
tags: ['harness-engineering', 'ai-agents', 'claude-code', 'plan-mode']
draft: false
---

## 하네스 엔지니어링이란?

**하네스(Harness)**는 말이나 개가 주인의 통제를 벗어나지 못하도록 걸치는 도구다. 소프트웨어 맥락에서 하네스 엔지니어링은 **AI 에이전트가 자율적으로 작업하되, 안전한 경계 내에서만 행동하도록 제약을 설계하는 기술**을 뜻한다.

LLM 기반 에이전트는 강력하지만, 그 자율성이 독이 될 수 있다. 사용자가 "인증 기능을 추가해줘"라고 했을 때, 에이전트가 즉시 코드를 작성하기 시작하면 다음과 같은 문제가 생긴다:

- 기존 코드베이스의 패턴을 무시하고 새로 작성
- 이미 있는 유틸리티를 다시 구현
- 사용자가 의도하지 않은 방향으로 확장
- 결과물을 나중에야 확인 → 대규모 재작업

하네스 엔지니어링은 이 문제를 **시스템 수준의 제약**으로 해결한다.

## Claude Code의 Plan Mode — 하네스 엔지니어링의 구체적 사례

Claude Code는 Anthropic이 만든 CLI 기반 AI 코딩 도구다. 이 도구에는 "Plan Mode"라는 기능이 있는데, 하네스 엔지니어링의 원칙이 매우 잘 구현되어 있다.

### 핵심 제약: 읽기만 허용, 쓰기는 금지

Plan Mode가 활성화되면:

- 파일 **수정** 불가
- 비읽기 도구 **실행** 불가
- 시스템 **변경** 불가
- 유일하게 쓰기가 허용되는 것은 **plan 파일 하나뿐**

사용자가 명시적으로 승인(ExitPlanMode)하기 전까지 어떤 코드도 변경되지 않는다.

### 5단계 워크플로우

Plan Mode는 다음 5단계를 강제한다:

#### Phase 1: Initial Understanding (초기 이해)

최대 3개의 **Explore 에이전트**가 병렬로 실행된다. 각 에이전트는 다른 초점으로 코드베이스를 탐색한다:

```
[Explore Agent 1] 기존 인증 관련 코드 탐색
  → middleware/, routes/auth/ 디렉토리 확인
  → 기존 세션/토큰 관련 유틸이 없음을 확인

[Explore Agent 2] 데이터베이스 스키마 조사
  → prisma/schema.prisma에 User 모델이 이미 존재
  → password 필드는 없고 OAuth만 지원 중

[Explore Agent 3] 테스트 패턴 파악
  → tests/ 디렉토리에서 Vitest + Supertest 패턴 발견
  → 기존 테스트 헬퍼: tests/helpers/create-test-user.ts
```

#### Phase 2: Design (설계)

**Plan 에이전트**가 Phase 1에서 수집한 정보를 바탕으로 구현 방안을 설계한다.

```
발견한 사실:
- User 모델이 이미 존재함 (prisma/schema.prisma:15)
- OAuth만 지원 중, password 필드 필요
- Vitest + Supertest 테스트 패턴 사용 중
- create-test-user 헬퍼 재사용 가능

설계:
1. schema.prisma에 password 해시 필드 추가
2. bcrypt로 비밀번호 해싱 유틸 생성
3. JWT 토큰 발급/검증 미들웨어 추가
4. /auth/register, /auth/login 엔드포인트 생성
5. 기존 create-test-user 헬퍼에 패스워드 지원 추가
```

#### Phase 3: Review (검토)

핵심 파일을 직접 읽고 계획이 사용자의 요청과 일치하는지 확인한다. 모호한 점은 사용자에게 질문하여 해소한다.

#### Phase 4: Final Plan (최종 계획)

plan 파일에 최종 계획을 작성한다:

```markdown
# 인증 기능 추가 계획

## Context
현재 OAuth만 지원하는 시스템에 이메일/비밀번호 인증을 추가

## 수정할 파일
1. prisma/schema.prisma — User 모델에 passwordHash 필드 추가
2. src/lib/auth.ts (신규) — JWT 발급/검증, bcrypt 해싱
3. src/middleware/auth.ts (신규) — 인증 미들웨어
4. src/routes/auth.ts (신규) — /register, /login 엔드포인트
5. tests/helpers/create-test-user.ts — 기존 헬퍼에 패스워드 지원 추가

## 재사용할 기존 코드
- tests/helpers/create-test-user.ts — 테스트 유저 생성 로직
- src/lib/db.ts — Prisma 클라이언트 싱글톤

## Verification
1. npx prisma migrate dev 실행하여 마이그레이션 확인
2. npm test로 전체 테스트 통과 확인
3. /auth/register → /auth/login → 보호된 엔드포인트 접근 흐름 테스트
```

#### Phase 5: ExitPlanMode (승인)

사용자가 계획을 검토하고 승인하면 Plan Mode가 종료된다. 이때 비로소 쓰기 권한이 복원되고 코드 수정이 가능해진다.

## Plan Mode가 보여주는 6가지 하네스 패턴

| 하네스 기법 | Plan Mode에서의 구현 |
|---|---|
| **권한 제한** | 탐색 단계에서는 읽기 도구만 사용 가능 |
| **체크포인트 강제** | 구현 전 반드시 계획 승인 단계를 거쳐야 함 |
| **역할 분리** | Explore(탐색), Plan(설계), Main(조율) 에이전트로 역할 분산 |
| **워크플로우 강제** | 5단계를 순차적으로 거치도록 강제, 단계 생략 불가 |
| **가시성 확보** | 계획 파일에 모든 의사결정이 기록되어 사용자가 검토 가능 |
| **안전 장치** | "코드를 먼저 쓰지 말 것"을 시스템 수준에서 강제 |

## 구체적 메커니즘

하네스는 프롬프트 수준의 "부탁"이 아니라 **시스템 수준의 강제**로 동작한다:

1. **도구 수준 제어**: Plan Mode에서는 Edit, Write, Bash(비읽기), NotebookEdit 도구가 원천 차단됨
2. **에이전트 샌드박싱**: Explore 에이전트는 읽기 도구만 사용 가능
3. **승인 게이트**: ExitPlanMode는 사용자의 명시적 승인이 있어야 통과
4. **구조화된 출력**: plan 파일의 형식(Context → 접근법 → 파일 → 검증)이 미리 정의되어 있음

## With Plan Mode vs Without Plan Mode

```
❌ Plan Mode 없이:
사용자: "인증 기능 추가해줘"
Claude: [바로 코딩 시작]
  → 기존 User 모델을 놓치고 새로 생성
  → 프로젝트의 테스트 패턴을 무시하고 Jest로 작성
  → 이미 있는 에러 핸들링을 다시 구현
  → 사용자는 결과물을 나중에야 확인 → 많은 재작업 발생

✅ Plan Mode 있이:
사용자: "인증 기능 추가해줘"
Claude: [Explore] 기존 코드를 먼저 파악 → [Plan] 설계 → [Review] 검토 → [승인 요청]
  → 기존 User 모델을 발견하고 재사용
  → 프로젝트의 Vitest 패턴을 따름
  → 기존 에러 핸들링과 create-test-user 헬퍼를 재사용
  → 사용자가 코드가 작성되기 전에 방향을 확인 → 최소한의 재작업
```

## 일반화 가능한 원칙

Plan Mode에서 추출할 수 있는 하네스 설계 원칙:

1. **신뢰하되 확인하라 (Trust but Verify)**: 에이전트의 탐색 능력은 신뢰하되, 실행 전 사용자가 검증
2. **권한은 최소한으로 (Least Privilege)**: 탐색 단계에서는 읽기 권한만 부여
3. **불가역 행위 전에 멈춤 (Pause Before Irreversible Actions)**: 코드 수정이라는 불가역 행위 전에 반드시 체크포인트
4. **구조화된 워크플로우 (Structured Workflow)**: 자유 형식이 아닌 정의된 단계와 산출물

## 결론

> Plan Mode는 AI에게 "생각은 자유롭게, 행동은 통제적으로"라는 원칙을 코드로 구현한 것이다. 에이전트는 탐색하고 설계할 자유를 갖지만, 코드를 수정할 권한은 사용자의 명시적 승인이라는 게이트 뒤에 있다.

하네스 엔지니어링은 AI 에이전트의 능력을 제한하는 것이 아니다. 오히려 **적절한 제약을 통해 에이전트의 능력을 더 안전하게, 더 유용하게 만드는 기술**이다. Claude Code의 Plan Mode는 이 철학이 실제 제품에 어떻게 구현될 수 있는지를 보여주는 훌륭한 사례다.
