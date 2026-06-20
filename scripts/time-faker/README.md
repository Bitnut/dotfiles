# Kubernetes 时间控制脚本

用于在 Kubernetes 集群中设置、查询和恢复各服务的模拟当前时间（用于测试环境）。

| 脚本 | 功能 |
|------|------|
| `get-time-k8s.sh` | 获取各服务当前模拟时间 |
| `set-time-k8s.sh` | 设置各服务模拟时间为指定日期 |
| `restore-time-k8s.sh` | 恢复各服务为系统真实时间 |
| `cp-snowflake-k8s.sh` | 拷贝 Snowflake 文件到各服务并重启（需 /data 挂载 volume） |
| `apply-snowflake-configmap-k8s.sh` | 通过 ConfigMap 部署 Snowflake 文件（推荐） |

## 前置条件

- 已安装并配置 `kubectl`
- 已配置 kubeconfig（如从 Rancher 下载）
- 有目标集群的访问权限

## 环境变量

| 变量 | 说明 |
|------|------|
| `KUBECONFIG` | kubeconfig 文件路径，指定要连接的集群 |

```bash
# 使用指定 kubeconfig
export KUBECONFIG=/path/to/your/kubeconfig.yaml
```

---

## get-time-k8s.sh - 获取当前时间

从各服务的 Pod 中查询当前模拟时间。

### 用法

```bash
./get-time-k8s.sh [namespace]
```

### 参数

| 参数 | 必填 | 说明 |
|------|------|------|
| namespace | 否 | Kubernetes 命名空间，默认 `default` |

### 示例

```bash
# 使用 default namespace
./get-time-k8s.sh

# 指定 namespace
./get-time-k8s.sh cloud-reolink-r6

# 配合 KUBECONFIG
KUBECONFIG=/home/picher/scripts/k8s-migration/test.yaml ./get-time-k8s.sh cloud-reolink-r6
```

### 输出示例

```
namespace: cloud-reolink-r6
getting current time from services...

=== svc-cloud-subscriptions ===
{
  "now": "Sat Feb 28 2026 07:53:35 GMT+0000 (Coordinated Universal Time)",
  "timestamp": 1772265215861
}

=== svc-sim-card ===
{
  "now": "Sat Feb 28 2026 07:53:37 GMT+0000 (Coordinated Universal Time)",
  "timestamp": 1772265217909
}

done
```

---

## set-time-k8s.sh - 设置当前时间

将各服务的模拟当前时间设置为指定日期，并重启相关 deployment。

### 用法

```bash
./set-time-k8s.sh [时间参数] [namespace]
```

### 参数

| 参数 | 必填 | 说明 |
|------|------|------|
| 时间参数 | 否* | 目标日期，格式 `YYYY-MM-DD`。未提供时会提示输入 |
| namespace | 否 | Kubernetes 命名空间，默认 `default` |

### 示例

```bash
# 交互式输入时间（会提示输入）
./set-time-k8s.sh

# 直接指定时间，使用 default namespace
./set-time-k8s.sh 2025-02-26

# 指定时间和 namespace
./set-time-k8s.sh 2025-02-26 cloud-reolink-r6

# 配合 KUBECONFIG
KUBECONFIG=/path/to/kubeconfig.yaml ./set-time-k8s.sh 2025-02-26 cloud-reolink-r6
```

### 执行流程

1. 重启 `RESTART_DEPLOYMENTS` 中的 deployment
2. 等待 10 秒
3. 对 `SET_TIME_DEPLOYMENTS` 中的 deployment 执行 `set-current-time` 命令

---

## restore-time-k8s.sh - 恢复原始时间

将各服务的模拟时间恢复为系统真实时间，并重启相关 deployment。

### 用法

```bash
./restore-time-k8s.sh [namespace]
```

### 参数

| 参数 | 必填 | 说明 |
|------|------|------|
| namespace | 否 | Kubernetes 命名空间，默认 `default` |

### 示例

```bash
# 使用 default namespace
./restore-time-k8s.sh

# 指定 namespace
./restore-time-k8s.sh cloud-reolink-r6

# 配合 KUBECONFIG
KUBECONFIG=/path/to/kubeconfig.yaml ./restore-time-k8s.sh cloud-reolink-r6
```

### 执行流程

1. 对 `RESTORE_DEPLOYMENTS` 中的 deployment 执行 `restore-original-time` 命令
2. 重启 `RESTART_DEPLOYMENTS` 中的 deployment

---

## cp-snowflake-k8s.sh - 拷贝 Snowflake 文件

将 `Snowflake.js` 和 `SnowflakeSI.js` 拷贝到各服务的 `/data/node_modules/@litert/uuid/lib/` 目录，并重启 deployment。

**前置条件**：`/data` 必须挂载为 volume，否则重启会重置容器导致文件丢失。若无 volume，建议使用 `apply-snowflake-configmap-k8s.sh`。

### 用法

```bash
./cp-snowflake-k8s.sh [namespace] [源文件目录]
```

### 参数

| 参数 | 必填 | 说明 |
|------|------|------|
| namespace | 否 | Kubernetes 命名空间，默认 `default` |
| 源文件目录 | 否 | Snowflake 文件所在目录，默认当前目录 `.` |

### 前置条件

- 当前目录或指定目录下需存在 `Snowflake.js` 和 `SnowflakeSI.js`

### 示例

```bash
# 在 Snowflake 文件所在目录执行，使用 default namespace
./cp-snowflake-k8s.sh

# 指定 namespace
./cp-snowflake-k8s.sh cloud-reolink-r6

# 指定 namespace 和源文件目录
./cp-snowflake-k8s.sh cloud-reolink-r6 /path/to/snowflake/files

# 配合 KUBECONFIG
KUBECONFIG=/path/to/kubeconfig.yaml ./cp-snowflake-k8s.sh cloud-reolink-r6 .
```

### 执行流程

1. 检查源文件是否存在
2. 将 `Snowflake.js` 和 `SnowflakeSI.js` 拷贝到各 deployment 的 Pod
3. 重启所有 deployment

---

## 配置说明

各脚本中的 deployment 列表需根据实际集群配置调整，在脚本内修改以下变量：

### set-time-k8s.sh

- `RESTART_DEPLOYMENTS` - 需要重启的 deployment
- `SET_TIME_DEPLOYMENTS` - 需要设置时间的 deployment

### get-time-k8s.sh

- `GET_TIME_DEPLOYMENTS` - 需要查询时间的 deployment

### restore-time-k8s.sh

- `RESTORE_DEPLOYMENTS` - 需要恢复时间的 deployment
- `RESTART_DEPLOYMENTS` - 需要重启的 deployment

### cp-snowflake-k8s.sh

- `DEPLOYMENTS` - 需要拷贝文件并重启的 deployment

### apply-snowflake-configmap-k8s.sh

- `DEPLOYMENTS` - 需要更新的 deployment

---

## apply-snowflake-configmap-k8s.sh - ConfigMap 方式部署 Snowflake

通过 ConfigMap 管理 Snowflake 文件，无需 volume 挂载，更新后重启即可生效。

### 首次使用：配置 Deployment

在 deployment 中添加 volume 和 volumeMounts，参考 `configmap-deployment-patch.yaml`。
**必须使用 subPath** 仅挂载两个文件，否则会替换整个 lib 目录导致 index.js 等丢失：

```yaml
# 在 containers[0].volumeMounts 中添加（使用 subPath 避免覆盖 lib 目录）
- name: snowflake
  mountPath: /data/node_modules/@litert/uuid/lib/Snowflake.js
  subPath: Snowflake.js
  readOnly: true
- name: snowflake
  mountPath: /data/node_modules/@litert/uuid/lib/SnowflakeSI.js
  subPath: SnowflakeSI.js
  readOnly: true

# 在 spec.template.spec.volumes 中添加
- name: snowflake
  configMap:
    name: snowflake-files
```

### 用法

```bash
./apply-snowflake-configmap-k8s.sh [namespace] [源文件目录]
```

### 执行流程

1. 创建或更新 `snowflake-files` ConfigMap
2. 重启 deployment 以加载新文件

### 查看集群中的 deployment

```bash
kubectl get deployments -n <namespace>
```

---

## 安全提示

- kubeconfig 文件包含集群访问凭证（token），请勿提交到 Git 或分享给他人
- 建议将 kubeconfig 路径加入 `.gitignore`
