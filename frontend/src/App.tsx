import { useRef, useState } from 'react';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type Problem = { message: string; line?: number | null; column?: number | null };
const sample = '{"project":"JSON Inspector","version":1,"active":true,"features":["Pretty Print","Validation","Tree View"],"settings":{"indent":2,"database":null}}';

function TreeNode({ name, value }: { name: string; value: JsonValue }) {
  const branch = value !== null && typeof value === 'object';
  if (!branch) {
    const kind = value === null ? 'null' : typeof value;
    return <div className="leaf"><span className="key">{name}</span><span className={`value ${kind}`}>{JSON.stringify(value)}</span><span className="type">{kind}</span></div>;
  }
  const entries = Object.entries(value);
  return <details open>
    <summary><span className="key">{name}</span><span className="type">{Array.isArray(value) ? 'Array' : 'Object'} · {entries.length}</span></summary>
    <div className="children">{entries.length === 0 ? <span className="empty-branch">비어 있음</span> : entries.map(([key, child]) => <TreeNode key={key} name={key} value={child} />)}</div>
  </details>;
}

async function request(path: string, text: string, indent: number) {
  let response: Response;
  try {
    response = await fetch(`/api/${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, indent }),
    });
  } catch {
    throw new Error('API에 연결할 수 없습니다. 백엔드 실행 상태를 확인해 주세요.');
  }
  if (response.status === 502 || response.status === 503 || response.status === 504) {
    throw new Error('API에 연결할 수 없습니다. 백엔드 실행 상태를 확인해 주세요.');
  }
  const data = await response.json();
  if (!response.ok) {
    const detail = data.detail;
    if (detail && !Array.isArray(detail) && typeof detail.message === 'string') throw detail as Problem;
    throw new Error('요청을 처리할 수 없습니다. 입력은 최대 1,000,000자입니다.');
  }
  return data;
}

export default function App() {
  const [input, setInput] = useState(sample);
  const [indent, setIndent] = useState(2);
  const [formatted, setFormatted] = useState<string | null>(null);
  const [tree, setTree] = useState<JsonValue>(null);
  const [view, setView] = useState<'pretty' | 'tree'>('pretty');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const revision = useRef(0);

  function edit(text: string) {
    revision.current += 1;
    setInput(text); setFormatted(null); setStatus(null); setBusy(false);
  }

  async function run(action: 'validate' | 'format') {
    const current = ++revision.current;
    setBusy(true); setStatus(null);
    try {
      const data = await request(action, input, indent);
      if (revision.current !== current) return;
      if (action === 'validate' && !data.valid) throw data.error as Problem;
      if (action === 'format') {
        setFormatted(data.formatted);
        setTree(JSON.parse(data.formatted) as JsonValue);
      }
      setStatus({ ok: true, text: action === 'validate' ? '유효한 JSON입니다.' : 'JSON을 정렬했습니다. Tree View에서도 확인할 수 있습니다.' });
    } catch (error) {
      if (revision.current !== current) return;
      const problem = error as Problem;
      const location = problem.line ? ` (${problem.line}행, ${problem.column}열)` : '';
      setFormatted(null);
      setStatus({ ok: false, text: `${problem.message || '요청 처리 중 오류가 발생했습니다.'}${location}` });
    } finally {
      if (revision.current === current) setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(formatted!);
      setStatus({ ok: true, text: '정렬된 JSON을 복사했습니다.' });
    } catch {
      setStatus({ ok: false, text: '복사할 수 없습니다. 결과에서 직접 선택해 복사해 주세요.' });
    }
  }

  return <div className="app">
    <header><a className="brand" href="/" aria-label="JSON Inspector 홈"><span className="logo">{'{ }'}</span>JSON Inspector</a><span className="badge">STATELESS · NO DATABASE</span></header>
    <main>
      <div className="intro"><div className="eyebrow">DEVELOPER TOOLKIT / 01</div><h1>JSON을 더 선명하게.</h1><p>붙여넣고, 검증하고, 구조를 살펴보세요.</p></div>
      <div className="toolbar"><div className="actions"><button className="primary" disabled={busy} onClick={() => void run('format')}>{busy ? '처리 중…' : 'Pretty Print'}</button><button disabled={busy} onClick={() => void run('validate')}>유효성 검사</button></div><label>들여쓰기 <select value={indent} onChange={e => { setIndent(Number(e.target.value)); }}><option value={2}>2칸</option><option value={4}>4칸</option><option value={8}>8칸</option></select></label></div>
      <div className={`status ${status ? (status.ok ? 'success' : 'error') : ''}`} role="status" aria-live="polite">{status?.text || 'JSON을 입력하고 Pretty Print를 누르면 결과와 트리가 표시됩니다.'}</div>
      <div className="workspace">
        <section className="panel"><div className="panel-header"><label htmlFor="json-input">JSON 입력</label><div className="panel-actions"><button onClick={() => edit(sample)}>예제</button><button onClick={() => edit('')}>비우기</button></div></div><textarea id="json-input" value={input} onChange={e => edit(e.target.value)} spellCheck={false} placeholder={'{\n  "hello": "world"\n}'} aria-label="JSON 입력" /><div className="panel-footer"><span>RAW JSON</span><span>{input.length.toLocaleString()}자</span></div></section>
        <section className="panel"><div className="panel-header"><div className="tabs" role="tablist" aria-label="결과 보기"><button id="pretty-tab" role="tab" aria-selected={view === 'pretty'} aria-controls="result-panel" className={view === 'pretty' ? 'selected' : ''} onClick={() => setView('pretty')}>Pretty Print</button><button id="tree-tab" role="tab" aria-selected={view === 'tree'} aria-controls="result-panel" className={view === 'tree' ? 'selected' : ''} onClick={() => setView('tree')}>Tree View</button></div><button disabled={formatted === null} onClick={() => void copy()}>복사</button></div>
          <div id="result-panel" className="result" role="tabpanel" aria-labelledby={view === 'pretty' ? 'pretty-tab' : 'tree-tab'}>{formatted === null ? <div className="placeholder"><span>{'{ … }'}</span><strong>구조가 보이는 순간</strong><p>정렬된 JSON이 여기에 표시됩니다.</p></div> : view === 'pretty' ? <pre tabIndex={0}>{formatted}</pre> : <div className="tree"><TreeNode key={formatted} name="$" value={tree} /></div>}</div>
          <div className="panel-footer"><span>{view === 'pretty' ? 'FORMATTED JSON' : 'EXPAND / COLLAPSE'}</span><span>{formatted === null ? '대기 중' : `${formatted.split('\n').length}줄`}</span></div>
        </section>
      </div>
      <p className="note">입력은 검증·정렬을 위해 연결된 API로 전송되며 서버에 저장되지 않습니다. Tree View의 숫자는 JavaScript 정밀도 범위를 따릅니다.</p>
    </main>
    <footer><span>JSON Inspector</span><span>React + TypeScript / FastAPI + Python</span></footer>
  </div>;
}
