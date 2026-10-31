import AppModal from '@/components/app-modal';
import Icon from '@/components/icon';
import type { CategoryNode } from '@/services/category';
import { useMemo, useState } from 'react';

interface MoveCategoryModalProps {
  tree: CategoryNode[];
  count: number;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (targetId?: string) => void;
}

interface FlatCategory {
  node: CategoryNode;
  depth: number;
}

function flattenTree(nodes: CategoryNode[], depth = 0): FlatCategory[] {
  const rows: FlatCategory[] = [];
  nodes.forEach((node) => {
    rows.push({ node, depth });
    if (node.children && node.children.length) {
      rows.push(...flattenTree(node.children, depth + 1));
    }
  });
  return rows;
}

function MoveCategoryModal({
  tree,
  count,
  busy = false,
  onClose,
  onConfirm,
}: MoveCategoryModalProps) {
  const [target, setTarget] = useState<string | null>(null);
  const rows = useMemo(() => flattenTree(tree), [tree]);

  return (
    <AppModal
      icon="folder"
      title="移动分类"
      sub={`将 ${count} 个资料移动到目标分类`}
      width={520}
      onClose={onClose}
      footLeft="未分类可作为回收位置；也可以直接在左侧树上拖动单个资料"
      footRight={
        <>
          <button
            className="btn"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            取消
          </button>
          <button
            className="btn primary"
            type="button"
            disabled={busy || target === null}
            onClick={() => {
              if (target === null) {
                return;
              }
              onConfirm(target || undefined);
            }}
          >
            <Icon name="check" size={13} />
            移动到所选分类
          </button>
        </>
      }
      body={
        <div>
          <div className="tree move-tree">
            <div
              className={`tree-item ${target === '' ? 'active' : ''}`}
              onClick={() => setTarget('')}
            >
              <Icon name="inbox" size={13} />
              未分类
            </div>
            {rows.map(({ node, depth }) => (
              <div
                key={node.categoryId}
                className={`tree-item ${
                  target === node.categoryId ? 'active' : ''
                }`}
                style={depth ? { paddingLeft: 9 + depth * 16 } : undefined}
                onClick={() => setTarget(node.categoryId)}
              >
                <Icon name="folder" size={13} />
                {node.name}
              </div>
            ))}
          </div>
          {!rows.length ? (
            <p className="note" style={{ marginTop: 10 }}>
              这个库还没有分类，只能移动到未分类；先在左侧分类树上新建分类。
            </p>
          ) : null}
        </div>
      }
    />
  );
}

export default MoveCategoryModal;
