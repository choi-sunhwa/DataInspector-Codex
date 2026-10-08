# JSON Inspector / Formatter

React + TypeScript와 FastAPI + Python으로 만든 JSON 검증·정렬 도구입니다. 데이터베이스와 서버 저장 기능은 사용하지 않습니다.

## 기능

- JSON 입력, 예제 불러오기, 입력 비우기
- FastAPI를 통한 유효성 검사 및 오류 줄·열 표시
- 2 / 4 / 8칸 Pretty Print와 결과 복사
- 객체와 배열을 접고 펼치는 Tree View, 값의 타입 표시
- API 연결 오류 안내 및 반응형 화면

## 구조

```text
frontend/
  src/App.tsx        # 입력, API 연결, 결과 및 Tree View
  src/style.css      # 화면 스타일
  vite.config.ts     # /api 프록시
backend/
  main.py            # FastAPI와 JSON 처리
  requirements.txt   # 런타임 의존성
  test_main.py       # 실제 HTTP API 테스트 (Python 표준 라이브러리)
```

## 설치

Node.js 22.12 이상(또는 20.19 이상), npm, Python 3.10 이상이 필요합니다. 아래 명령은 프로젝트 루트에서 실행합니다.

### 백엔드 (Windows PowerShell)

```powershell
python -m venv backend/.venv
.\backend\.venv\Scripts\python.exe -m pip install --cache-dir .pip-cache -r backend/requirements.txt
```

macOS / Linux에서는 다음과 같이 설치합니다.

```bash
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install --cache-dir .pip-cache -r backend/requirements.txt
```

### 프론트엔드

```bash
cd frontend
npm install --cache .npm-cache --no-audit --no-fund
```

가상환경과 설치 캐시는 프로젝트 폴더 안에 생성됩니다. 프론트엔드의 `package-lock.json`을 포함하므로 재설치 시 `npm ci --cache .npm-cache`도 사용할 수 있습니다.

## 실행

터미널 두 개를 엽니다.

첫 번째 터미널에서 프로젝트 루트를 기준으로 백엔드를 실행합니다.

```powershell
.\backend\.venv\Scripts\python.exe -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```

macOS / Linux에서는 `backend/.venv/bin/python`으로 실행합니다.

두 번째 터미널에서 프론트엔드를 실행합니다.

```bash
cd frontend
npm run dev
```

- 화면: http://127.0.0.1:5173
- API 문서: http://127.0.0.1:8000/docs
- API 상태: http://127.0.0.1:8000/api/health

화면에서 JSON을 입력하고 **Pretty Print**를 누르면 정렬 결과와 Tree View가 준비됩니다. **유효성 검사**는 입력의 유효성만 확인합니다. 원본 입력은 정렬 시 그대로 유지됩니다.

Vite 개발 서버와 preview 서버가 `/api` 요청을 `http://127.0.0.1:8000`으로 프록시합니다. 프론트엔드와 백엔드를 모두 실행해야 합니다. 백엔드 포트를 바꾸면 `frontend/vite.config.ts`의 프록시 주소도 수정하세요.

## 빌드 및 테스트

```bash
cd frontend
npm run build
npm run preview
```

빌드는 TypeScript 검사 후 `frontend/dist`를 생성합니다. Preview 주소는 http://127.0.0.1:4173이며 별도로 실행된 백엔드가 필요합니다. 실제 배포 시 정적 파일을 제공하고 동일한 호스트의 `/api`를 FastAPI로 전달하는 리버스 프록시를 구성해야 합니다.

프로젝트 루트에서 백엔드 테스트를 실행합니다.

```powershell
.\backend\.venv\Scripts\python.exe -m unittest discover -s backend -v
```

테스트는 임시 로컬 포트에서 API를 시작해 정상 정렬, 검증, 오류 위치, 기본 JSON 값, 유니코드, 큰 정수, 입력 제한을 검사하고 종료합니다. 추가 테스트 패키지는 필요 없습니다.

## API

| 메서드 | 경로 | 동작 |
| --- | --- | --- |
| GET | `/api/health` | 상태 확인 |
| POST | `/api/validate` | `{ "valid": true, "error": null }` 또는 오류 정보 |
| POST | `/api/format` | `{ "formatted": "..." }`, JSON 오류는 HTTP 400 |

POST 요청 본문 예시:

```json
{ "text": "{\"hello\":\"world\"}", "indent": 2 }
```

`indent`는 생략하면 2이며 1~8을 허용합니다. 입력은 최대 1,000,000자이고 중첩은 100단계까지 허용합니다. 잘못된 요청 형식·입력 크기·indent는 HTTP 422로 응답합니다. `NaN`, `Infinity`, 표현 범위를 벗어나는 실수는 거부합니다.

## JSON 처리 특성

입력은 API로 전송되지만 저장하지 않습니다. 외부 서비스와 데이터베이스는 사용하지 않습니다. 정렬 결과는 Python JSON 직렬화를 사용하여 유니코드를 `\u` 이스케이프로 표시하고, 원본 공백 및 숫자 표기는 정규화합니다. 중복 객체 키는 Python JSON 파서의 기본 동작에 따라 마지막 값을 유지합니다.

Pretty Print는 큰 정수를 보존합니다. Tree View는 브라우저의 `JSON.parse`를 사용하므로 JavaScript 정밀도 범위를 넘는 숫자는 반올림될 수 있습니다. 정확한 숫자는 Pretty Print 결과에서 확인하세요.

## 구현 확인 결과

- `npm run build`: TypeScript 검사 및 Vite 프로덕션 빌드 통과
- 백엔드 HTTP 테스트: 5개 통과
- 브라우저: Pretty Print의 API 연결, Tree View 전환, 배열 노드 접기, 잘못된 JSON의 줄·열 오류 표시 확인
- 실행 화면: `screenshot.png`
