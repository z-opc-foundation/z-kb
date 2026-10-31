import { confirmAction } from '@/components/confirm';
import {
  fetchScheduleOverview,
  pauseSchedule,
  reloadScheduleTaskItems,
  resumeSchedule,
  saveScheduleConfig,
} from '@/services/taskSchedule';
import type { ScheduleOverview } from '@/services/taskSchedule';
import { toast } from '@/utils/toast';
import { useCallback, useEffect, useState } from 'react';

/** 调度面板的数据与写操作编排；页面只负责渲染。 */
export function useScheduleOverview() {
  const [overview, setOverview] = useState<ScheduleOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [reloading, setReloading] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    const data = await fetchScheduleOverview(silent);
    if (data) {
      setOverview(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const paused = overview?.taskType?.sts === 'pause';

  /** 暂停/恢复必须同时切任务类型与排期，后端一次做完，这里只做二次确认。 */
  const toggle = useCallback(async () => {
    if (!overview || acting) {
      return;
    }
    const ok = await confirmAction({
      title: paused ? '恢复调度' : '暂停调度',
      sub: paused
        ? '任务类型与排期同时置为 resume，调度器会重新拉起线程组开始拉数据。'
        : '任务类型与排期同时置为 pause。已在执行的任务不会被打断，只是不再拉新数据，队列会持续积压。',
      confirmText: paused ? '恢复' : '暂停',
      danger: !paused,
    });
    if (!ok) {
      return;
    }
    setActing(true);
    try {
      const data = paused ? await resumeSchedule() : await pauseSchedule();
      if (data) {
        setOverview(data);
        toast(paused ? '调度已恢复' : '调度已暂停', '任务类型与排期已同步切换', 'success');
      }
    } finally {
      setActing(false);
    }
  }, [acting, overview, paused]);

  /** 保存运行参数：每批取数下一次取数生效，线程数要等节点重建后按新值起线程。 */
  const saveConfig = useCallback(
    async (threadNumber: number, fetchDataNumber: number) => {
      if (savingConfig) {
        return false;
      }
      setSavingConfig(true);
      try {
        const data = await saveScheduleConfig({ threadNumber, fetchDataNumber });
        if (!data) {
          return false;
        }
        setOverview(data);
        toast(
          '运行参数已保存',
          '每批取数下一次取数生效；线程数在节点重建（暂停→恢复或重启）后生效',
          'success',
        );
        return true;
      } finally {
        setSavingConfig(false);
      }
    },
    [savingConfig],
  );

  /** 重载任务项：让在线节点重建分片，正在执行的任务不受影响。 */
  const reload = useCallback(async () => {
    if (reloading) {
      return;
    }
    const ok = await confirmAction({
      title: '重载任务项',
      sub: '在线节点会重新读取分片任务项；正在执行的任务不受影响，重载后按新分片继续取数。',
      confirmText: '重载',
    });
    if (!ok) {
      return;
    }
    setReloading(true);
    try {
      const data = await reloadScheduleTaskItems();
      if (data) {
        setOverview(data);
        toast('任务项已重载', '在线节点会在下一次轮询时重建分片', 'success');
      }
    } finally {
      setReloading(false);
    }
  }, [reloading]);

  return {
    overview,
    loading,
    acting,
    savingConfig,
    reloading,
    paused,
    load,
    toggle,
    saveConfig,
    reload,
  };
}
