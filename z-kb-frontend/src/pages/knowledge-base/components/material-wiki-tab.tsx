import Icon from '@/components/icon';
import { listWikiByMaterial, WikiPageRecord } from '@/services/wiki';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Props {
  kbId: string;
  materialId: string;
}

const WIKI_STATUS: Record<string, { label: string; tag: string }> = {
  READY: { label: '已生成', tag: 'green' },
  FAILED: { label: '生成失败', tag: 'red' },
};

export default function MaterialWikiTab({ kbId, materialId }: Props) {
  const navigate = useNavigate();
  const [pages, setPages] = useState<WikiPageRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void listWikiByMaterial(materialId).then((result) => {
      if (cancelled) {
        return;
      }
      setPages(result || []);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [materialId]);

  const openWiki = (wikiId: string) => {
    navigate(
      `/knowledge-bases/${encodeURIComponent(kbId)}/workspace?view=wiki&wikiId=${encodeURIComponent(wikiId)}`,
    );
  };

  if (loading) {
    return (
      <div className="empty">
        <b>正在加载 Wiki…</b>
      </div>
    );
  }

  if (!pages.length) {
    return (
      <div className="empty">
        <div className="empty-icon">
          <Icon name="book" size={20} />
        </div>
        <b>该资料还没有生成 Wiki</b>
        <p>到 Wiki 视图选择这份资料生成；Wiki 按解析正文的标题生成要点，未接 Agent 摘要萃取。</p>
      </div>
    );
  }

  return (
    <div>
      <div className="meta mb-12" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span className="tag gray">{pages.length} 篇 Wiki</span>
        <span className="hint">由该资料生成，点击可打开 Wiki 正文</span>
      </div>
      {pages.map((page) => {
        const status = WIKI_STATUS[page.status] || { label: page.status, tag: 'gray' };
        return (
          <div
            className="binding-row"
            key={page.wikiId}
            style={{ cursor: 'pointer' }}
            role="button"
            tabIndex={0}
            onClick={() => openWiki(page.wikiId)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                openWiki(page.wikiId);
              }
            }}
          >
            <span className="ic">
              <Icon name="book" size={15} />
            </span>
            <div className="copy">
              <b>{page.title}</b>
              <small>
                v{page.versionNo} · {page.charCount ?? 0} 字 · {page.pointCount} 个要点
              </small>
            </div>
            <span className={`tag ${status.tag}`}>{status.label}</span>
            <Icon name="external-link" size={13} />
          </div>
        );
      })}
    </div>
  );
}
