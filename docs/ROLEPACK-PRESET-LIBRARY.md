# 企业级预设角色库 / Enterprise RolePack Library

本目录交付了一套可供 `claw-ops` 后续一键导入的 **Enterprise Command Center** 预设资源。

## 目录

```text
public/presets/enterprise-command-center/
├── manifest.json               # 顶层包清单
├── roles/
│   └── <role-id>/
│       ├── role.json           # 角色元数据
│       ├── SOUL.md             # 角色 prompt 文档
│       ├── workflow.json       # 流程契约
│       ├── authority.json      # 调度边界
│       └── capabilities.json   # 技能/模型/沙箱配置
├── skills/
│   └── <skill-id>/SKILL.md     # 可复用技能文档
└── teams/
    └── *.json                  # 一键部署团队模板
```

## 设计原则

- **角色不是人设，而是契约**：SOUL.md 负责让模型“像这个角色”，workflow/authority/capabilities 负责把边界写死。
- **技能不是附属描述，而是可复用能力**：角色通过 `requiredSkills` 组合能力，而不是把全部技巧塞进单个 prompt。
- **四层组织结构**：L0 治理、L1 决策、L2 协调、L3 执行。
- **现代企业映射**：不直接照抄古代官制称谓，中文角色名面向真实企业用户，英文 ID 面向 OpenClaw 工程落地。

## 已交付内容

- 15 个企业级角色包
- 15 个共享技能文档
- 3 个团队模板
- 1 个顶层 manifest
- 1 份 TypeScript 类型定义：`src/types/presets.ts`

## 角色包导入思路

后续在 claw-ops 前端实现 Preset Browser / Import Modal 时，可按以下顺序使用现有 OpenClaw 方法：

1. 先读取 `public/presets/index.json` 列出可用包
2. 再读取对应包的 `manifest.json`
3. 选择角色或团队模板
4. `agents.create`
5. `agents.update`
6. `agents.files.set` 写入 `SOUL.md` / `workflow.json` / `authority.json` / `capabilities.json`
7. 根据 `requiredSkills` 执行 `skills.install` 或将 SKILL.md 写入目标工作区

## 推荐优先实现

1. 在 `src/lib/api.ts` 暴露 `agents.files.*`
2. 增加 preset 资源的 fetch loader
3. 在 Agents 页面增加 Preset Browser / Import Modal
4. 支持按团队模板批量导入
