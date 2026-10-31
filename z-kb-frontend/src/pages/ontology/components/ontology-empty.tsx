import Icon from '@/components/icon';

export function OntologyEmpty({ onOpen }: { onOpen: () => void }) {
  return (
    <section className="panel ont-empty">
      <div className="ont-empty-icon">
        <Icon name="git-branch" size={26} />
      </div>
      <h2>当前租户尚未开通本体</h2>
      <p>
        开通后可获得独立的本体编码与图空间映射，并在此查看 Schema 图谱、
        对象类型与关系类型清单。一租户一本体，开通操作可重复提交（幂等）。
      </p>
      <button className="btn primary" type="button" onClick={onOpen}>
        <Icon name="plus" size={14} />
        开通本体
      </button>
    </section>
  );
}
