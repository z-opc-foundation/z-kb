import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Icon, { type IconName } from '@/components/icon';
import BrandMark from '@/components/brand-mark';

interface DocStep {
  title: string;
  entry?: string;
  ops: string[];
  check?: string;
}

interface DocCell {
  text: string;
  tag?: 'green' | 'gray';
}

interface DocTable {
  title: string;
  head: string[];
  rows: (string | DocCell)[][];
}

interface DocTab {
  key: string;
  label: string;
  icon: IconName;
  title: string;
  summary: string;
  when?: string;
  page?: { label: string; to: string };
  steps?: DocStep[];
  tables?: DocTable[];
  notes?: string[];
  faqs?: { q: string; a: string }[];
}

const TABS: DocTab[] = [
  {
    key: 'start',
    label: '开始使用',
    icon: 'play',
    title: '第一次用，先走通这四步',
    summary: '建一个库、放一批资料、让它变成能搜的内容，然后问一句话试试。全程不用理解系统内部怎么运作。',
    when: '刚拿到账号；或新开了一个知识库，想确认它到底能不能用。',
    page: { label: '去建第一个库', to: '/knowledge-bases' },
    steps: [
      {
        title: '建一个知识库',
        entry: '左侧「知识空间 → 知识管理」→ 右上角「新建知识库」',
        ops: [
          '不确定选哪个类型，就选「文件库」。',
          '名称写同事一眼能看懂的业务名，比如「客户支持手册」。',
        ],
        check: '列表里出现这个库，而且能点进去。',
      },
      {
        title: '放一批资料进来',
        entry: '进入这个库 →「知识工作台」→「资料」→ 上传',
        ops: [
          '先放 5～10 份最常用的文件，别一上来就把全公司的文档都导进去。',
          '文件里的文字要能选中复制，扫描件和图片读不出内容。',
        ],
        check: '每份资料的状态从「待处理」走到「可编译」。',
      },
      {
        title: '让它变成可搜索的知识',
        entry: '勾选资料 →「知识编译」',
        ops: [
          '一份文档一般几十秒到几分钟，页面上会显示进度。',
          '这一步不需要你配置任何东西。',
        ],
        check: '资料显示「已编译」，「Wiki」里能看到新页面。',
      },
      {
        title: '搜一下，再问一下',
        entry: '「知识工作台」→「检索」',
        ops: [
          '搜一个同事平时真的会问的问题，比如「退款要几天」。',
          '看前几条命中是不是你要的那份资料。',
        ],
        check: '命中能点回原文件，回答里的引用指得对。',
      },
    ],
    tables: [
      {
        title: '系统里的词，是什么意思',
        head: ['你会看到的词', '它指的是'],
        rows: [
          ['原始 / 资料', '你上传的文件本身。系统只读原文件，不会改动它'],
          ['编译', '系统把文件拆开、整理成能搜索的内容。不需要你操作细节'],
          ['Wiki / 知识页面', '整理后的正文，搜索和问答用的就是它'],
          ['图谱', '资料、概念、页面之间的关联，用来看「这些东西怎么串起来」'],
          ['评测', '用一批固定问题，检验这个库答得好不好'],
          ['可检索 / 可问答', '系统内部的两个完成标记：能搜到，和能给出回答'],
        ],
      },
    ],
    notes: [
      '先小批量试跑，确认效果再批量导入；一次导太多，出问题不好定位。',
      '判断这个库「能不能用」：同事常问的十个问题，它至少能答对，并能指出出处。',
    ],
  },
  {
    key: 'create',
    label: '新建知识库',
    icon: 'layers',
    title: '建库前先想清楚：这个库里放什么',
    summary: '库类型决定资料怎么组织，建好就不能改；选错了只能新建一个库把资料搬过去。',
    when: '新业务上线；要按团队分开管理；或现有库里混了不同主题的资料。',
    page: { label: '打开知识库列表', to: '/knowledge-bases' },
    steps: [
      {
        title: '先回答一个问题：这个库放什么',
        ops: [
          '一个库只放一个主题，搜索时才不会互相干扰。',
          '同一批资料要给不同团队不同权限，就拆成几个库。',
        ],
      },
      {
        title: '选类型',
        entry: '新建知识库 → 类型',
        ops: [
          '不确定就选「文件库」，普通文档用它最省事。',
          '文档、表格、代码混着放，并且想自己分目录，选「混合库」。',
          '资料已经在语雀 / Git / 数据库里，选对应类型，之后在「设置 → 接入源」绑定。',
        ],
        check: '选中的类型和你放资料的习惯对得上。',
      },
      {
        title: '起名字',
        ops: [
          '名称给同事看，建好还能改；写业务名，别写「测试1」「新库2」。',
          '编码由系统生成，建好后不能改；用 Markdown 批量导入时要填它。',
        ],
      },
      {
        title: '把库交给同事',
        entry: '卡片齿轮 →「权限与版本」→「添加成员」',
        ops: ['给同事选角色：只读 / 贡献者 / 编辑 / 审核者 / 知识库管理员。'],
        check: '被添加的同事能打开这个库。',
      },
    ],
    tables: [
      {
        title: '我该选哪种库',
        head: ['类型', '适合放什么', '什么时候选'],
        rows: [
          ['文件库', '上传的普通文档', '最常见；不确定就选它'],
          ['混合库', '文档、表格、代码等混在一起', '需要自己按目录整理'],
          ['语雀库', '语雀上的知识库文档', '内容已经在语雀维护'],
          ['代码库', 'Git 仓库里的代码与文档', '想让同事按代码提问'],
          ['数据库', '表结构与数据说明', '要把库表讲清楚给业务看'],
        ],
      },
    ],
    notes: [
      '类型创建后不能改——它决定资料怎么组织。',
      '建好之后第一件事是把资料放进来，见「放资料进来」。',
    ],
  },
  {
    key: 'upload',
    label: '放资料进来',
    icon: 'upload',
    title: '资料从哪来：上传、同步，或别人共享',
    summary: '本地上传、从已有系统同步都能进同一个库，放进来之后统一整理。',
    when: '新库开始装资料；或者资料更新了，要换成新版本。',
    steps: [
      {
        title: '本地上传',
        entry: '「知识工作台」→「资料」→ 上传',
        ops: [
          '支持文字能复制的文件：txt / md / csv / json / PDF / Word 等。',
          '可以一次选多个文件。',
        ],
        check: '资料出现在列表里，状态开始往前走。',
      },
      {
        title: '从已有系统同步',
        entry: '卡片齿轮 →「设置」→「接入源」',
        ops: [
          '可以绑定语雀知识库、代码仓库、数据库或共享文件夹。',
          '一个库能绑多条来源；绑定后由后台任务把内容拉进来。',
        ],
        check: '接入源显示已连接，资料列表出现同步来的内容。',
      },
      {
        title: '整理目录（混合库）',
        ops: [
          '左栏是条目树：新建分类、重命名，把资料拖到对应分类里。',
          '分类只影响怎么组织，不影响搜索。',
        ],
      },
      {
        title: '确认文件能被读懂',
        entry: '资料详情 →「原文」',
        ops: [
          '能看到正文，说明文字被识别出来了。',
          '扫描件、纯图片的文件通常读不出字，需要先转成可复制的文件。',
        ],
        check: '资料状态是「可编译」。',
      },
    ],
    tables: [
      {
        title: '资料状态的含义',
        head: ['状态', '说明', '你可以做什么'],
        rows: [
          ['待处理', '刚上传，排队等识别', '等一下'],
          ['解析中', '系统正在提取文字', '等一下'],
          ['可编译', '文字已经识别出来', '勾选它，发起整理'],
          ['解析失败', '没读出文字', '换一份可复制的文件重传'],
          ['已编译', '已经整理完，能搜到', '去搜索或问答里验证'],
        ],
      },
    ],
    notes: [
      '重新上传同名文件会生成新版本，旧版本保留在「版本」里。',
      '一次导入几百份之前，先用十几份试一次，确认效果和耗时。',
    ],
  },
  {
    key: 'organize',
    label: '变成可搜索的知识',
    icon: 'sparkles',
    title: '点一次「编译」，资料就变成能搜的内容',
    summary: '系统会解析、切分、整理资料；你不用关心里面分了几道工序。',
    when: '资料状态到了「可编译」，就该做这一步——没整理过的资料搜不到。',
    steps: [
      {
        title: '发起整理',
        entry: '勾选资料 →「知识编译」；或按目录整体整理',
        ops: ['一次可以选多份，也可以只处理一个目录。'],
      },
      {
        title: '等它跑完',
        ops: [
          '单份文档通常几十秒到几分钟，内容越复杂越久。',
          '页面会显示进度；跑完状态会变，不用守着。',
        ],
        check: '任务列表里这批都完成，没有失败。',
      },
      {
        title: '看结果',
        entry: '「知识工作台」→「Wiki」',
        ops: [
          '能看到新生成的知识页面，说明整理成功。',
          '点开一页，正文和出处都在。',
        ],
      },
      {
        title: '效果不对就重来',
        entry: '资料详情 →「重新编译」',
        ops: [
          '只重跑这一份，不影响同库其它资料。',
          '想先看差在哪，用「加工对照」左右对照原文和整理结果。',
        ],
      },
    ],
    notes: [
      '改了原文件要重新上传再重新编译，旧版本会留在「版本」里。',
      '一份资料整理失败不会影响其它资料。',
    ],
  },
  {
    key: 'search',
    label: '搜索与提问',
    icon: 'search',
    title: '用平时说话的方式问，拿到带出处的答案',
    summary: '搜索找原始片段，助手直接给答案；两者都只在你当前这个库里找。',
    when: '要找某条规定、某个参数；或者想让人替你先把资料读一遍再回答。',
    steps: [
      {
        title: '搜索',
        entry: '「知识工作台」→「检索」',
        ops: [
          '一句话只问一件事，别把三件事塞进一句话。',
          '用资料里的说法问，命中率最高。',
        ],
        check: '前几条结果就是你想要的那份资料。',
      },
      {
        title: '问助手',
        entry: '检索页的「问 AI」，或右侧「知识助手」',
        ops: [
          '助手把答案整理成一段话，并标出依据。',
          '只读：不会改你的资料，也不会自己发布内容。',
        ],
        check: '答案下面的引用能点回具体页面和原文。',
      },
      {
        title: '结果不对，按顺序排查',
        ops: [
          '换个说法，用资料里的原词再试一次。',
          '在高级选项里放宽「最少相关度」，或多给几条结果。',
          '确认这份资料已经整理过——没整理过的搜不到。',
          '还不行，用「加工对照」看整理时有没有把关键内容丢掉。',
        ],
      },
    ],
    notes: [
      '本期只支持「按意思找」的搜索，不要求字面完全一致。',
      '回答里没有引用时不要采信，回到原文核对。',
    ],
  },
  {
    key: 'wiki',
    label: '读知识页面',
    icon: 'book',
    title: '整理后的正文，可以直接读、拿去分享',
    summary: 'Wiki 是把资料整理好之后的正文，比原文件好读，也更容易被搜到。',
    when: '快速查一段说明；做新人培训材料；核对某条结论。',
    steps: [
      {
        title: '浏览',
        entry: '「知识工作台」→「Wiki」',
        ops: [
          '列表看全部页面，目录按层级看。',
          '每页都能看到它来自哪份资料。',
        ],
      },
      {
        title: '看正文与出处',
        entry: '点开任意一页',
        ops: [
          '正文是整理后的内容；「来源资料」能回到原文件。',
          '「来源证据」看这句话是从哪一段来的。',
        ],
        check: '正文说的内容，在原文件里找得到。',
      },
      {
        title: '分享',
        ops: [
          '把页面链接发给同事，对方有这个库的权限就能打开。',
          '对外发布前，先确认这段内容允许外发。',
        ],
      },
    ],
    notes: ['以正文和原文件为准；图谱里的连线只是线索。'],
  },
  {
    key: 'graph',
    label: '关系图谱',
    icon: 'network',
    title: '看资料、概念、页面之间是怎么连起来的',
    summary: '图谱把相关内容连成一张网，用来看「还有哪些我没想到的相关内容」。',
    when: '想找同类资料；想确认某个概念还出现在哪些文档里。',
    steps: [
      {
        title: '打开图谱',
        entry: '「知识工作台」→「Wiki 图谱」',
        ops: ['节点按资料、概念、页面分组。'],
      },
      {
        title: '找节点、顺着线看',
        ops: [
          '左栏搜索名称；点节点看它连了谁。',
          '点连线可以跳到对应的知识页面。',
        ],
      },
    ],
    notes: [
      '连线表示「有关联或可能相关」，不是结论；要下结论请看正文和原文。',
      '图谱只画有关联的部分，不等于全库清单。',
    ],
  },
  {
    key: 'quality',
    label: '内容质量自查',
    icon: 'check',
    title: '哪些资料整理得好，哪些丢了内容',
    summary: '抽查比通读省事：挑最关键的几份，对照原文看整理结果靠不靠谱。',
    when: '上线前；或者同事反馈「搜出来的内容不对」。',
    steps: [
      {
        title: '抽查一份关键资料',
        entry: '资料详情 →「加工对照」',
        ops: ['左原文、右整理结果，重点看条款、数字、表格有没有丢。'],
        check: '关键信息在整理结果里都还在。',
      },
      {
        title: '看抽出来的要点',
        entry: '资料详情 →「知识点」',
        ops: [
          '读起来是不是人话，有没有把不同条款混在一起。',
          '抽得离谱，多半是原文件排版太乱。',
        ],
      },
      {
        title: '看整体情况',
        entry: '知识库「概览」',
        ops: [
          '未编译数量多，说明还有资料没处理。',
          '失败集中在某一类文件，通常是那类文件本身不可解析。',
        ],
      },
    ],
    notes: [
      '质量问题多数源头在文件：扫描件、复杂表格、超长目录。换一份干净的源文件，比反复重编译有效。',
    ],
  },
  {
    key: 'assistant',
    label: '问答助手',
    icon: 'brain',
    title: '让助手用你的资料回答问题',
    summary: '日常使用不需要配置：工作台右侧的助手已经连着当前这个库。要做专用助手，才需要管理员去配。',
    when: '想让助手固定回答某类业务问题，或者把它接到别的系统里。',
    steps: [
      {
        title: '日常使用',
        entry: '工作台右侧「知识助手」',
        ops: ['直接提问，答案带出处。', '只读：不会改资料。'],
      },
      {
        title: '配一个业务助手（管理员）',
        entry: '侧栏「基础设施 → 智能管理」',
        ops: [
          '写清楚这个助手是谁、回答什么范围、不确定时怎么说。',
          '选好它能调用的工具，然后发布——不发布不生效。',
        ],
      },
      {
        title: '给它加能力（管理员）',
        entry: '「基础设施 → 工具定义」',
        ops: [
          '注册它能调用的能力，例如查检索结果。',
          '同样要发布版本后，才能被助手引用。',
        ],
      },
      {
        title: '看用得怎么样',
        entry: '「基础设施 → 调用监控」',
        ops: ['看每次调用、耗时和异常。'],
      },
    ],
    notes: [
      '「基础设施」是管理员配置区；普通同事用工作台里的助手就够了。',
      '改了提示词要重新发布，线上才会变。',
    ],
  },
  {
    key: 'eval',
    label: '评测效果',
    icon: 'target',
    title: '用一批固定问题，检验这个库答得好不好',
    summary: '自己出题、自己看分；适合上线前摸底，也适合每次补完资料后回归。',
    when: '新库上线前；大批资料更新后；同事质疑回答质量时。',
    page: { label: '打开评测', to: '/evaluations' },
    steps: [
      {
        title: '进入某个库的评测',
        entry: '侧栏「知识空间 → 知识评测」，或库详情页头「知识评测」',
        ops: ['每个可评测的库一行，点进去是这个库的评测页。'],
      },
      {
        title: '准备一批问题',
        entry: '「测评跑批」',
        ops: [
          '一个库一份问题集：常见问题、边界问题，再加几条「它不该乱答」的题。',
        ],
      },
      {
        title: '跑一次，看结果',
        ops: [
          '看哪些题答对了、哪些答错了；错题可以直接加进回归集。',
          '改完资料后，用同一份问题集再跑一次，才知道有没有变好。',
        ],
      },
    ],
    notes: [
      '不同批次的评分口径不同，分数不能直接对比；要对比就用同一份问题集。',
      '评测是用来自查的，不是发布审批。',
    ],
  },
  {
    key: 'members',
    label: '成员与权限',
    icon: 'users',
    title: '谁能看、谁能改、谁能删',
    summary: '按成员给角色，改完立即生效；没有权限的人看不到这个库。',
    when: '同事要一起维护这个库；有人转岗或离职，要收回权限。',
    steps: [
      {
        title: '找到入口',
        entry: '知识库卡片上的齿轮 →「权限与版本」',
        ops: ['打开的是整页设置，左栏选「权限与版本」。'],
      },
      {
        title: '加人并选角色',
        ops: [
          '点「添加成员」，在名单里选人、选角色，确认后立即生效。',
          '同一个人重复添加不会叠加权限，只会改角色。',
        ],
        check: '成员列表里出现这个人。',
      },
      {
        title: '调整或收回',
        ops: [
          '角色直接在列表里改。',
          '移除后，这个人对资料、页面、任务的写权限立即收回。',
        ],
      },
      {
        title: '创建者不可改',
        ops: ['创建者那一行是灰的，角色不能改。'],
      },
    ],
    tables: [
      {
        title: '五种角色能做什么',
        head: ['角色', '能做什么'],
        rows: [
          ['知识库管理员', '设置、成员、内容、审核，全部操作'],
          ['编辑', '写资料、发起整理、审核；不能改成员与设置'],
          ['贡献者', '上传与维护资料；不能审核、不能发起整理'],
          ['审核者', '审核内容、查看整理结果；不能改资料'],
          ['只读', '只能看和搜'],
        ],
      },
    ],
    notes: ['没有库管理权限的成员，在「权限与版本」里只能看到自己。'],
  },
  {
    key: 'faq',
    label: '常见问题',
    icon: 'help-circle',
    title: '常见问题',
    summary: '按「你看到的现象」查原因和处理方式。',
    faqs: [
      {
        q: '资料上传了，却没法发起整理',
        a: '资料还没识别完，或者识别失败了。状态到了「可编译」才能整理；在资料视图看它的状态和失败提示，识别失败的换一份可复制的文件重传。',
      },
      {
        q: '整理一直排队，或者卡在某一步',
        a: '到「任务管理」看这份资料停在哪一步、用了多久。长时间没有进展的会被标记失败，失败原因通常写在摘要里；按阶段重试只影响这一份资料，不影响其它。',
      },
      {
        q: '整理完了，但页面内容很少',
        a: '文件本身可读的文字太少：扫描件没有文字层，或者表格里没有有效文本。到资料详情「原文」确认能读到什么，读不到就换源文件重新上传。',
      },
      {
        q: '搜不到想要的内容',
        a: '按顺序检查：这份资料整理过没有；问题有没有用资料里的原词；是不是在正确的库里问；必要时放宽「最少相关度」、多给几条结果；最后看「加工对照」有没有丢关键内容。',
      },
      {
        q: '知识库类型选错了，能改吗',
        a: '不能。类型在创建时就定死了，它决定了资料怎么组织、怎么被搜到。需要换类型，就新建一个库，把资料搬过去。',
      },
      {
        q: '删除知识库，提示要先归档',
        a: '删除前必须先归档。归档不影响已有内容被搜到；归档后可以在列表里筛选「已归档」，再恢复或删除。',
      },
      {
        q: '切换租户后，列表空了',
        a: '数据按租户隔离，换租户就等于换了一套库。新租户下没有库时，先新建一个。',
      },
      {
        q: '助手给的答案不对',
        a: '助手只根据当前库里整理好的内容回答。答案不对通常是库里没有对应资料，或者整理质量不够。先点开回答里的引用，回到对应页面和原文核对。',
      },
      {
        q: '评测分数能作为上线依据吗',
        a: '不能。评测是用来自查的，不是审批门禁；不同批次的分数不能直接对比，要对比就用同一份问题集再跑一次。',
      },
    ],
  },
];

const DEFAULT_TAB = TABS[0].key;

export default function WelcomePage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const activeKey = TABS.some((tab) => tab.key === requested) ? (requested as string) : DEFAULT_TAB;
  const active = TABS.find((tab) => tab.key === activeKey) ?? TABS[0];

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [activeKey]);

  const selectTab = (key: string) => {
    if (key === activeKey) return;
    setParams(key === DEFAULT_TAB ? {} : { tab: key }, { replace: true });
  };

  return (
    <div className="welcome-site">
      <header className="welcome-top">
        <Link className="welcome-brand" to="/welcome">
          <span className="brand-mark">
            <BrandMark />
          </span>
          <span className="brand-copy">
            <span className="brand-name">知识中台</span>
            <span className="brand-sub">Knowledge OS</span>
          </span>
        </Link>
        <span className="welcome-top-divider" aria-hidden="true" />
        <span className="welcome-top-title">使用手册</span>
        <div className="welcome-top-actions">
          <Link className="welcome-top-link" to="/welcome?tab=start">
            开始使用
          </Link>
          <Link className="welcome-top-link" to="/welcome?tab=faq">
            常见问题
          </Link>
          <Link className="welcome-top-link" to="/index">
            返回控制台
          </Link>
        </div>
      </header>

      <section className="welcome-hero">
        <div className="welcome-hero-inner">
          <div className="welcome-hero-copy">
            <span className="welcome-eyebrow">Knowledge OS · 使用手册</span>
            <h1>
              把手上的资料
              <br />
              变成同事<span className="welcome-hl">能搜、能问</span>的知识
            </h1>
            <p>
              不用记系统里的名词。先按四步走通：建库、放资料、整理、提问；之后按你要做的事，在下面挑主题看。
            </p>
            <div className="welcome-hero-actions">
              <Link className="welcome-hero-cta" to="/welcome?tab=start">
                从第一步开始
                <Icon name="arrow-right" size={14} />
              </Link>
              <Link className="welcome-hero-ghost" to="/knowledge-bases">
                <Icon name="database" size={14} />
                进入知识库
              </Link>
            </div>
            <ul className="welcome-hero-stats">
              <li>
                <b>4 步</b>
                <span>让资料可搜可问</span>
              </li>
              <li>
                <b>{TABS.length} 个主题</b>
                <span>按要做的事分</span>
              </li>
              <li>
                <b>5 类角色</b>
                <span>从只读到管理员</span>
              </li>
            </ul>
          </div>

          <div className="welcome-hero-visual" aria-hidden="true">
            <div className="welcome-preview">
              <div className="welcome-preview-head">
                <span className="wp-lib">
                  <span className="wp-lib-mark">客</span>
                  <span className="wp-lib-name">客户支持手册</span>
                  <span className="wp-lib-type">文件库</span>
                </span>
                <span className="wp-state">
                  <Icon name="check-circle" size={11} />
                  已整理 · 可问答
                </span>
              </div>
              <div className="welcome-preview-body">
                <div className="welcome-preview-tree">
                  <span className="wp-tree-label">目录</span>
                  <span className="wp-tree-item is-folder">
                    <Icon name="folder-open" size={11} />
                    售后政策
                  </span>
                  <span className="wp-tree-item is-file is-active">
                    <Icon name="file-text" size={11} />
                    退款时效
                  </span>
                  <span className="wp-tree-item is-file">
                    <Icon name="file-text" size={11} />
                    换货流程
                  </span>
                  <span className="wp-tree-item is-folder">
                    <Icon name="folder" size={11} />
                    常见问题
                  </span>
                  <span className="wp-tree-item is-file">
                    <Icon name="file-text" size={11} />
                    到账时间
                  </span>
                  <span className="wp-tree-item is-folder">
                    <Icon name="folder" size={11} />
                    产品说明
                  </span>
                </div>
                <div className="welcome-preview-main">
                  <div className="p-question">
                    <span>退款要几天到账？</span>
                    <span className="p-ask">问</span>
                  </div>
                  <div className="p-answer">
                    <div className="p-answer-head">
                      <span className="p-answer-avatar">
                        <Icon name="sparkles" size={11} />
                      </span>
                      <b>知识助手</b>
                      <span className="p-answer-meta">引用 2 处</span>
                    </div>
                    <p>审核通过后 3 个工作日内，退回原支付方式；实际到账时间以银行处理为准。</p>
                  </div>
                  <div className="p-sources">
                    <span className="p-source">
                      <i>1</i>
                      <Icon name="file-text" size={11} />
                      <span className="p-source-title">退款时效</span>
                      <span className="p-source-path">售后政策</span>
                    </span>
                    <span className="p-source">
                      <i>2</i>
                      <Icon name="file-text" size={11} />
                      <span className="p-source-title">到账时间</span>
                      <span className="p-source-path">常见问题</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <nav className="welcome-tabbar" role="tablist" aria-label="使用手册">
        <div className="welcome-tabbar-inner">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`welcome-tab-${tab.key}`}
              aria-selected={tab.key === activeKey}
              aria-controls="welcome-panel"
              className={`tab${tab.key === activeKey ? ' active' : ''}`}
              onClick={() => selectTab(tab.key)}
            >
              <Icon name={tab.icon} size={13} />
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <main
        className="welcome-main"
        id="welcome-panel"
        role="tabpanel"
        aria-labelledby={`welcome-tab-${active.key}`}
      >
        <article className="welcome-doc" key={activeKey}>
          <div className="welcome-doc-head">
            <div>
              <h2>{active.title}</h2>
              <p>{active.summary}</p>
              {active.when ? (
                <p className="welcome-when">
                  <Icon name="info" size={12} />
                  <span>{active.when}</span>
                </p>
              ) : null}
            </div>
            {active.page ? (
              <Link className="welcome-page-link" to={active.page.to}>
                {active.page.label}
                <Icon name="arrow-right" size={13} />
              </Link>
            ) : null}
          </div>

          {active.steps ? (
            <section className="welcome-block">
              <h3>
                <Icon name="list" size={13} />
                怎么做
              </h3>
              <ol className="welcome-flow">
                {active.steps.map((step, index) => (
                  <li key={step.title}>
                    <span className="num">{index + 1}</span>
                    <div className="body">
                      <b className="step-title">{step.title}</b>
                      <div className={`step-cols${step.entry || step.check ? '' : ' is-wide'}`}>
                        {step.entry || step.check ? (
                          <div className="step-side">
                            {step.entry ? (
                              <p className="entry">
                                <Icon name="chevron-right" size={12} />
                                <span>{step.entry}</span>
                              </p>
                            ) : null}
                            {step.check ? (
                              <p className="check">
                                <Icon name="check-circle" size={12} />
                                <span>怎么算成功：{step.check}</span>
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                        <ul className="ops">
                          {step.ops.map((op) => (
                            <li key={op}>{op}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {active.tables?.map((table) => (
            <section className="welcome-block" key={table.title}>
              <h3>
                <Icon name="table" size={13} />
                {table.title}
              </h3>
              <div className="welcome-table-wrap">
                <table className="list-table welcome-table">
                  <thead>
                    <tr>
                      {table.head.map((cell) => (
                        <th key={cell}>{cell}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row, rowIndex) => (
                      <tr key={`${table.title}-${rowIndex}`}>
                        {row.map((cell, cellIndex) =>
                          typeof cell === 'string' ? (
                            <td key={cellIndex}>{cell}</td>
                          ) : (
                            <td key={cellIndex}>
                              <span className={`tag ${cell.tag ?? 'gray'}`}>{cell.text}</span>
                            </td>
                          ),
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}

          {active.faqs ? (
            <section className="welcome-block">
              <h3>
                <Icon name="help-circle" size={13} />
                现象与处理
              </h3>
              <div className="welcome-faq">
                {active.faqs.map((item) => (
                  <article className="faq-item" key={item.q}>
                    <b>{item.q}</b>
                    <p>{item.a}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {active.notes ? (
            <aside className="welcome-notes">
              <h4>
                <Icon name="info" size={13} />
                小提示
              </h4>
              <ul>
                {active.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </aside>
          ) : null}
        </article>
      </main>

      <footer className="welcome-foot">
        <div className="welcome-foot-inner">
          <span className="welcome-foot-brand">
            <span className="brand-mark">
              <BrandMark />
            </span>
            知识中台 · 使用手册
          </span>
          <span className="welcome-foot-links">
            <Link to="/welcome?tab=start">开始使用</Link>
            <Link to="/welcome?tab=faq">常见问题</Link>
            <Link to="/index">返回控制台</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
