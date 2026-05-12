import { useState, useCallback } from 'react';

const TOUR_COMPLETED_KEY = 'smart-sheet-mate-tour-completed';

/**
 * 管理用户教学引导的状态
 * - 首次启动自动触发
 * - localStorage 持久化完成状态
 * - 提供手动重置方法
 */
export function useTour() {
  const [tourActive, setTourActive] = useState(() => {
    return !localStorage.getItem(TOUR_COMPLETED_KEY);
  });

  const markTourCompleted = useCallback(() => {
    localStorage.setItem(TOUR_COMPLETED_KEY, '1');
    setTourActive(false);
  }, []);

  const resetTour = useCallback(() => {
    localStorage.removeItem(TOUR_COMPLETED_KEY);
    setTourActive(true);
  }, []);

  return { tourActive, markTourCompleted, resetTour };
}
