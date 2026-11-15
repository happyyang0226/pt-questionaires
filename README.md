# 물리치료 환자 설문도구 (pt-questionaires)

부위별 표준 설문도구 웹앱 4종입니다. 정적 HTML이라 빌드 과정 없이 Vercel에 배포합니다.

| 경로 | 설문도구 |
|---|---|
| `/perinatal/` | 산전·산후 — PGQ, ODI, ICIQ-UI SF, EPDS, SF-12, SF-36, DRAM, PFIQ-7 |
| `/spine/` | 목·등·허리·엉치엉덩관절 — NDI, FRI, ODI, RMDQ, PGQ, FABQ |
| `/upper/` | 어깨·팔꿈치·손목·손 — QuickDASH, SPADI, PRTEE, PRWE, BCTQ |
| `/lower/` | 엉덩관절·무릎·발목·발 — LEFS, OHS, OKS, Lysholm, FAAM, FFI |

## 기능
- 설문 응답·자동 채점·결과 해석, 위험신호 안내
- 결과에 따른 운동지침·운동 방법(그림), 환자용 운동 안내문, 그림 운동 안내문 탭
- 임상의사결정 알고리즘
- 인쇄(빈 설문지·운동 안내문·결과 보고서)
- Supabase 로그인 + 가상 환자 사례 저장(학생은 본인 사례, 교수는 전체 조회)

## Supabase
- 프로젝트: `pt-questionnaires` (서울 리전)
- 테이블: `profiles`(이름·학번·역할), `cases`(사례), `professor_emails`(교수 권한 이메일)
- 보안: 모든 테이블에 RLS 적용. 학생은 자기 사례만 읽기·쓰기, 교수는 모든 사례 읽기
- 스키마: `supabase/migrations/`
- 교수 권한 부여: `professor_emails`에 이메일을 넣은 뒤 가입하거나, 이미 가입했다면
  `update public.profiles set role='professor' where email='교수 이메일';`
- 브라우저에 들어가는 키(`shared/config.js`)는 공개용 키입니다. 데이터 보호는 RLS가 담당합니다.

## 주의
수업용 교육 도구입니다. 실제 환자의 개인정보를 저장하지 마십시오.
