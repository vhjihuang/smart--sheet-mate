import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { DraggableItem } from '@/components/DraggableItem';

vi.mock('@/utils/bridge', () => ({
  safeCallParse: vi.fn(),
}));

vi.mock('@/utils/toast', () => ({
  showToast: vi.fn(),
}));

function renderWithDnd(ui: React.ReactElement) {
  return render(<DndContext onDragStart={() => {}} onDragEnd={() => {}}>{ui}</DndContext>);
}

describe('DraggableItem', () => {
  it('启用状态应渲染内容', () => {
    renderWithDnd(<DraggableItem id="src-0" name="姓名" />);
    expect(screen.getByText('姓名')).toBeInTheDocument();
  });

  it('禁用状态应渲染内容', () => {
    renderWithDnd(<DraggableItem id="src-0" name="姓名" isDisabled />);
    expect(screen.getByText('姓名')).toBeInTheDocument();
  });

  it('禁用状态应有 cursor-not-allowed 类名', () => {
    renderWithDnd(<DraggableItem id="src-0" name="姓名" isDisabled />);
    const el = screen.getByText('姓名');
    expect(el.className).toContain('cursor-not-allowed');
  });

  it('启用状态应有 cursor-grab 类名', () => {
    renderWithDnd(<DraggableItem id="src-0" name="姓名" />);
    const el = screen.getByText('姓名');
    expect(el.className).toContain('cursor-grab');
  });

  it('禁用状态不应有 aria-roledescription 属性（不可拖拽）', () => {
    renderWithDnd(<DraggableItem id="src-0" name="姓名" isDisabled />);
    const el = screen.getByText('姓名').closest('[role]');
    if (el) {
      expect(el.getAttribute('aria-roledescription')).toBeFalsy();
    }
  });

  it('多个禁用项不应共享同一 ID', () => {
    const { container } = render(
      <DndContext onDragStart={() => {}} onDragEnd={() => {}}>
        <DraggableItem id="src-0" name="姓名" isDisabled />
        <DraggableItem id="src-1" name="年龄" isDisabled />
      </DndContext>
    );

    const elements = container.querySelectorAll('[data-testid]');
    const ids = Array.from(elements).map(el => el.getAttribute('data-testid'));
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});
