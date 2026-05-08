import { useDraggable } from "@dnd-kit/core";

export const columnClass = "px-4 py-2 border border-gray-200 rounded-md bg-white shadow-sm cursor-grab text-sm";

interface DraggableItemProps {
  id: string;
  name: string;
  isDisabled?: boolean;
}

export const DraggableItem = ({ id, name, isDisabled }: DraggableItemProps) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    disabled: isDisabled,
  });

  return (
    <div
      ref={setNodeRef}
      {...(isDisabled ? {} : listeners)}
      {...(isDisabled ? {} : attributes)}
      className={`${columnClass} ${isDragging ? "opacity-50" : isDisabled ? "opacity-40 cursor-not-allowed" : ""}`}
    >
      {name}
    </div>
  );
};
