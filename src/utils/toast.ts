import { toast } from "sonner";

/**
 * 活跃 Toast 追踪器
 * 用于防止相同消息同时显示多个 Toast
 */
const activeToasts = new Set<string>();

/**
 * 显示 Toast 通知（防重复）
 *
 * @param type - Toast 类型: success | error | info
 * @param message - 显示的消息内容
 * @param id - 可选的自定义 ID，默认为 `toast-${type}-${message}`
 * @returns Toast 实例或 undefined（如果被阻止）
 *
 * @example
 * showToast("success", "操作成功");
 * showToast("error", "加载失败", "load-error");
 */
export const showToast = (
  type: "success" | "error" | "info",
  message: string,
  id?: string,
  action?: { label: string; onClick: () => void }
) => {
  const toastId = id || `toast-${type}-${message}`;

  // 如果已存在相同 toast，不重复显示
  if (activeToasts.has(toastId)) {
    return;
  }

  activeToasts.add(toastId);

  const toastInstance = toast[type](message, {
    id: toastId,
    action: action,
    onDismiss: () => {
      activeToasts.delete(toastId);
    },
    onAutoClose: () => {
      activeToasts.delete(toastId);
    },
  });

  return toastInstance;
};

/**
 * 清除所有活跃的 Toast 追踪记录
 * 用于手动重置状态（通常不需要调用）
 */
export const clearToastTracking = () => {
  activeToasts.clear();
};
