import { useEffect, useState } from 'react';

interface MaterialPreviewSheetProps {
  blob: Blob;
  csv?: boolean;
}

interface SheetTab {
  name: string;
  rows: string[][];
  truncated: boolean;
}

const MAX_ROWS = 500;
const MAX_COLS = 60;

function cellText(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (value instanceof Date) {
    return value.toLocaleString();
  }
  return String(value);
}

/** Excel / CSV 原件预览：直接读工作簿，按工作表切换成表格。 */
export default function MaterialPreviewSheet({ blob, csv }: MaterialPreviewSheetProps) {
  const [sheets, setSheets] = useState<SheetTab[]>([]);
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setStatus('loading');
      setError('');
      try {
        const XLSX = await import('@e965/xlsx');
        const workbook = csv
          ? XLSX.read(await blob.text(), { type: 'string' })
          : XLSX.read(await blob.arrayBuffer(), { type: 'array' });
        if (cancelled) {
          return;
        }
        const parsed: SheetTab[] = workbook.SheetNames.map((name) => {
          const sheet = workbook.Sheets[name];
          const raw = sheet
            ? XLSX.utils.sheet_to_json<unknown[]>(sheet, {
                header: 1,
                raw: false,
                defval: '',
                blankrows: false,
              })
            : [];
          const truncated =
            raw.length > MAX_ROWS ||
            raw.some((row) => Array.isArray(row) && row.length > MAX_COLS);
          const rows = raw.slice(0, MAX_ROWS).map((row) =>
            (Array.isArray(row) ? row : []).slice(0, MAX_COLS).map(cellText),
          );
          return { name, rows, truncated };
        });
        setSheets(parsed);
        setActive(0);
        setStatus('ready');
      } catch (cause) {
        if (!cancelled) {
          setStatus('error');
          setError(cause instanceof Error ? cause.message : '无法解析该表格');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [blob, csv]);

  if (status === 'error') {
    return (
      <div className="preview-state">
        <b>表格打开失败</b>
        <p>{error || '文件可能已损坏，或不是有效的 Excel 文件'}</p>
      </div>
    );
  }
  if (status === 'loading') {
    return <div className="preview-state">正在读取表格…</div>;
  }
  const current = sheets[active];
  return (
    <div className="sheet-viewer">
      {sheets.length > 1 ? (
        <div className="sheet-tabs">
          {sheets.map((item, index) => (
            <button
              key={item.name}
              className={index === active ? 'active' : ''}
              type="button"
              onClick={() => setActive(index)}
            >
              {item.name}
            </button>
          ))}
        </div>
      ) : null}
      <div className="sheet-scroll">
        {!current || current.rows.length === 0 ? (
          <div className="preview-state">该工作表没有内容</div>
        ) : (
          <table className="sheet-table">
            <tbody>
              {current.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  <th className="row-no">{rowIndex + 1}</th>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} title={cell}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {current?.truncated ? (
          <div className="sheet-more">
            表格较大，这里只展示前 {MAX_ROWS} 行、{MAX_COLS} 列，完整内容请下载原件
          </div>
        ) : null}
      </div>
    </div>
  );
}
