import type { TargetColumn } from "@/types";

export const MAX_NEST_LEVEL = 3;

export const defaultTargetColumns: TargetColumn[] = [
  {
    id: "target-user",
    label: "用户信息",
    isGroup: true,
    children: [
      {
        id: "target-basic",
        label: "基本信息",
        isGroup: true,
        children: [
          { id: "target-name", label: "name" },
          { id: "target-gender", label: "gender" },
          { id: "target-age", label: "age" },
        ],
      },
      {
        id: "target-contact",
        label: "联系方式",
        isGroup: true,
        children: [
          { id: "target-phone", label: "phone" },
          { id: "target-email", label: "email" },
        ],
      },
    ],
  },
  { id: "target-note", label: "note" },
  { id: "target-address", label: "address" },
];
