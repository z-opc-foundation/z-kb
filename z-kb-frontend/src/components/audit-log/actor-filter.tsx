import Icon from '@/components/icon';
import { listMembers, type OrgMember } from '@/services/identity';
import { useEffect, useRef, useState } from 'react';

const MAX_OPTIONS = 8;
const SEARCH_DELAY = 250;

export interface ActorFilterProps {
  /** 已生效的操作人 staffId，空串表示不限 */
  value: string;
  onChange: (staffId: string) => void;
}

/** 操作人筛选：输入姓名或工号后按后端模糊匹配给候选，避免一次性铺开全部成员。 */
export default function ActorFilter({ value, onChange }: ActorFilterProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<OrgMember[]>([]);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  // 改字会主动撤掉已选操作人，这次 value 变空不应把刚输入的搜索词也清掉
  const editingRef = useRef(false);

  // 清空筛选或移除已选操作人时同步清空输入里的名字
  useEffect(() => {
    if (!value && !editingRef.current) {
      setQuery('');
    }
    editingRef.current = false;
  }, [value]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const keyword = query.trim();
    if (!keyword) {
      setOptions([]);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    const timer = window.setTimeout(() => {
      listMembers(keyword, { silent: true })
        .then((list) => {
          if (alive) {
            setOptions((list ?? []).slice(0, MAX_OPTIONS));
            setActive(0);
          }
        })
        .catch(() => {
          if (alive) {
            setOptions([]);
          }
        })
        .finally(() => {
          if (alive) {
            setLoading(false);
          }
        });
    }, SEARCH_DELAY);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [query, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDocMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        // 只输入未选人时，离开即还原，避免输入框留着未生效的名字
        if (!value) {
          setQuery('');
        }
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open, value]);

  const pick = (member: OrgMember) => {
    setQuery(member.name || member.jobNumber || String(member.staffId));
    setOpen(false);
    onChange(String(member.staffId));
  };

  const clear = () => {
    setQuery('');
    setOptions([]);
    setOpen(false);
    onChange('');
  };

  const showPop = open && query.trim().length > 0;
  const memberLabel = (member: OrgMember) =>
    member.jobNumber ? `工号 ${member.jobNumber}` : `#${member.staffId}`;

  return (
    <div className="audit-actor" ref={rootRef}>
      <div className="input-icon">
        <span className="ic">
          <Icon name="search" size={13} />
        </span>
        <input
          className="input"
          placeholder="按姓名或工号搜索操作人"
          role="combobox"
          aria-label="操作人"
          aria-expanded={showPop}
          aria-controls="audit-actor-suggest"
          aria-autocomplete="list"
          autoComplete="off"
          value={query}
          onChange={(event) => {
            const next = event.target.value;
            // 改字即视为重新选人：先撤掉已生效的操作人，避免输入框与筛选条件不一致
            if (value) {
              editingRef.current = true;
              onChange('');
            }
            setQuery(next);
            setActive(0);
            setOpen(!!next.trim());
          }}
          onFocus={(event) => {
            if (value) {
              event.target.select();
            }
            if (query.trim()) {
              setOpen(true);
            }
          }}
          onKeyDown={(event) => {
            if (!showPop) {
              return;
            }
            if (!options.length) {
              if (event.key === 'Escape') {
                setOpen(false);
              }
              return;
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActive((index) => Math.min(index + 1, options.length - 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((index) => Math.max(index - 1, 0));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              pick(options[Math.min(active, options.length - 1)]);
            } else if (event.key === 'Escape') {
              setOpen(false);
            }
          }}
        />
      </div>
      {query || value ? (
        <button
          className="audit-actor-clear"
          type="button"
          aria-label="清除操作人"
          onClick={clear}
        >
          <Icon name="x-circle" size={13} />
        </button>
      ) : null}
      {showPop ? (
        <div className="audit-actor-pop" role="listbox" id="audit-actor-suggest">
          {loading ? (
            <div className="audit-actor-note" role="status">
              <span className="spinner" />
              正在匹配成员…
            </div>
          ) : options.length ? (
            options.map((member, index) => (
              <button
                key={member.staffId}
                type="button"
                role="option"
                aria-selected={index === active}
                className={`audit-actor-option ${index === active ? 'active' : ''}`}
                onMouseEnter={() => setActive(index)}
                onClick={() => pick(member)}
              >
                <b>{member.name || '未命名成员'}</b>
                <span className="mono">{memberLabel(member)}</span>
              </button>
            ))
          ) : (
            <div className="audit-actor-note">没有匹配的成员</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
