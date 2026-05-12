import { useEffect, useRef } from 'react';
import { driver } from 'driver.js';
import type { DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';

interface TourGuideProps {
  active: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

/**
 * 用户教学引导组件
 * 基于 driver.js 封装，提供中文本地化的步骤引导
 * 每步指向不同目标元素，镂空区域随步骤变化
 */
export function TourGuide({ active, onComplete, onSkip }: TourGuideProps) {
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);

  useEffect(() => {
    if (!active) return;

    const steps: DriveStep[] = [
      {
        popover: {
          title: '👋 欢迎使用智能表格助手',
          description: '这是一个将源数据按模板格式导出的工具。接下来我将带你快速了解操作流程，只需几步即可完成。',
        },
      },
      {
        element: '[data-tour-id="tour-source-file"]',
        popover: {
          title: '第 1 步：选择源文件',
          description: '点击"选择文件"按钮，选取你要处理的 Excel 或 CSV 文件。',
          side: 'bottom' as const,
        },
      },
      {
        element: '[data-tour-id="tour-source-load"]',
        popover: {
          title: '第 2 步：加载数据',
          description: '选择文件后，点击"加载"读取数据。如果文件有多个工作表，可在此切换。',
          side: 'bottom' as const,
        },
      },
      {
        element: '[data-tour-id="tour-source-header"]',
        popover: {
          title: '第 3 步：确认源表头',
          description: '设置表头所在行范围和数据起始行，点击"确认"。系统会自动识别列名，源字段将出现在左侧面板。',
          side: 'bottom' as const,
        },
      },
      {
        element: '[data-tour-id="tour-template-upload"]',
        popover: {
          title: '第 4 步：上传目标模板',
          description: '点击"上传模板"选取目标模板文件。导出结果将保持模板的样式和格式。',
          side: 'bottom' as const,
        },
      },
      {
        element: '[data-tour-id="tour-template-header"]',
        popover: {
          title: '第 5 步：同步模板表头',
          description: '设置模板的表头行范围，点击"同步"后系统会解析出目标列，显示在右侧映射区。',
          side: 'bottom' as const,
        },
      },
      {
        element: '[data-tour-id="tour-source-fields"]',
        popover: {
          title: '第 6 步：源字段面板',
          description: '确认表头后，源文件的列名会出现在这里。你可以搜索筛选需要的字段。',
          side: 'right' as const,
        },
      },
      {
        element: '[data-tour-id="tour-mapping-area"]',
        popover: {
          title: '第 7 步：字段映射',
          description: '从左侧拖拽源字段到右侧对应的目标列中。也可以点击"智能匹配"自动关联同名字段。',
          side: 'left' as const,
        },
      },
      {
        element: '[data-tour-id="tour-export-btn"]',
        popover: {
          title: '第 8 步：导出结果',
          description: '映射完成后，点击此按钮导出。系统会先校验映射是否完整，通过后即可生成文件。',
          side: 'top' as const,
        },
      },
      {
        popover: {
          title: '🎉 教学完成',
          description: '你已经了解了基本操作流程！映射字段后，点击字段旁的 ⚙ 图标还可以配置转换规则（如脱敏、裁剪、拼接等）。随时点击右上角的帮助按钮可重新查看引导。',
        },
      },
    ];

    const driverObj = driver({
      showProgress: true,
      showButtons: ['next', 'previous', 'close'],
      nextBtnText: '下一步',
      prevBtnText: '上一步',
      doneBtnText: '完成',
      progressText: '{{current}} / {{total}}',
      overlayOpacity: 0.45,
      stagePadding: 16,
      stageRadius: 16,
      onDestroyStarted: () => {
        if (!driverObj.hasNextStep() || driverObj.isLastStep()) {
          driverObj.destroy();
          onComplete();
        } else {
          driverObj.destroy();
          onSkip();
        }
      },
      steps,
      popoverClass: 'tour-popover',
    });

    driverRef.current = driverObj;

    const timer = setTimeout(() => {
      driverObj.drive();
    }, 800);

    return () => {
      clearTimeout(timer);
      if (driverRef.current?.isActive()) {
        driverRef.current.destroy();
      }
    };
  }, [active, onComplete, onSkip]);

  return null;
}
